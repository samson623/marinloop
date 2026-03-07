-- 031_notifications_retention.sql
-- Add retention cron jobs to prevent unbounded table growth.
-- Notifications older than 180 days are deleted daily at 03:00 UTC.
-- Notification dispatch log older than 90 days is deleted daily at 03:30 UTC.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Notifications cleanup (180 days)
    BEGIN
      PERFORM cron.unschedule('marinloop-notifications-cleanup');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Job doesn't exist yet, that's fine
    END;
    PERFORM cron.schedule(
      'marinloop-notifications-cleanup',
      '0 3 * * *',
      'DELETE FROM public.notifications WHERE created_at < now() - interval ''180 days'''
    );

    -- Notification dispatch log cleanup (90 days)
    BEGIN
      PERFORM cron.unschedule('marinloop-dispatch-log-cleanup');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Job doesn't exist yet, that's fine
    END;
    PERFORM cron.schedule(
      'marinloop-dispatch-log-cleanup',
      '30 3 * * *',
      'DELETE FROM public.notification_dispatch_log WHERE created_at < now() - interval ''90 days'''
    );
  END IF;
END;
$$;
