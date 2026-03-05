-- =============================================================================
-- Migration 014: Beta feedback table
-- =============================================================================
-- Stores in-app feedback submitted by beta testers via the feedback widget.
-- Type is an enum: bug | feature | general.
-- Auto-captures route, user agent, and app version at submission time.
-- =============================================================================

do $$ begin
  create type public.feedback_type as enum ('bug', 'feature', 'general');
exception when duplicate_object then null;
end $$;

create table if not exists public.beta_feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          public.feedback_type not null default 'general',
  message       text not null check (char_length(message) >= 10 and char_length(message) <= 2000),
  current_route text,
  user_agent    text,
  app_version   text not null default '1.0.0-beta',
  created_at    timestamptz not null default timezone('utc', now())
);

create index if not exists idx_beta_feedback_user_created
  on public.beta_feedback(user_id, created_at desc);

create index if not exists idx_beta_feedback_type_created
  on public.beta_feedback(type, created_at desc);

alter table public.beta_feedback enable row level security;

-- Users can insert their own feedback
drop policy if exists beta_feedback_insert_own on public.beta_feedback;
create policy beta_feedback_insert_own on public.beta_feedback
  for insert
  with check (auth.uid() = user_id);

-- Users can read their own submitted feedback
drop policy if exists beta_feedback_select_own on public.beta_feedback;
create policy beta_feedback_select_own on public.beta_feedback
  for select
  using (auth.uid() = user_id);
