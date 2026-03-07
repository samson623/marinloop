-- =============================================================================
-- Migration 034: Comprehensive RLS Audit — Close All Policy Gaps
-- =============================================================================
--
-- This migration is the result of a full audit of every user-data table in the
-- marinloop database. It adds any RLS policies that were missing from earlier
-- migrations, enables RLS on system tables that were created without it, and
-- documents the intentional policy decisions for tables that do NOT follow the
-- standard four-policy pattern.
--
-- Audit methodology:
--   For each table, we verified:
--     1. ALTER TABLE x ENABLE ROW LEVEL SECURITY;
--     2. select_own  — auth.uid() = user_id  (FOR SELECT)
--     3. insert_own  — auth.uid() = user_id  (FOR INSERT WITH CHECK)
--     4. update_own  — auth.uid() = user_id  (FOR UPDATE USING + WITH CHECK)
--     5. delete_own  — auth.uid() = user_id  (FOR DELETE USING)
--
-- Tables with intentionally different or reduced policies are documented inline.
--
-- All blocks use IF NOT EXISTS checks against pg_policies so this migration is
-- safe to re-run on a database where some policies may already exist.
-- =============================================================================


-- =============================================================================
-- 1. TABLE: profiles
--    Created in: 000_initial_schema.sql
--    Gap: Missing delete_own policy.
--    Rationale: Users should be able to delete their own profile row (the
--    delete_account_and_data() SECURITY DEFINER function does this, but RLS
--    should also permit a direct DELETE so the right-to-erasure path is
--    correctly enforced at the policy layer independent of any function).
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_delete_own'
  ) THEN
    CREATE POLICY profiles_delete_own ON public.profiles
      FOR DELETE
      USING (auth.uid() = id);
  END IF;
END $$;


-- =============================================================================
-- 2. TABLE: ai_conversations
--    Created in: 003_ai_conversations.sql
--    Gap: Missing update_own policy.
--    Rationale: AI conversation content is sensitive PHI-adjacent data.
--    Users should be able to update their own conversation rows (e.g., for
--    any future edit functionality). Without an update policy, any UPDATE
--    issued by the authenticated user would be silently blocked by RLS.
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ai_conversations'
      AND policyname = 'ai_conversations_update_own'
  ) THEN
    CREATE POLICY ai_conversations_update_own ON public.ai_conversations
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================================================
-- 3. TABLE: ai_daily_usage
--    Created in: 005_ai_daily_usage.sql; RLS/select added in 011.
--    Gaps: Missing insert_own, update_own, delete_own policies.
--
--    Design note on insert/update:
--      The increment_ai_daily_usage() function is SECURITY DEFINER and bypasses
--      RLS for writes. That remains the correct path for rate-limit counting.
--      However, we must still add insert_own and update_own so that:
--        (a) the RLS layer does not block a direct INSERT/UPDATE if the function
--            is ever changed to SECURITY INVOKER in the future, and
--        (b) the policy set is complete for audit purposes.
--
--    Design note on delete:
--      Users must be able to delete their own usage rows for GDPR Art. 17
--      right-to-erasure (delete_account_and_data() handles bulk deletion via
--      SECURITY DEFINER, but direct RLS delete_own is required so that any
--      future self-service erasure endpoint works without bypassing RLS).
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ai_daily_usage'
      AND policyname = 'ai_daily_usage_insert_own'
  ) THEN
    CREATE POLICY ai_daily_usage_insert_own ON public.ai_daily_usage
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ai_daily_usage'
      AND policyname = 'ai_daily_usage_update_own'
  ) THEN
    CREATE POLICY ai_daily_usage_update_own ON public.ai_daily_usage
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ai_daily_usage'
      AND policyname = 'ai_daily_usage_delete_own'
  ) THEN
    CREATE POLICY ai_daily_usage_delete_own ON public.ai_daily_usage
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================================================
-- 4. TABLE: notification_dispatch_log
--    Created in: 007_notification_dispatch_log.sql
--    Gap: RLS is NOT enabled. The table has no user_id column.
--
--    Design decision:
--      This is a pure system/infrastructure table. It has no user_id column —
--      it stores (schedule_id, minute_bucket) pairs used by the pg_cron
--      dispatcher for at-most-once delivery deduplication. All writes are done
--      by dispatch_due_notifications() which is SECURITY DEFINER and runs as
--      the postgres role. No authenticated user should ever read or write this
--      table directly.
--
--      We enable RLS and add NO policies. With RLS enabled and no policies,
--      the table is deny-by-default for all roles except superuser/postgres.
--      This is the correct security posture for a cron-infrastructure table.
-- =============================================================================

ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;

-- Intentionally no SELECT/INSERT/UPDATE/DELETE policies.
-- All access is via SECURITY DEFINER functions (dispatch_due_notifications)
-- which run as the postgres role and bypass RLS. Direct user access is denied.


-- =============================================================================
-- 5. TABLE: beta_feedback
--    Created in: 014_beta_feedback.sql
--    Gaps: Missing update_own and delete_own policies.
--
--    Design decision on update_own:
--      Users should be able to correct a just-submitted feedback entry (e.g.,
--      fix a typo in a bug report). Adding update_own is safe and expected.
--
--    Design decision on delete_own:
--      Users should be able to retract their own feedback (right-to-erasure /
--      general user expectation). Adding delete_own is correct.
--
--    Note: No policy allows users to see OTHER users' feedback. The existing
--    beta_feedback_select_own policy (auth.uid() = user_id) is correct and
--    is NOT modified here.
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'beta_feedback'
      AND policyname = 'beta_feedback_update_own'
  ) THEN
    CREATE POLICY beta_feedback_update_own ON public.beta_feedback
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'beta_feedback'
      AND policyname = 'beta_feedback_delete_own'
  ) THEN
    CREATE POLICY beta_feedback_delete_own ON public.beta_feedback
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================================================
-- TABLES CONFIRMED FULLY COVERED — no changes needed
-- (documented here for audit trail completeness)
-- =============================================================================
--
-- medications           (000): select, insert, update, delete — COMPLETE
-- schedules             (000): select, insert, update, delete — COMPLETE
-- dose_logs             (000): select, insert, update, delete — COMPLETE
-- appointments          (000): select, insert, update, delete — COMPLETE
-- refills               (000): select, insert, update, delete — COMPLETE
-- notes                 (000): select, insert, update, delete — COMPLETE
-- notifications         (000): select, insert, update, delete — COMPLETE
-- push_subscriptions    (002): select, insert, update, delete — COMPLETE
-- reminders             (019): FOR ALL (covers select/insert/update/delete) — COMPLETE
-- care_connections      (024): FOR ALL (owner) + SELECT (caregiver email) — COMPLETE
-- providers             (024): FOR ALL — COMPLETE
-- vitals                (026): FOR ALL — COMPLETE
-- journal_entries       (027): FOR ALL — COMPLETE
-- symptoms              (028): FOR ALL — COMPLETE
--
-- =============================================================================
-- TABLES WITH INTENTIONALLY REDUCED POLICIES — documented decisions
-- =============================================================================
--
-- beta_invite_codes (013):
--   RLS enabled. One policy: SELECT for ALL (anon + authenticated) so that
--   the client can check if a code is valid before signup. No insert/update/
--   delete policies for regular users — all mutations go through the
--   redeem_beta_code() SECURITY DEFINER function or the service role (admin
--   dashboard). This is correct by design — do NOT add user write policies.
--
-- ai_daily_usage (005 + 011):
--   insert_own, update_own, delete_own added in this migration (above).
--   The increment_ai_daily_usage() SECURITY DEFINER function continues to be
--   the authoritative write path for rate-limit counting. The new policies
--   close the GDPR deletion gap and complete the policy set for future-proofing.
--
-- caregiver_alert_log (025):
--   RLS enabled. One SELECT policy: caregiver_user_id = auth.uid() (caregivers
--   can audit their own alert history). No insert/update/delete policies for
--   users — all writes are done by notify_caregivers_missed_dose() which is
--   SECURITY DEFINER. Adding a user delete_own here would be dangerous: users
--   could delete their own caregiver alert records, undermining the dedup
--   guarantee and causing duplicate notifications. Intentionally left with
--   read-only access for the caregiver.
--
-- notification_dispatch_log (007):
--   RLS enabled in this migration. No policies. Pure system table —
--   deny-by-default for all authenticated users. See section 4 above.
-- =============================================================================
