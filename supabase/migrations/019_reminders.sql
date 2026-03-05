-- =============================================================================
-- marinloop Reminders
-- =============================================================================
-- Persistent user-created reminders. Cron fires push notifications at fire_at.
-- Mirrors the pattern from 008_cron_push_dispatcher.sql.
-- =============================================================================

-- Table
CREATE TABLE public.reminders (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  body       text        NOT NULL DEFAULT '',
  fire_at    timestamptz NOT NULL,
  fired      boolean     NOT NULL DEFAULT false,
  fired_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_reminders" ON public.reminders
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Fast index for cron polling
CREATE INDEX reminders_pending_idx ON public.reminders(fire_at) WHERE fired = false;

-- =============================================================================
-- Snooze RPC — atomic: insert new reminder + delete original in one transaction
-- =============================================================================
CREATE OR REPLACE FUNCTION public.snooze_reminder(
  p_reminder_id    uuid,
  p_snooze_minutes int DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orig   public.reminders%ROWTYPE;
  new_id uuid;
BEGIN
  SELECT * INTO orig
    FROM public.reminders
    WHERE id = p_reminder_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reminder not found or not owned by current user';
  END IF;

  INSERT INTO public.reminders (user_id, title, body, fire_at)
    VALUES (
      orig.user_id,
      orig.title,
      orig.body,
      now() + (p_snooze_minutes || ' minutes')::interval
    )
    RETURNING id INTO new_id;

  DELETE FROM public.reminders WHERE id = p_reminder_id;

  RETURN new_id;
END;
$$;

-- =============================================================================
-- Dispatch function — called by pg_cron every minute
-- Mirrors dispatch_due_notifications() from migration 008.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.dispatch_due_reminders()
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
  has_subs         boolean;
BEGIN
  -- Read vault secrets (same fallback pattern as dispatch_due_notifications)
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
    RAISE WARNING '[marinloop Cron] Missing vault secrets for reminder dispatch';
    RETURN;
  END IF;

  FOR rec IN
    SELECT r.id, r.user_id, r.title, r.body
    FROM   public.reminders r
    WHERE  r.fired   = false
      AND  r.fire_at <= now_utc
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Mark fired BEFORE HTTP call (at-most-once: miss > spam)
    UPDATE public.reminders
      SET fired = true, fired_at = now_utc
      WHERE id = rec.id;

    -- Check for push subscriptions
    SELECT EXISTS (
      SELECT 1 FROM public.push_subscriptions WHERE user_id = rec.user_id
    ) INTO has_subs;

    IF has_subs THEN
      -- Send push via existing send-push edge function
      PERFORM net.http_post(
        url     := supabase_url || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body    := jsonb_build_object(
          'user_id', rec.user_id,
          'title',   rec.title,
          'body',    CASE WHEN rec.body <> '' THEN rec.body ELSE rec.title END,
          'url',     '/timeline?reminders=open',
          'tag',     'reminder-' || rec.id::text
        )
      );
    ELSE
      -- Fallback: in-app notification so user sees it on next app open
      INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
          rec.user_id,
          rec.title,
          CASE WHEN rec.body <> '' THEN rec.body ELSE 'Your reminder has fired.' END,
          'info'
        );
    END IF;

    RAISE LOG '[marinloop Cron] Reminder "%" fired for user % (push=%)',
      rec.title, rec.user_id, has_subs;
  END LOOP;

  -- 30-day cleanup of fired reminders (runs every minute, cheap due to index)
  DELETE FROM public.reminders
    WHERE fired = true AND fired_at < now_utc - interval '30 days';
END;
$$;

-- =============================================================================
-- pg_cron job — idempotent (only schedules if not already present)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marinloop-dispatch-reminders') THEN
    PERFORM cron.schedule(
      'marinloop-dispatch-reminders',
      '* * * * *',
      $c$ SELECT public.dispatch_due_reminders(); $c$
    );
  END IF;
END;
$$;
