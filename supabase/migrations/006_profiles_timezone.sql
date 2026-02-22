-- Add timezone to profiles so push notifications fire in the patient's local time.
-- IANA timezone string (e.g. 'America/Chicago', 'Europe/London').
-- Default to 'America/Chicago' — the frontend will update it on first login.
alter table public.profiles
  add column if not exists timezone text not null default 'America/Chicago';

comment on column public.profiles.timezone is 'IANA timezone (e.g. America/Chicago). Used by the push notification cron dispatcher to convert schedule HH:MM into real-world wall-clock time.';
