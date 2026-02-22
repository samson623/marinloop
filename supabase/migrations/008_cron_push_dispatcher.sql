-- =============================================================================
-- MedFlow Push Notification Cron Dispatcher
-- =============================================================================
-- This migration enables pg_cron + pg_net and creates a per-minute job that:
--   1. Finds schedules whose time matches "now" in the patient's IANA timezone
--   2. Filters by active=true, correct day-of-week, and existing push subscriptions
--   3. Deduplicates via notification_dispatch_log (ON CONFLICT DO NOTHING)
--   4. Calls the cron-dispatch-push Edge Function via pg_net with service-role key
-- =============================================================================

-- Enable extensions (safe to re-run; ignored if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The core dispatch function
create or replace function public.dispatch_due_notifications()
returns void
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  rec record;
  supabase_url text;
  service_role_key text;
  now_utc timestamptz := now();
  minute_trunc timestamptz := date_trunc('minute', now_utc);
  inserted_count int;
begin
  -- Read configuration from Supabase vault / env
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Fallback: read from supabase_functions.env if app.settings not configured
  if supabase_url is null or supabase_url = '' then
    select decrypted_secret into supabase_url
      from vault.decrypted_secrets
      where name = 'supabase_url'
      limit 1;
  end if;

  if service_role_key is null or service_role_key = '' then
    select decrypted_secret into service_role_key
      from vault.decrypted_secrets
      where name = 'service_role_key'
      limit 1;
  end if;

  -- If we still don't have config, abort silently (avoids error spam in logs)
  if supabase_url is null or service_role_key is null then
    raise warning '[MedFlow Cron] Missing supabase_url or service_role_key — skipping dispatch';
    return;
  end if;

  -- Find all due schedules
  for rec in
    select
      s.id         as schedule_id,
      s.user_id    as user_id,
      m.name       as medication_name,
      m.dosage     as medication_dosage,
      s.time       as schedule_time
    from public.schedules s
    join public.profiles p     on p.id = s.user_id
    join public.medications m  on m.id = s.medication_id
    where s.active = true
      -- Time match: current HH:MM in the user's timezone = schedule time
      and to_char(now_utc at time zone p.timezone, 'HH24:MI') = s.time
      -- Day-of-week match: current day in user's timezone is in the schedule's days array
      and extract(dow from now_utc at time zone p.timezone)::int = any(s.days)
      -- Only users who have at least one push subscription
      and exists (
        select 1 from public.push_subscriptions ps where ps.user_id = s.user_id
      )
  loop
    -- Deduplication: attempt insert. If conflict, this schedule was already dispatched this minute.
    insert into public.notification_dispatch_log (schedule_id, minute_bucket)
      values (rec.schedule_id, minute_trunc)
      on conflict (schedule_id, minute_bucket) do nothing;

    get diagnostics inserted_count = row_count;

    -- Only fire if we actually inserted (= first time this minute)
    if inserted_count > 0 then
      -- Fire-and-forget HTTP POST to cron-dispatch-push Edge Function
      perform net.http_post(
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
    end if;
  end loop;

  -- Cleanup: remove dispatch log entries older than 48 hours to keep the table small
  delete from public.notification_dispatch_log
    where created_at < now_utc - interval '48 hours';
end;
$$;

-- Schedule the job: every minute
select cron.schedule(
  'medflow-push-dispatcher',
  '* * * * *',
  $$ select public.dispatch_due_notifications(); $$
);

-- Cleanup old dispatch logs weekly as an extra safety net
select cron.schedule(
  'medflow-dispatch-log-cleanup',
  '0 3 * * 0',
  $$ delete from public.notification_dispatch_log where created_at < now() - interval '7 days'; $$
);
