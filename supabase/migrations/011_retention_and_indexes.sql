-- =============================================================================
-- Migration 009: Data retention policies, missing indexes, and RLS
-- =============================================================================

-- 1. RLS on ai_daily_usage (missing from migration 005).
--    The increment_ai_daily_usage() function is SECURITY DEFINER and bypasses
--    RLS when writing, so no insert/update policy is needed.
--    We add a SELECT policy so the UI can display the user's own usage count.
alter table public.ai_daily_usage enable row level security;

drop policy if exists ai_daily_usage_select_own on public.ai_daily_usage;
create policy ai_daily_usage_select_own on public.ai_daily_usage
  for select using (auth.uid() = user_id);

-- 2. Index on usage_date for the daily retention DELETE.
--    Without this, the delete scans the entire table.
create index if not exists idx_ai_daily_usage_date
  on public.ai_daily_usage(usage_date);

-- 3. Index on push_subscriptions.updated_at for stale-device cleanup.
--    The edge function removes 404/410 endpoints in real time; this index
--    supports the cron that catches devices gone silent without a push attempt.
create index if not exists idx_push_subscriptions_updated_at
  on public.push_subscriptions(updated_at);

-- 4. Retention cron: purge ai_daily_usage rows older than 90 days.
--    Rate-limit counters older than 90 days are never needed for enforcement.
select cron.schedule(
  'marinloop-ai-usage-retention',
  '0 4 * * *',
  $$ delete from public.ai_daily_usage where usage_date < current_date - interval '90 days'; $$
);

-- 5. Retention cron: remove push subscriptions inactive for 180 days.
--    Subscriptions not refreshed in 180 days represent wiped or uninstalled
--    devices. Keeping them wastes push attempts and clutters the table.
select cron.schedule(
  'marinloop-push-subscription-cleanup',
  '0 5 * * *',
  $$ delete from public.push_subscriptions where updated_at < now() - interval '180 days'; $$
);
