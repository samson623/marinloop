-- 044_trial_notifications.sql
-- Adds an hourly pg_cron job to expire trialing subscriptions whose trial_ends_at has passed.
-- Safety net for missed Stripe webhooks: sets status = 'expired' and tier = 'free'.

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('trial-expiry-cleanup');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'trial-expiry-cleanup',
      '0 * * * *',
      $sql$UPDATE public.subscriptions SET status = 'expired', tier = 'free', updated_at = NOW() WHERE status = 'trialing' AND trial_ends_at < NOW()$sql$
    );
  END IF;
END;
$outer$;
