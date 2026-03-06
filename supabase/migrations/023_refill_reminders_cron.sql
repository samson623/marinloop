-- =============================================================================
-- marinloop Refill Reminders Cron (Migration 023)
-- =============================================================================
-- Creates check_refill_reminders() and a daily 09:00 UTC pg_cron job.
-- For each user's medications, calculates days_left = floor(current_quantity / freq).
-- If days_left IN (7, 3) and no notification was already sent today for that
-- user+medication+threshold, inserts an in-app notification and fires a push.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_refill_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  rec              record;
  supabase_url     text;
  service_role_key text;
  now_utc          timestamptz := now();
  today_date       date        := current_date;
  already_sent     boolean;
  notif_title      text;
  notif_message    text;
  has_subs         boolean;
BEGIN
  -- Read vault secrets (same fallback pattern as existing cron functions)
  supabase_url     := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF supabase_url IS NULL OR supabase_url = '' THEN
    SELECT decrypted_secret INTO supabase_url
      FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  END IF;
  IF service_role_key IS NULL OR service_role_key = '' THEN
    SELECT decrypted_secret INTO service_role_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  END IF;

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING '[marinloop Cron] Missing vault secrets for refill reminders';
    RETURN;
  END IF;

  -- Iterate over every medication that has a refill record
  FOR rec IN
    SELECT
      m.id          AS medication_id,
      m.user_id     AS user_id,
      m.name        AS med_name,
      m.freq        AS freq,
      r.current_quantity AS current_quantity,
      FLOOR(r.current_quantity::numeric / GREATEST(m.freq, 1))::int AS days_left
    FROM public.medications m
    JOIN public.refills r ON r.medication_id = m.id
    WHERE
      m.freq > 0
      AND r.current_quantity > 0
      AND FLOOR(r.current_quantity::numeric / GREATEST(m.freq, 1))::int IN (7, 3)
  LOOP
    notif_title   := 'Refill ' || rec.med_name;
    notif_message := rec.med_name || ' runs out in ' || rec.days_left || ' days. Time to refill.';

    -- Deduplication: only notify once per user+medication+threshold per calendar day.
    -- We detect duplicates by checking for a notification with matching title created today.
    SELECT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id  = rec.user_id
        AND n.title    = notif_title
        AND n.created_at >= today_date::timestamptz
        AND n.created_at <  (today_date + 1)::timestamptz
    ) INTO already_sent;

    IF already_sent THEN
      CONTINUE;
    END IF;

    -- Always insert in-app notification (visible on next app open)
    INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (rec.user_id, notif_title, notif_message, 'warning');

    -- Also fire a push notification if the user has subscriptions
    SELECT EXISTS (
      SELECT 1 FROM public.push_subscriptions WHERE user_id = rec.user_id
    ) INTO has_subs;

    IF has_subs THEN
      PERFORM net.http_post(
        url     := supabase_url || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body    := jsonb_build_object(
          'user_id', rec.user_id,
          'title',   notif_title,
          'body',    notif_message,
          'url',     '/meds',
          'tag',     'refill-' || rec.medication_id::text
        )
      );
    END IF;

    RAISE LOG '[marinloop Cron] Refill reminder sent for "%" to user % (days_left=%, push=%)',
      rec.med_name, rec.user_id, rec.days_left, has_subs;
  END LOOP;
END;
$$;

-- Schedule the cron: daily at 09:00 UTC (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marinloop-refill-reminders') THEN
    PERFORM cron.unschedule('marinloop-refill-reminders');
  END IF;
END;
$$;

SELECT cron.schedule(
  'marinloop-refill-reminders',
  '0 9 * * *',
  $c$ SELECT public.check_refill_reminders(); $c$
);
