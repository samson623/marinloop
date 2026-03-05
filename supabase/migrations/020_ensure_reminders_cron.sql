-- =============================================================================
-- Ensure marinloop-dispatch-reminders cron job is correctly scheduled.
-- Idempotent: removes any stale job and re-creates it fresh.
-- Apply this if reminders are created but push notifications are not firing.
-- =============================================================================

-- Drop existing job (safe if absent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marinloop-dispatch-reminders') THEN
    PERFORM cron.unschedule('marinloop-dispatch-reminders');
    RAISE NOTICE '[020] Removed stale marinloop-dispatch-reminders job — will re-create.';
  ELSE
    RAISE NOTICE '[020] No existing marinloop-dispatch-reminders job found — will create fresh.';
  END IF;
END;
$$;

-- Re-create with correct schedule
SELECT cron.schedule(
  'marinloop-dispatch-reminders',
  '* * * * *',
  $c$ SELECT public.dispatch_due_reminders(); $c$
);

-- Confirm
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'marinloop-dispatch-reminders';
  IF job_id IS NOT NULL THEN
    RAISE NOTICE '[020] marinloop-dispatch-reminders scheduled OK (jobid=%).', job_id;
  ELSE
    RAISE WARNING '[020] FAILED to schedule marinloop-dispatch-reminders!';
  END IF;
END;
$$;
