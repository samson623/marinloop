-- ============================================================
-- marinloop Push Notification: One-Click Setup
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor → New query
--
-- ⚠️ IMPORTANT: Replace the service role value before running.
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║ STEP 1: Enable extensions                               ║
-- ╚══════════════════════════════════════════════════════════╝

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ STEP 2: Store secrets in Vault                          ║
-- ╚══════════════════════════════════════════════════════════╝

delete from vault.secrets where name in ('supabase_url', 'service_role_key');

select vault.create_secret(
  'https://lcbdafnxwvqbziootvmi.supabase.co',
  'supabase_url',
  'Supabase URL for Cron Push Dispatcher'
);

select vault.create_secret(
  'REPLACE_ME_WITH_SERVICE_ROLE_KEY',
  'service_role_key',
  'Service Role Key for Cron Push Dispatcher'
);

select name,
       case when decrypted_secret is not null and decrypted_secret != ''
            then '✅ SET (' || left(decrypted_secret, 20) || '...)'
            else '❌ MISSING'
       end as status
from vault.decrypted_secrets
where name in ('supabase_url', 'service_role_key');

-- ╔══════════════════════════════════════════════════════════╗
-- ║ STEP 3: Create dispatcher function (matches migration 008) ║
-- ╚══════════════════════════════════════════════════════════╝

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
  total_due int := 0;
  total_dispatched int := 0;
begin
  -- Read configuration from app.settings (set via ALTER ROLE ... SET)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Fallback: read from Vault
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

  -- Abort with visible warning if config missing
  if supabase_url is null or service_role_key is null then
    raise warning '[marinloop Cron] Missing vault secrets (supabase_url=%, service_role_key=%) — run setup-push.sql to configure.',
      case when supabase_url is null then 'NULL' else 'SET' end,
      case when service_role_key is null then 'NULL' else 'SET' end;
    return;
  end if;

  -- Find all due schedules
  for rec in
    select
      s.id         as schedule_id,
      s.user_id    as user_id,
      m.name       as medication_name,
      m.dosage     as medication_dosage,
      s.time       as schedule_time,
      p.timezone   as user_timezone
    from public.schedules s
    join public.profiles p     on p.id = s.user_id
    join public.medications m  on m.id = s.medication_id
    where s.active = true
      -- Time match: current HH:MM in the user's timezone = schedule time
      and to_char(now_utc at time zone coalesce(p.timezone, 'America/Chicago'), 'HH24:MI') = s.time
      -- Day-of-week match
      and extract(dow from now_utc at time zone coalesce(p.timezone, 'America/Chicago'))::int = any(s.days)
      -- Only users who have at least one push subscription
      and exists (
        select 1 from public.push_subscriptions ps where ps.user_id = s.user_id
      )
  loop
    total_due := total_due + 1;

    -- Deduplication
    insert into public.notification_dispatch_log (schedule_id, minute_bucket)
      values (rec.schedule_id, minute_trunc)
      on conflict (schedule_id, minute_bucket) do nothing;

    get diagnostics inserted_count = row_count;

    if inserted_count > 0 then
      -- Fire HTTP POST to cron-dispatch-push Edge Function
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
      total_dispatched := total_dispatched + 1;

      raise log '[marinloop Cron] Dispatched push for "%" to user % (tz=%, time=%)',
        rec.medication_name, rec.user_id, rec.user_timezone, rec.schedule_time;
    end if;
  end loop;

  if total_due > 0 then
    raise log '[marinloop Cron] Due=%, Dispatched=%, Skipped(dedup)=%',
      total_due, total_dispatched, total_due - total_dispatched;
  end if;

  -- Cleanup old dispatch log entries
  delete from public.notification_dispatch_log
    where created_at < now_utc - interval '48 hours';
end;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ STEP 4: Register cron jobs                              ║
-- ╚══════════════════════════════════════════════════════════╝

do $$
begin
  perform cron.unschedule('marinloop-push-dispatcher');
exception when others then
  null;
end
$$;

do $$
begin
  perform cron.unschedule('marinloop-dispatch-log-cleanup');
exception when others then
  null;
end
$$;

select cron.schedule(
  'marinloop-push-dispatcher',
  '* * * * *',
  $$ select public.dispatch_due_notifications(); $$
);

select cron.schedule(
  'marinloop-dispatch-log-cleanup',
  '0 3 * * 0',
  $$ delete from public.notification_dispatch_log where created_at < now() - interval '7 days'; $$
);

-- Verification
select '✅ Setup complete! Cron jobs registered:' as result;
select jobname, schedule from cron.job where jobname like 'marinloop%';
