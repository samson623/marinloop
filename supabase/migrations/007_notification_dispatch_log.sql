-- Deduplication log for push notification dispatches.
-- One row per (schedule_id, minute_bucket). The cron dispatcher uses
-- INSERT ... ON CONFLICT DO NOTHING to guarantee exactly-once delivery
-- per minute window even if pg_cron fires twice or a job overlaps.
create table if not exists public.notification_dispatch_log (
  schedule_id   uuid not null references public.schedules(id) on delete cascade,
  minute_bucket timestamptz not null,
  created_at    timestamptz not null default timezone('utc', now()),
  primary key (schedule_id, minute_bucket)
);

-- Index for fast cleanup of old rows
create index if not exists idx_dispatch_log_created_at
  on public.notification_dispatch_log(created_at);

comment on table public.notification_dispatch_log is 'Ensures each schedule fires at most once per minute. The cron job inserts with ON CONFLICT DO NOTHING; if 0 rows inserted, the notification was already dispatched.';
