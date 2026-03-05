-- Migration 017: Secure admin stats at the database level
-- Revoke open access to the view, replace with a SECURITY DEFINER function
-- that enforces admin-only access inside the database (not just in the UI).

-- 1. Revoke the broad authenticated grant on the view
revoke select on public.v_beta_admin_summary from authenticated;

-- 2. Drop the old view (no longer needed)
drop view if exists public.v_beta_admin_summary;

-- 3. Create a SECURITY DEFINER function that returns stats only for the admin UID.
--    Runs as the postgres role (can see auth.users), but checks the calling
--    user's UID before returning any data — returns NULL for everyone else.
create or replace function public.get_beta_admin_stats()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select case
    when auth.uid() = 'b4f5d3fb-634c-4fe7-a2cb-36166e00ab3c'::uuid
    then json_build_object(
      'total_users',              (select count(*)::int from auth.users),
      'new_users_7d',             (select count(*)::int from auth.users
                                    where created_at > now() - interval '7 days'),
      'users_with_push',          (select count(distinct user_id)::int from public.push_subscriptions),
      'users_who_gave_feedback',  (select count(distinct user_id)::int from public.beta_feedback),
      'total_feedback_items',     (select count(*)::int from public.beta_feedback),
      'bug_reports',              (select count(*)::int from public.beta_feedback where type = 'bug'),
      'feature_requests',         (select count(*)::int from public.beta_feedback where type = 'feature')
    )
    else null
  end;
$$;

-- 4. Allow authenticated users to call the function (it self-enforces admin check)
grant execute on function public.get_beta_admin_stats() to authenticated;
