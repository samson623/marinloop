-- =============================================================================
-- Migration 015: Anti-pause keepalive cron
-- =============================================================================
-- Supabase free tier pauses projects after 7 days of zero DB activity.
-- This trivial SELECT ensures the database is touched at least once per hour
-- even if all users unsubscribe from push or have no scheduled doses.
-- pg_cron runs inside PostgreSQL — does NOT count against edge function
-- invocation limits. Cost: essentially zero.
-- =============================================================================

select cron.schedule(
  'marinloop-keepalive',
  '0 * * * *',     -- once per hour, at :00
  $$ select 1; $$  -- trivial no-op, just keeps the project alive
);
