-- ============================================================
-- MedFlow Push Notification: One-Click Setup
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor AFTER you have
-- deployed all Edge Functions.
--
-- This script:
--   1. Enables pg_cron, pg_net, and supabase_vault extensions
--   2. Stores your Supabase URL & Service Role Key in the vault
--   3. Creates/updates the dispatch function with enhanced logging
--   4. Registers the cron jobs
--
-- ⚠️ REPLACE the two placeholders below with YOUR actual values:
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 0: FILL IN YOUR VALUES BELOW                     ║
-- ╚══════════════════════════════════════════════════════════╝

-- Copy your Supabase URL from Dashboard → Settings → API → Project URL
-- Copy your Service Role Key from Dashboard → Settings → API → service_role key

\set SUPABASE_PROJECT_URL 'https://lcbdafnxwvqbziootvmi.supabase.co'
-- IMPORTANT: Replace 'YOUR_SERVICE_ROLE_KEY_HERE' with the actual key!
\set SERVICE_ROLE_KEY 'YOUR_SERVICE_ROLE_KEY_HERE'

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 1: Enable extensions                             ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 2: Store secrets in Vault                        ║
-- ╚══════════════════════════════════════════════════════════╝
-- Delete old vault entries first to avoid duplicates
DELETE FROM vault.secrets WHERE name IN ('supabase_url', 'service_role_key');

SELECT vault.create_secret(:'SUPABASE_PROJECT_URL', 'supabase_url', 'Supabase URL for Cron Push Dispatcher');
SELECT vault.create_secret(:'SERVICE_ROLE_KEY', 'service_role_key', 'Service Role Key for Cron Push Dispatcher');

-- Verify they were created:
SELECT name,
       CASE WHEN decrypted_secret IS NOT NULL AND decrypted_secret != ''
            THEN '✅ SET'
            ELSE '❌ MISSING'
       END AS status
FROM vault.decrypted_secrets
WHERE name IN ('supabase_url', 'service_role_key');

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 3: Create enhanced dispatch function              ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.dispatch_due_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  rec record;
  supabase_url text;
  service_role_key text;
  now_utc timestamptz := now();
  minute_trunc timestamptz := date_trunc('minute', now_utc);
  inserted_count int;
  total_due int := 0;
  total_dispatched int := 0;
BEGIN
  -- Read configuration from Supabase vault / env
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Fallback: read from Vault
  IF supabase_url IS NULL OR supabase_url = '' THEN
    SELECT decrypted_secret INTO supabase_url
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_url'
      LIMIT 1;
  END IF;

  IF service_role_key IS NULL OR service_role_key = '' THEN
    SELECT decrypted_secret INTO service_role_key
      FROM vault.decrypted_secrets
      WHERE name = 'service_role_key'
      LIMIT 1;
  END IF;

  -- Abort with visible warning if config missing
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING '[MedFlow Cron] ❌ Missing vault secrets (supabase_url=%, service_role_key=%) — skipping dispatch. Run setup-push.sql to configure.',
      CASE WHEN supabase_url IS NULL THEN 'NULL' ELSE 'SET' END,
      CASE WHEN service_role_key IS NULL THEN 'NULL' ELSE 'SET' END;
    RETURN;
  END IF;

  -- Find all due schedules
  FOR rec IN
    SELECT
      s.id         AS schedule_id,
      s.user_id    AS user_id,
      m.name       AS medication_name,
      m.dosage     AS medication_dosage,
      s.time       AS schedule_time,
      p.timezone   AS user_timezone
    FROM public.schedules s
    JOIN public.profiles p     ON p.id = s.user_id
    JOIN public.medications m  ON m.id = s.medication_id
    WHERE s.active = true
      -- Time match: current HH:MM in the user's timezone = schedule time
      AND to_char(now_utc AT TIME ZONE COALESCE(p.timezone, 'America/Chicago'), 'HH24:MI') = s.time
      -- Day-of-week match
      AND extract(dow FROM now_utc AT TIME ZONE COALESCE(p.timezone, 'America/Chicago'))::int = ANY(s.days)
      -- Only users who have at least one push subscription
      AND EXISTS (
        SELECT 1 FROM public.push_subscriptions ps WHERE ps.user_id = s.user_id
      )
  LOOP
    total_due := total_due + 1;

    -- Deduplication
    INSERT INTO public.notification_dispatch_log (schedule_id, minute_bucket)
      VALUES (rec.schedule_id, minute_trunc)
      ON CONFLICT (schedule_id, minute_bucket) DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;

    IF inserted_count > 0 THEN
      -- Fire HTTP POST to cron-dispatch-push Edge Function
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/cron-dispatch-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'schedule_id', rec.schedule_id,
          'user_id', rec.user_id,
          'medication_name', rec.medication_name,
          'medication_dosage', COALESCE(rec.medication_dosage, ''),
          'schedule_time', rec.schedule_time
        )
      );
      total_dispatched := total_dispatched + 1;

      RAISE LOG '[MedFlow Cron] ✅ Dispatched push for "%" to user % (tz=%, time=%)',
        rec.medication_name, rec.user_id, rec.user_timezone, rec.schedule_time;
    ELSE
      RAISE LOG '[MedFlow Cron] ⏭ Already dispatched "%" for user % this minute — skipping',
        rec.medication_name, rec.user_id;
    END IF;
  END LOOP;

  IF total_due = 0 THEN
    -- Only log at DEBUG level to avoid spamming — this fires every minute
    RAISE DEBUG '[MedFlow Cron] No due schedules at % UTC', to_char(now_utc, 'HH24:MI');
  ELSE
    RAISE LOG '[MedFlow Cron] 📊 Due=%, Dispatched=%, Skipped(dedup)=%',
      total_due, total_dispatched, total_due - total_dispatched;
  END IF;

  -- Cleanup old dispatch log entries
  DELETE FROM public.notification_dispatch_log
    WHERE created_at < now_utc - interval '48 hours';
END;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 4: Register cron jobs                             ║
-- ╚══════════════════════════════════════════════════════════╝

-- Remove old jobs first to avoid duplicates
SELECT cron.unschedule('medflow-push-dispatcher');
SELECT cron.unschedule('medflow-dispatch-log-cleanup');

-- Schedule: every minute
SELECT cron.schedule(
  'medflow-push-dispatcher',
  '* * * * *',
  $$ SELECT public.dispatch_due_notifications(); $$
);

-- Cleanup old dispatch logs weekly
SELECT cron.schedule(
  'medflow-dispatch-log-cleanup',
  '0 3 * * 0',
  $$ DELETE FROM public.notification_dispatch_log WHERE created_at < now() - interval '7 days'; $$
);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  DONE! Verify setup:                                    ║
-- ╚══════════════════════════════════════════════════════════╝

SELECT '✅ Setup complete! Cron jobs registered:' AS result;
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'medflow%';
