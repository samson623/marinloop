-- =============================================================================
-- Migration 013: Beta invite codes gate
-- =============================================================================
-- beta_invite_codes: admin-managed single-use codes that allow signup during
-- the closed beta period. Each code can optionally be labeled (e.g. 'batch-1')
-- to track distribution. Once redeemed, redeemed_by + redeemed_at are set.
--
-- The pre-check is performed client-side (anon SELECT) before calling
-- supabase.auth.signUp(). The atomic redemption uses a SECURITY DEFINER
-- function to prevent a race condition where two users claim the same code.
-- =============================================================================

create table if not exists public.beta_invite_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label       text,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at  timestamptz not null default timezone('utc', now())
);

create index if not exists idx_beta_invite_codes_code
  on public.beta_invite_codes(code);

alter table public.beta_invite_codes enable row level security;

-- Anon/authenticated users may check if a code exists and is unredeemed.
-- This is required for the client-side pre-check before signup.
drop policy if exists beta_codes_anon_check on public.beta_invite_codes;
create policy beta_codes_anon_check on public.beta_invite_codes
  for select
  using (true);

-- No insert/update/delete policies for regular users — all writes go through
-- the SECURITY DEFINER function below or the service role (dashboard).

-- Atomic redemption function — prevents race condition of two users claiming
-- the same code simultaneously. Returns true if the code was successfully
-- claimed, false if it was already redeemed by the time the UPDATE ran.
create or replace function public.redeem_beta_code(p_code text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
begin
  update public.beta_invite_codes
  set
    redeemed_by = p_user_id,
    redeemed_at = timezone('utc', now())
  where
    code = p_code
    and redeemed_at is null;

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

-- =============================================================================
-- Seed 20 initial codes (batch-1 and batch-2).
-- To generate more later, run in the Supabase SQL editor:
--
--   insert into public.beta_invite_codes (code, label)
--   select 'MLOOP-' || upper(substring(md5(random()::text), 1, 5)), 'batch-3'
--   from generate_series(1, 50)
--   on conflict (code) do nothing;
-- =============================================================================

insert into public.beta_invite_codes (code, label) values
  ('MLOOP-A1B2C', 'batch-1'),
  ('MLOOP-D3E4F', 'batch-1'),
  ('MLOOP-G5H6I', 'batch-1'),
  ('MLOOP-J7K8L', 'batch-1'),
  ('MLOOP-M9N0O', 'batch-1'),
  ('MLOOP-P1Q2R', 'batch-1'),
  ('MLOOP-S3T4U', 'batch-1'),
  ('MLOOP-V5W6X', 'batch-1'),
  ('MLOOP-Y7Z8A', 'batch-1'),
  ('MLOOP-B9C0D', 'batch-1'),
  ('MLOOP-E1F2G', 'batch-2'),
  ('MLOOP-H3I4J', 'batch-2'),
  ('MLOOP-K5L6M', 'batch-2'),
  ('MLOOP-N7O8P', 'batch-2'),
  ('MLOOP-Q9R0S', 'batch-2'),
  ('MLOOP-T1U2V', 'batch-2'),
  ('MLOOP-W3X4Y', 'batch-2'),
  ('MLOOP-Z5A6B', 'batch-2'),
  ('MLOOP-C7D8E', 'batch-2'),
  ('MLOOP-F9G0H', 'batch-2')
on conflict (code) do nothing;
