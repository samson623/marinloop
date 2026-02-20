create table if not exists public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);

create or replace function public.increment_ai_daily_usage(p_user_id uuid, p_usage_date date)
returns integer language sql security definer as $$
with ins as (
  insert into public.ai_daily_usage (user_id, usage_date, request_count)
  values (p_user_id, p_usage_date, 1)
  on conflict (user_id, usage_date) do update set request_count = ai_daily_usage.request_count + 1
  returning request_count
)
select request_count from ins
$$;
