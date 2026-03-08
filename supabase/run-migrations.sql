-- ============================================================
-- MarinLoop: Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 001: Barcode column for medications
ALTER TABLE public.medications
ADD COLUMN IF NOT EXISTS barcode text;
CREATE INDEX IF NOT EXISTS idx_medications_barcode ON public.medications(barcode)
WHERE barcode IS NOT NULL;

-- 002: Push subscriptions + update policy
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_info text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS trg_push_subscriptions_user_id ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_user_id BEFORE INSERT ON public.push_subscriptions
FOR EACH ROW EXECUTE PROCEDURE public.set_user_id_from_auth();
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- 003: AI conversations (GPT-5 nano)
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  created_at timestamptz not null default timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_created ON public.ai_conversations(user_id, created_at desc);
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_conversations_select_own ON public.ai_conversations;
CREATE POLICY ai_conversations_select_own ON public.ai_conversations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS ai_conversations_insert_own ON public.ai_conversations;
CREATE POLICY ai_conversations_insert_own ON public.ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS ai_conversations_delete_own ON public.ai_conversations;
CREATE POLICY ai_conversations_delete_own ON public.ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- 004: Fix create_medication_bundle (rename current_user → auth_user_id)
CREATE OR REPLACE FUNCTION public.create_medication_bundle(
  medication_name text,
  medication_dosage text,
  medication_instructions text,
  medication_warnings text,
  medication_freq integer,
  medication_color text,
  medication_icon text,
  schedule_times text[],
  schedule_days integer[],
  refill_current_quantity integer,
  refill_total_quantity integer,
  refill_date date,
  refill_pharmacy text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  auth_user_id uuid := auth.uid();
  med_id uuid;
  t text;
BEGIN
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.medications (
    user_id, name, dosage, instructions, warnings, freq, color, icon
  ) VALUES (
    auth_user_id, medication_name, medication_dosage, medication_instructions,
    medication_warnings, medication_freq, medication_color, medication_icon
  ) RETURNING id INTO med_id;

  FOREACH t IN ARRAY schedule_times LOOP
    INSERT INTO public.schedules (
      medication_id, user_id, time, days, food_context_minutes, active
    ) VALUES (
      med_id, auth_user_id, t, schedule_days, 0, true
    );
  END LOOP;

  INSERT INTO public.refills (
    medication_id, user_id, current_quantity, total_quantity, refill_date, pharmacy
  ) VALUES (
    med_id, auth_user_id, refill_current_quantity, refill_total_quantity, refill_date, refill_pharmacy
  )
  ON CONFLICT (medication_id, user_id)
  DO UPDATE SET
    current_quantity = excluded.current_quantity,
    total_quantity = excluded.total_quantity,
    refill_date = excluded.refill_date,
    pharmacy = excluded.pharmacy,
    updated_at = timezone('utc', now());

  RETURN med_id;
END;
$$;

-- 005: AI daily usage tracking (no RLS - Edge Function uses service role)
CREATE TABLE IF NOT EXISTS public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);

-- RPC for atomic increment (Edge Function uses service role)
CREATE OR REPLACE FUNCTION public.increment_ai_daily_usage(p_user_id uuid, p_usage_date date)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT request_count FROM (
    INSERT INTO public.ai_daily_usage (user_id, usage_date, request_count)
    VALUES (p_user_id, p_usage_date, 1)
    ON CONFLICT (user_id, usage_date) DO UPDATE
    SET request_count = ai_daily_usage.request_count + 1
    RETURNING request_count
  ) sub;
$$;

-- 006: Add timezone to profiles so push notifications fire in the patient's local time.
alter table public.profiles
  add column if not exists timezone text not null default 'America/Chicago';

comment on column public.profiles.timezone is 'IANA timezone (e.g. America/Chicago). Used by the push notification cron dispatcher to convert schedule HH:MM into real-world wall-clock time.';

-- 007: Deduplication log for push notification dispatches.
create table if not exists public.notification_dispatch_log (
  schedule_id   uuid not null references public.schedules(id) on delete cascade,
  minute_bucket timestamptz not null,
  created_at    timestamptz not null default timezone('utc', now()),
  primary key (schedule_id, minute_bucket)
);

create index if not exists idx_dispatch_log_created_at
  on public.notification_dispatch_log(created_at);

comment on table public.notification_dispatch_log is 'Ensures each schedule fires at most once per minute. The cron job inserts with ON CONFLICT DO NOTHING; if 0 rows inserted, the notification was already dispatched.';

-- 008: MarinLoop Push Notification Cron Dispatcher
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

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
  total_skipped int := 0;
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
    raise warning '[MarinLoop Cron] ❌ MISSING vault secrets! supabase_url=%, service_role_key=%. Run setup-push.sql.',
      case when supabase_url is null then 'NULL' else 'SET' end,
      case when service_role_key is null then 'NULL' else 'SET' end;
    return;
  end if;

  raise log '[MarinLoop Cron] ▶ Starting dispatch at % UTC', to_char(now_utc, 'HH24:MI:SS');

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
      and to_char(now_utc at time zone coalesce(p.timezone, 'America/Chicago'), 'HH24:MI') = s.time
      and extract(dow from now_utc at time zone coalesce(p.timezone, 'America/Chicago'))::int = any(s.days)
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

      raise log '[MarinLoop Cron] ✅ Dispatched "%" to user % (tz=%, time=%)',
        rec.medication_name, rec.user_id, rec.user_timezone, rec.schedule_time;
    else
      total_skipped := total_skipped + 1;
      raise log '[MarinLoop Cron] ⏭ Already dispatched "%" for user % — skipping',
        rec.medication_name, rec.user_id;
    end if;
  end loop;

  if total_due = 0 then
    raise debug '[MarinLoop Cron] No due schedules at % UTC', to_char(now_utc, 'HH24:MI');
  else
    raise log '[MarinLoop Cron] 📊 Due=%, Dispatched=%, Skipped=%',
      total_due, total_dispatched, total_skipped;
  end if;

  -- Cleanup old dispatch log entries
  delete from public.notification_dispatch_log
    where created_at < now_utc - interval '48 hours';
end;
$$;

-- Remove old cron jobs safely (ignore errors if they don't exist yet)
DO $$ BEGIN PERFORM cron.unschedule('medflow-push-dispatcher'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('medflow-dispatch-log-cleanup'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Schedule the job: every minute
select cron.schedule(
  'marinloop-push-dispatcher',
  '* * * * *',
  $$ select public.dispatch_due_notifications(); $$
);

-- Cleanup old dispatch logs weekly as an extra safety net
select cron.schedule(
  'marinloop-dispatch-log-cleanup',
  '0 3 * * 0',
  $$ delete from public.notification_dispatch_log where created_at < now() - interval '7 days'; $$
);
