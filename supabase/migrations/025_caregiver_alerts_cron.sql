-- =============================================================================
-- marinloop Caregiver Missed-Dose Alerts Cron (Migration 025)
-- =============================================================================
-- Creates notify_caregivers_missed_dose() and a pg_cron job that fires every
-- 15 minutes to push alerts to accepted caregivers when their care partner
-- logs a missed dose.
--
-- Design notes:
--   • Looks back 16 minutes (cron period + 1 min buffer) to avoid gaps.
--   • Skips the most-recent minute to ensure the dose_log row is committed.
--   • Sends one push per (caregiver push subscription × missed dose) so
--     caregivers on multiple devices each receive the alert.
--   • Reads vault secrets using the same dual fallback pattern as the other
--     cron functions (app.settings → vault.decrypted_secrets).
--   • Falls back to an in-app notification row when the caregiver has no
--     push subscription (they will see the alert on next app open).
--   • The cron schedule block is idempotent: it unschedules then reschedules,
--     matching the pattern in migration 023.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ALERT DEDUPLICATION TABLE
-- ---------------------------------------------------------------------------
-- Tracks which (dose_log_id, caregiver push subscription) pairs have already
-- had a notification sent, so if the cron overlaps or the function is re-run
-- manually the caregiver doesn't receive duplicate alerts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.caregiver_alert_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dose_log_id     uuid        NOT NULL REFERENCES public.dose_logs(id)  ON DELETE CASCADE,
  -- caregiver's push_subscriptions.id (nullable: in-app-only caregivers)
  subscription_id uuid        REFERENCES public.push_subscriptions(id)  ON DELETE CASCADE,
  -- caregiver's user_id (used for in-app fallback deduplication)
  caregiver_user_id uuid      NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dose_log_id, caregiver_user_id)
);

-- RLS: users can see their own caregiver_alert_log rows (for audit/debugging)
ALTER TABLE public.caregiver_alert_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'caregiver_alert_log'
      AND policyname = 'caregiver_alert_log_owner_select'
  ) THEN
    CREATE POLICY "caregiver_alert_log_owner_select" ON public.caregiver_alert_log
      FOR SELECT TO authenticated
      USING (caregiver_user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_caregiver_alert_log_dose_log_id
  ON public.caregiver_alert_log (dose_log_id);

-- Auto-clean entries older than 7 days (cheap; runs every 15 min in context)
-- The cleanup is embedded inside the main function below.

-- ---------------------------------------------------------------------------
-- 2. CORE FUNCTION: notify_caregivers_missed_dose()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_caregivers_missed_dose()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  supabase_url     text;
  service_role_key text;
  now_utc          timestamptz := now();
  v_rec            record;
  v_inserted       int;
BEGIN
  -- -------------------------------------------------------------------------
  -- Read configuration: app.settings first, then vault fallback
  -- -------------------------------------------------------------------------
  supabase_url     := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF supabase_url IS NULL OR supabase_url = '' THEN
    SELECT decrypted_secret INTO supabase_url
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_url'
      LIMIT 1;
  END IF;

  IF service_role_key IS NULL OR service_role_key = '' THEN
    -- TODO(name-unification): Rename vault secret to 'MARINLOOP_SERVICE_ROLE_KEY' after coordinated Vault update.
    SELECT decrypted_secret INTO service_role_key
      FROM vault.decrypted_secrets
      WHERE name = 'MEDFLOW_SERVICE_ROLE_KEY'
      LIMIT 1;
  END IF;

  -- Secondary vault name used by earlier migrations
  IF service_role_key IS NULL OR service_role_key = '' THEN
    SELECT decrypted_secret INTO service_role_key
      FROM vault.decrypted_secrets
      WHERE name = 'service_role_key'
      LIMIT 1;
  END IF;

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING '[marinloop Cron] Missing vault secrets for caregiver alerts — skipping';
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- Main loop: missed doses in the last 16 minutes (cron period = 15 min,
  -- +1 min buffer), excluding the most-recent minute so the write is settled.
  --
  -- Join path:
  --   dose_logs (missed) → medications (name)
  --                      → care_connections (accepted, notify)
  --                      → profiles (caregiver) → push_subscriptions (device)
  --
  -- One row per (dose_log × push subscription) so multi-device caregivers
  -- each receive a push.  The UNIQUE constraint on caregiver_alert_log
  -- deduplicates per (dose_log, caregiver_user_id) across devices.
  -- -------------------------------------------------------------------------
  FOR v_rec IN
    SELECT
      dl.id              AS dose_log_id,
      dl.user_id         AS patient_user_id,
      m.name             AS med_name,
      cc.caregiver_name  AS caregiver_name,
      cp.id              AS caregiver_user_id,
      ps.id              AS subscription_id,
      ps.endpoint        AS endpoint,
      ps.p256dh          AS p256dh,
      ps.auth            AS auth
    FROM public.dose_logs        dl
    JOIN public.medications      m   ON m.id  = dl.medication_id
    JOIN public.care_connections cc  ON cc.user_id         = dl.user_id
                                    AND cc.status          = 'accepted'
                                    AND cc.notify_on_miss  = true
    JOIN public.profiles         cp  ON cp.email = cc.caregiver_email
    -- Left join: we still want to hit the loop for in-app fallback even if
    -- the caregiver has no push sub; filter below handles the NULL case.
    LEFT JOIN public.push_subscriptions ps ON ps.user_id = cp.id
    WHERE dl.status     = 'missed'
      AND dl.created_at >= now_utc - interval '16 minutes'
      AND dl.created_at <  now_utc - interval '1 minute'
      -- Skip pairs already alerted (deduplication)
      AND NOT EXISTS (
        SELECT 1 FROM public.caregiver_alert_log cal
        WHERE cal.dose_log_id       = dl.id
          AND cal.caregiver_user_id = cp.id
      )
    -- Deterministic ordering helps with debugging logs
    ORDER BY dl.created_at, cp.id, ps.id
  LOOP
    IF v_rec.subscription_id IS NOT NULL THEN
      -- -------------------------------------------------------------------
      -- Push path: send via send-push edge function
      -- -------------------------------------------------------------------
      PERFORM net.http_post(
        url     := supabase_url || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body    := jsonb_build_object(
          'endpoint', v_rec.endpoint,
          'p256dh',   v_rec.p256dh,
          'auth',     v_rec.auth,
          'title',    'Missed dose alert',
          'body',     v_rec.caregiver_name || '''s contact missed: ' || v_rec.med_name,
          'url',      '/timeline',
          'tag',      'caregiver-missed-' || v_rec.dose_log_id::text
        )
      );

      RAISE LOG '[marinloop Cron] Caregiver push sent: dose_log=%, caregiver_user=%, sub=%',
        v_rec.dose_log_id, v_rec.caregiver_user_id, v_rec.subscription_id;
    ELSE
      -- -------------------------------------------------------------------
      -- In-app fallback: insert a notification row the caregiver sees on
      -- next app open.  Only insert once (the UNIQUE constraint on
      -- caregiver_alert_log handles the push path too, but here we guard
      -- explicitly since LEFT JOIN can produce multiple NULL sub rows if
      -- the caregiver has zero subscriptions — exactly one NULL row per
      -- caregiver because of the LEFT JOIN cardinality).
      -- -------------------------------------------------------------------
      INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
          v_rec.caregiver_user_id,
          'Missed dose alert',
          v_rec.caregiver_name || '''s contact missed: ' || v_rec.med_name,
          'warning'
        );

      RAISE LOG '[marinloop Cron] Caregiver in-app fallback: dose_log=%, caregiver_user=%',
        v_rec.dose_log_id, v_rec.caregiver_user_id;
    END IF;

    -- Record alert sent (ON CONFLICT DO NOTHING guards concurrent runs)
    INSERT INTO public.caregiver_alert_log
      (dose_log_id, subscription_id, caregiver_user_id)
    VALUES
      (v_rec.dose_log_id, v_rec.subscription_id, v_rec.caregiver_user_id)
    ON CONFLICT (dose_log_id, caregiver_user_id) DO NOTHING;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- 7-day rolling cleanup of the alert log (cheap: called every 15 min)
  -- -------------------------------------------------------------------------
  DELETE FROM public.caregiver_alert_log
    WHERE sent_at < now_utc - interval '7 days';
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. pg_cron JOB — idempotent (unschedule then schedule, mirrors 023)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- pg_cron may not be enabled on all environments; skip gracefully.
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '[marinloop] pg_cron extension not available — skipping caregiver alert cron job';
    RETURN;
  END IF;

  -- Unschedule any previous version of this job before (re)creating it.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marinloop-caregiver-alerts') THEN
    PERFORM cron.unschedule('marinloop-caregiver-alerts');
  END IF;
END;
$$;

-- Schedule separately (cannot call cron.schedule inside a DO block that
-- references cron.job conditionally — keep them at top level for clarity).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'marinloop-caregiver-alerts',
      '*/15 * * * *',
      $c$ SELECT public.notify_caregivers_missed_dose(); $c$
    );
    RAISE NOTICE '[marinloop] Scheduled marinloop-caregiver-alerts (every 15 min)';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE WARNING '[marinloop] Could not schedule marinloop-caregiver-alerts: %', SQLERRM;
END;
$$;
