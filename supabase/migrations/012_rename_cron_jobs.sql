-- =============================================================================
-- Migration 012: Rename cron jobs from medflow-* to marinloop-*
-- =============================================================================

-- Each pair: unschedule old name (exception-safe) then schedule new name.
-- Wrapped in exception blocks so if the old job doesn't exist (already renamed
-- or never created), the migration is idempotent and continues safely.
-- =============================================================================

-- 1. Push dispatcher (runs every minute — most critical)
DO $$ BEGIN
  PERFORM cron.unschedule('medflow-push-dispatcher');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'medflow-push-dispatcher not found, skipping';
END $$;

SELECT cron.schedule(
  'marinloop-push-dispatcher',
  '* * * * *',
  $cmd$ SELECT public.dispatch_due_notifications(); $cmd$
);

-- 2. Dispatch log cleanup (Sunday 03:00 UTC)
DO $$ BEGIN
  PERFORM cron.unschedule('medflow-dispatch-log-cleanup');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'medflow-dispatch-log-cleanup not found, skipping';
END $$;

SELECT cron.schedule(
  'marinloop-dispatch-log-cleanup',
  '0 3 * * 0',
  $cmd$ delete from public.notification_dispatch_log where created_at < now() - interval '7 days'; $cmd$
);

-- 3. AI usage retention (daily 04:00 UTC)
DO $$ BEGIN
  PERFORM cron.unschedule('medflow-ai-usage-retention');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'medflow-ai-usage-retention not found, skipping';
END $$;

SELECT cron.schedule(
  'marinloop-ai-usage-retention',
  '0 4 * * *',
  $cmd$ delete from public.ai_daily_usage where usage_date < current_date - interval '90 days'; $cmd$
);

-- 4. Push subscription cleanup (daily 05:00 UTC)
DO $$ BEGIN
  PERFORM cron.unschedule('medflow-push-subscription-cleanup');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'medflow-push-subscription-cleanup not found, skipping';
END $$;

SELECT cron.schedule(
  'marinloop-push-subscription-cleanup',
  '0 5 * * *',
  $cmd$ delete from public.push_subscriptions where updated_at < now() - interval '180 days'; $cmd$
);

-- =============================================================================
-- Update dispatch_due_notifications() to use [marinloop Cron] log prefix
-- =============================================================================
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
  -- Read configuration from app.settings (set via ALTER ROLE ... SET)
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
    RAISE WARNING '[marinloop Cron] Missing vault secrets (supabase_url=%, service_role_key=%) — run setup-push.sql to configure.',
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
      AND to_char(now_utc AT TIME ZONE coalesce(p.timezone, 'America/Chicago'), 'HH24:MI') = s.time
      -- Day-of-week match
      AND extract(dow FROM now_utc AT TIME ZONE coalesce(p.timezone, 'America/Chicago'))::int = ANY(s.days)
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
          'medication_dosage', coalesce(rec.medication_dosage, ''),
          'schedule_time', rec.schedule_time
        )
      );
      total_dispatched := total_dispatched + 1;

      RAISE LOG '[marinloop Cron] Dispatched push for "%" to user % (tz=%, time=%)',
        rec.medication_name, rec.user_id, rec.user_timezone, rec.schedule_time;
    END IF;
  END LOOP;

  IF total_due > 0 THEN
    RAISE LOG '[marinloop Cron] Due=%, Dispatched=%, Skipped(dedup)=%',
      total_due, total_dispatched, total_due - total_dispatched;
  END IF;

  -- Cleanup old dispatch log entries
  DELETE FROM public.notification_dispatch_log
    WHERE created_at < now_utc - interval '48 hours';
END;
$$;

-- Verification: should show 4 marinloop-* rows, 0 medflow-* rows
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'marinloop%' OR jobname LIKE 'medflow%'
ORDER BY jobname;
