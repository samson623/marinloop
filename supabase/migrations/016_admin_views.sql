-- =============================================================================
-- Migration 016: Admin stats view
-- =============================================================================
-- v_beta_admin_summary: aggregate stats for the admin dashboard card.
-- Created as postgres (owner), so auth.users is accessible via PostgREST.
-- No RLS — view is restricted by ADMIN_USER_ID check in ProfileView component.
-- =============================================================================

create or replace view public.v_beta_admin_summary as
select
  (select count(*)::int from auth.users)                                        as total_users,
  (select count(*)::int from auth.users
   where created_at > now() - interval '7 days')                               as new_users_7d,
  (select count(distinct user_id)::int from public.push_subscriptions)         as users_with_push,
  (select count(distinct user_id)::int from public.beta_feedback)              as users_who_gave_feedback,
  (select count(*)::int from public.beta_feedback)                             as total_feedback_items,
  (select count(*)::int from public.beta_feedback where type = 'bug')          as bug_reports,
  (select count(*)::int from public.beta_feedback where type = 'feature')      as feature_requests;

grant select on public.v_beta_admin_summary to authenticated;
