-- =============================================================================
-- Migration 051: Prevent duplicate push notifications for already-logged doses
-- =============================================================================
-- Updates public.dispatch_due_notifications() so that if a human has already
-- logged their dose early for the current day (any status: taken/late/etc.),
-- the cron job will skip sending a redundant "Time for your medication" push.
--
-- This fixes the issue where an early log plus a later push notification 
-- makes the user believe the push notification automatically marked the dose 
-- as "done" (because they see it as "done" in the app after tapping the push).
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
      -- NEW: Exclude schedules that already have a dose_log for today
      -- If the user already logged it (taken, late, missed, skipped), do not send a push reminder
      AND NOT EXISTS (
        SELECT 1 FROM public.dose_logs dl
        WHERE dl.schedule_id = s.id
          AND to_char(dl.taken_at AT TIME ZONE coalesce(p.timezone, 'America/Chicago'), 'YYYY-MM-DD') = 
              to_char(now_utc AT TIME ZONE coalesce(p.timezone, 'America/Chicago'), 'YYYY-MM-DD')
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
