-- =============================================================================
-- Fix dispatch_due_reminders() — improved fallback notification content
-- Also ensures snooze_reminder RPC and cron job are up to date.
-- Safe to run against a DB where 019 was applied via SQL editor.
-- All statements are CREATE OR REPLACE / idempotent.
-- =============================================================================

-- Updated snooze RPC (idempotent)
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

-- Updated dispatch function — improved fallback notification message
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
  -- Read vault secrets
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
          CASE WHEN rec.body <> '' THEN rec.body ELSE ('Reminder fired: ' || rec.title) END,
          'info'
        );
    END IF;

    RAISE LOG '[marinloop Cron] Reminder "%" fired for user % (push=%)',
      rec.title, rec.user_id, has_subs;
  END LOOP;

  -- 30-day cleanup of fired reminders
  DELETE FROM public.reminders
    WHERE fired = true AND fired_at < now_utc - interval '30 days';
END;
$$;

-- Ensure cron job is correctly scheduled (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marinloop-dispatch-reminders') THEN
    PERFORM cron.unschedule('marinloop-dispatch-reminders');
  END IF;
END;
$$;

SELECT cron.schedule(
  'marinloop-dispatch-reminders',
  '* * * * *',
  $c$ SELECT public.dispatch_due_reminders(); $c$
);
