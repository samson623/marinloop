-- =============================================================================
-- Apply updated dispatch_due_reminders() — improved fallback notification text
-- =============================================================================
-- Use this in Supabase SQL Editor if migration 019 was already applied to
-- production BEFORE the fallback text was updated. The migration file
-- 019_reminders.sql is already updated for future applies.
--
-- STEP 1 — Check if 019 was already applied:
--
--   Option A (Dashboard): Project → Database → Migrations — see if 019 is listed.
--
--   Option B (CLI, from project root):  supabase migration list
--   Applied migrations show with a check. If 019_reminders is applied, run Step 2.
--
--   Option C (SQL Editor): Run this to list applied migrations:
--   SELECT * FROM supabase_migrations.schema_migrations
--   WHERE name LIKE '%019%' OR name LIKE '%reminders%'
--   ORDER BY version;
--
-- STEP 2 — If 019 was applied, run the CREATE OR REPLACE below to deploy
--   the improved fallback: when body is empty, notification message becomes
--   "Reminder fired: " || title instead of just title.
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
    UPDATE public.reminders
      SET fired = true, fired_at = now_utc
      WHERE id = rec.id;

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
          'title',   rec.title,
          'body',    CASE WHEN rec.body <> '' THEN rec.body ELSE rec.title END,
          'url',     '/timeline?reminders=open',
          'tag',     'reminder-' || rec.id::text
        )
      );
    ELSE
      -- Improved fallback: "Reminder fired: <title>" when body is empty
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

  DELETE FROM public.reminders
    WHERE fired = true AND fired_at < now_utc - interval '30 days';
END;
$$;
