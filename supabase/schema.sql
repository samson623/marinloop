create extension if not exists "uuid-ossp";

create type public.plan_type as enum ('free', 'pro', 'family');
create type public.dose_status as enum ('taken', 'late', 'missed', 'skipped');
create type public.notification_type as enum ('info', 'warning', 'success', 'error');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  plan public.plan_type not null default 'free',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.medications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text,
  instructions text,
  warnings text,
  freq integer not null default 1 check (freq >= 1 and freq <= 24),
  color text not null default 'sky',
  icon text,
  barcode text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.schedules (
  id uuid primary key default uuid_generate_v4(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  time text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  days integer[] not null default '{0,1,2,3,4,5,6}',
  food_context_minutes integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.dose_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete set null,
  taken_at timestamptz not null default timezone('utc', now()),
  status public.dose_status not null default 'taken',
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  doctor text,
  location text,
  commute_minutes integer not null default 0 check (commute_minutes >= 0),
  start_time timestamptz not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.refills (
  id uuid primary key default uuid_generate_v4(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_quantity integer not null default 0 check (current_quantity >= 0),
  total_quantity integer not null default 30 check (total_quantity > 0),
  refill_date date,
  pharmacy text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (medication_id, user_id)
);

create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  medication_id uuid references public.medications(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type public.notification_type not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_medications_user_id on public.medications(user_id);
create index if not exists idx_schedules_user_id_time on public.schedules(user_id, time);
create index if not exists idx_schedules_medication_id on public.schedules(medication_id);
create index if not exists idx_dose_logs_user_taken_at on public.dose_logs(user_id, taken_at desc);
create index if not exists idx_dose_logs_med_schedule on public.dose_logs(medication_id, schedule_id);
create index if not exists idx_appointments_user_start_time on public.appointments(user_id, start_time);
create index if not exists idx_refills_user_medication on public.refills(user_id, medication_id);
create index if not exists idx_notes_user_created_at on public.notes(user_id, created_at desc);
create index if not exists idx_notifications_user_read_created on public.notifications(user_id, read, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_user_id_from_auth()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    avatar_url = excluded.avatar_url,
    updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_medications_updated_at on public.medications;
create trigger trg_medications_updated_at before update on public.medications
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_schedules_updated_at on public.schedules;
create trigger trg_schedules_updated_at before update on public.schedules
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at before update on public.appointments
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_refills_updated_at on public.refills;
create trigger trg_refills_updated_at before update on public.refills
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at before update on public.notes
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at before update on public.notifications
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_medications_user_id on public.medications;
create trigger trg_medications_user_id before insert on public.medications
for each row execute procedure public.set_user_id_from_auth();

drop trigger if exists trg_schedules_user_id on public.schedules;
create trigger trg_schedules_user_id before insert on public.schedules
for each row execute procedure public.set_user_id_from_auth();

drop trigger if exists trg_dose_logs_user_id on public.dose_logs;
create trigger trg_dose_logs_user_id before insert on public.dose_logs
for each row execute procedure public.set_user_id_from_auth();

drop trigger if exists trg_appointments_user_id on public.appointments;
create trigger trg_appointments_user_id before insert on public.appointments
for each row execute procedure public.set_user_id_from_auth();

drop trigger if exists trg_refills_user_id on public.refills;
create trigger trg_refills_user_id before insert on public.refills
for each row execute procedure public.set_user_id_from_auth();

drop trigger if exists trg_notes_user_id on public.notes;
create trigger trg_notes_user_id before insert on public.notes
for each row execute procedure public.set_user_id_from_auth();

drop trigger if exists trg_notifications_user_id on public.notifications;
create trigger trg_notifications_user_id before insert on public.notifications
for each row execute procedure public.set_user_id_from_auth();

alter table public.profiles enable row level security;
alter table public.medications enable row level security;
alter table public.schedules enable row level security;
alter table public.dose_logs enable row level security;
alter table public.appointments enable row level security;
alter table public.refills enable row level security;
alter table public.notes enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists medications_select_own on public.medications;
create policy medications_select_own on public.medications
for select using (auth.uid() = user_id);

drop policy if exists medications_insert_own on public.medications;
create policy medications_insert_own on public.medications
for insert with check (auth.uid() = user_id);

drop policy if exists medications_update_own on public.medications;
create policy medications_update_own on public.medications
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists medications_delete_own on public.medications;
create policy medications_delete_own on public.medications
for delete using (auth.uid() = user_id);

drop policy if exists schedules_select_own on public.schedules;
create policy schedules_select_own on public.schedules
for select using (auth.uid() = user_id);

drop policy if exists schedules_insert_own on public.schedules;
create policy schedules_insert_own on public.schedules
for insert with check (auth.uid() = user_id);

drop policy if exists schedules_update_own on public.schedules;
create policy schedules_update_own on public.schedules
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists schedules_delete_own on public.schedules;
create policy schedules_delete_own on public.schedules
for delete using (auth.uid() = user_id);

drop policy if exists dose_logs_select_own on public.dose_logs;
create policy dose_logs_select_own on public.dose_logs
for select using (auth.uid() = user_id);

drop policy if exists dose_logs_insert_own on public.dose_logs;
create policy dose_logs_insert_own on public.dose_logs
for insert with check (auth.uid() = user_id);

drop policy if exists dose_logs_update_own on public.dose_logs;
create policy dose_logs_update_own on public.dose_logs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists dose_logs_delete_own on public.dose_logs;
create policy dose_logs_delete_own on public.dose_logs
for delete using (auth.uid() = user_id);

drop policy if exists appointments_select_own on public.appointments;
create policy appointments_select_own on public.appointments
for select using (auth.uid() = user_id);

drop policy if exists appointments_insert_own on public.appointments;
create policy appointments_insert_own on public.appointments
for insert with check (auth.uid() = user_id);

drop policy if exists appointments_update_own on public.appointments;
create policy appointments_update_own on public.appointments
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists appointments_delete_own on public.appointments;
create policy appointments_delete_own on public.appointments
for delete using (auth.uid() = user_id);

drop policy if exists refills_select_own on public.refills;
create policy refills_select_own on public.refills
for select using (auth.uid() = user_id);

drop policy if exists refills_insert_own on public.refills;
create policy refills_insert_own on public.refills
for insert with check (auth.uid() = user_id);

drop policy if exists refills_update_own on public.refills;
create policy refills_update_own on public.refills
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists refills_delete_own on public.refills;
create policy refills_delete_own on public.refills
for delete using (auth.uid() = user_id);

drop policy if exists notes_select_own on public.notes;
create policy notes_select_own on public.notes
for select using (auth.uid() = user_id);

drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own on public.notes
for insert with check (auth.uid() = user_id);

drop policy if exists notes_update_own on public.notes;
create policy notes_update_own on public.notes
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notes_delete_own on public.notes;
create policy notes_delete_own on public.notes
for delete using (auth.uid() = user_id);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select using (auth.uid() = user_id);

drop policy if exists notifications_insert_own on public.notifications;
create policy notifications_insert_own on public.notifications
for insert with check (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
for delete using (auth.uid() = user_id);

create or replace function public.create_medication_bundle(
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
returns uuid
language plpgsql
security invoker
as $$
declare
  auth_user_id uuid := auth.uid();
  med_id uuid;
  t text;
begin
  if auth_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.medications (
    user_id, name, dosage, instructions, warnings, freq, color, icon
  ) values (
    auth_user_id, medication_name, medication_dosage, medication_instructions,
    medication_warnings, medication_freq, medication_color, medication_icon
  ) returning id into med_id;

  foreach t in array schedule_times loop
    insert into public.schedules (
      medication_id, user_id, time, days, food_context_minutes, active
    ) values (
      med_id, auth_user_id, t, schedule_days, 0, true
    );
  end loop;

  insert into public.refills (
    medication_id, user_id, current_quantity, total_quantity, refill_date, pharmacy
  ) values (
    med_id, auth_user_id, refill_current_quantity, refill_total_quantity, refill_date, refill_pharmacy
  )
  on conflict (medication_id, user_id)
  do update set
    current_quantity = excluded.current_quantity,
    total_quantity = excluded.total_quantity,
    refill_date = excluded.refill_date,
    pharmacy = excluded.pharmacy,
    updated_at = timezone('utc', now());

  return med_id;
end;
$$;