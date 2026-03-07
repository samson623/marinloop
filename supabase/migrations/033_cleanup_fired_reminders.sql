-- 033_cleanup_fired_reminders.sql
-- Adds a weekly pg_cron job to hard-delete fired reminders older than 30 days.
-- Runs every Sunday at 03:00 UTC.

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('marinloop-cleanup-fired-reminders');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'marinloop-cleanup-fired-reminders',
      '0 3 * * 0',
      $sql$DELETE FROM public.reminders WHERE fired = true AND fired_at < now() - interval '30 days'$sql$
    );
  END IF;
END;
$outer$;
