-- =============================================================================
-- Migration 041: Compliance-Grade Admin Panel
-- =============================================================================
-- Adds:
--   1. admin_access_log table  — append-only record of every admin RPC call
--   2. log_admin_access()      — internal logging helper (SECURITY DEFINER)
--   3. get_admin_overview_stats() — 14-field dashboard stats (SECURITY DEFINER)
--   4. get_admin_user_list()   — paginated user roster, counts only (SECURITY DEFINER)
--   5. search_admin_feedback() — filterable feedback rows (SECURITY DEFINER)
--   6. get_admin_ai_usage()    — per-user daily AI call counts (SECURITY DEFINER)
-- Updates:
--   7. marinloop-audit-cleanup cron   — retention 2 years → 6 years (HIPAA)
--   8. marinloop-feedback-retention   — NEW cron, 1-year retention for beta_feedback
--   9. marinloop-admin-access-log-retention — NEW cron, 6-year retention
--
-- PHI BOUNDARY — these functions ONLY touch:
--   auth.users, profiles, push_subscriptions (COUNT), beta_feedback,
--   ai_daily_usage, audit_logs (COUNT), admin_access_log
--
--   NEVER touch: medications, dose_logs, vitals, appointments, journal_entries,
--   symptoms, notes, ai_conversations, care_connections, providers,
--   emergency_contacts, refills, schedules
-- =============================================================================


-- =============================================================================
-- SECTION 1: admin_access_log table
-- =============================================================================
-- Append-only audit table. Zero RLS policies — readable ONLY via SECURITY
-- DEFINER functions, never directly by any authenticated or anon role.

CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE SET NULL intentional: HIPAA requires audit logs survive user deletion.
  -- CASCADE would purge the audit trail when the admin account is removed.
  admin_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name TEXT        NOT NULL,
  params        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  called_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time-ordered access queries
CREATE INDEX IF NOT EXISTS idx_admin_access_log_called_at
  ON public.admin_access_log(called_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_access_log_admin_user_id
  ON public.admin_access_log(admin_user_id, called_at DESC);

-- RLS enabled, zero policies — deny-by-default for all direct access
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 2: log_admin_access() — internal logging helper
-- =============================================================================
-- Called at the top of every admin SECURITY DEFINER function.
-- Silently no-ops for non-admin callers to prevent information leakage.
-- Never raises an exception — a logging failure must never block an admin read.

CREATE OR REPLACE FUNCTION public.log_admin_access(
  p_function_name TEXT,
  p_params        JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_UID CONSTANT UUID := 'b4f5d3fb-634c-4fe7-a2cb-36166e00ab3c'::uuid;
BEGIN
  -- Silent no-op for any non-admin caller (prevents info leakage via error)
  IF auth.uid() IS DISTINCT FROM ADMIN_UID THEN
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.admin_access_log (admin_user_id, function_name, params)
    VALUES (ADMIN_UID, p_function_name, COALESCE(p_params, '{}'::jsonb));
  EXCEPTION WHEN OTHERS THEN
    -- Log insert failure must never surface to the caller
    NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_access(TEXT, JSONB) TO authenticated;


-- =============================================================================
-- SECTION 3: get_admin_overview_stats()
-- =============================================================================
-- Returns 14 aggregate stats. Parity superset of get_beta_admin_stats().
-- Returns NULL for any non-admin caller.

CREATE OR REPLACE FUNCTION public.get_admin_overview_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_UID CONSTANT UUID := 'b4f5d3fb-634c-4fe7-a2cb-36166e00ab3c'::uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM ADMIN_UID THEN
    RETURN NULL;
  END IF;

  PERFORM public.log_admin_access('get_admin_overview_stats', '{}'::jsonb);

  RETURN jsonb_build_object(
    -- ── Original 7 (parity with get_beta_admin_stats) ──────────────────
    'total_users',
      (SELECT COUNT(*)::int FROM auth.users),
    'new_users_7d',
      (SELECT COUNT(*)::int FROM auth.users
         WHERE created_at > NOW() - INTERVAL '7 days'),
    'users_with_push',
      (SELECT COUNT(DISTINCT user_id)::int FROM public.push_subscriptions),
    'users_who_gave_feedback',
      (SELECT COUNT(DISTINCT user_id)::int FROM public.beta_feedback),
    'total_feedback_items',
      (SELECT COUNT(*)::int FROM public.beta_feedback),
    'bug_reports',
      (SELECT COUNT(*)::int FROM public.beta_feedback WHERE type = 'bug'),
    'feature_requests',
      (SELECT COUNT(*)::int FROM public.beta_feedback WHERE type = 'feature'),
    -- ── New 7 ──────────────────────────────────────────────────────────
    'new_users_30d',
      (SELECT COUNT(*)::int FROM auth.users
         WHERE created_at > NOW() - INTERVAL '30 days'),
    'users_with_ai_consent',
      (SELECT COUNT(*)::int FROM public.profiles
         WHERE ai_consent_granted = TRUE),
    'total_ai_calls_today',
      (SELECT COALESCE(SUM(request_count), 0)::int FROM public.ai_daily_usage
         WHERE usage_date = CURRENT_DATE),
    'total_ai_calls_7d',
      (SELECT COALESCE(SUM(request_count), 0)::int FROM public.ai_daily_usage
         WHERE usage_date >= CURRENT_DATE - 6),
    'feedback_7d',
      (SELECT COUNT(*)::int FROM public.beta_feedback
         WHERE created_at > NOW() - INTERVAL '7 days'),
    'pro_users',
      (SELECT COUNT(*)::int FROM public.profiles WHERE plan = 'pro'),
    'family_users',
      (SELECT COUNT(*)::int FROM public.profiles WHERE plan = 'family')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO authenticated;


-- =============================================================================
-- SECTION 4: get_admin_user_list()
-- =============================================================================
-- Paginated user roster. Returns metadata and counts only — zero raw PHI.
-- Columns: user_id, email, name, plan, ai_consent_granted, joined_at,
--          last_active_at, feedback_count, ai_calls_today, audit_actions_total
-- Returns empty result set for any non-admin caller.
--
-- Privacy note: email and name are intentionally included here (unlike
-- search_admin_feedback which excludes them) because this is a user-roster
-- function. The admin must be able to identify and contact users. This is
-- access-controlled to the single ADMIN_UID via SECURITY DEFINER and every
-- call is logged to admin_access_log for auditability.

CREATE OR REPLACE FUNCTION public.get_admin_user_list(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  user_id              UUID,
  email                TEXT,
  name                 TEXT,
  plan                 TEXT,
  ai_consent_granted   BOOLEAN,
  joined_at            TIMESTAMPTZ,
  last_active_at       TIMESTAMPTZ,
  feedback_count       INT,
  ai_calls_today       INT,
  audit_actions_total  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_UID CONSTANT UUID := 'b4f5d3fb-634c-4fe7-a2cb-36166e00ab3c'::uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM ADMIN_UID THEN
    RETURN;
  END IF;

  PERFORM public.log_admin_access(
    'get_admin_user_list',
    jsonb_build_object('limit', p_limit, 'offset', p_offset)
  );

  RETURN QUERY
  SELECT
    p.id                                AS user_id,
    p.email                             AS email,
    p.name                              AS name,
    p.plan::TEXT                        AS plan,
    p.ai_consent_granted                AS ai_consent_granted,
    p.created_at                        AS joined_at,
    u.last_sign_in_at                   AS last_active_at,
    COALESCE(fb.cnt, 0)::int            AS feedback_count,
    COALESCE(ai.request_count, 0)::int  AS ai_calls_today,
    COALESCE(al.cnt, 0)::int            AS audit_actions_total
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN (
    SELECT bf.user_id, COUNT(*)::int AS cnt
    FROM public.beta_feedback bf
    GROUP BY bf.user_id
  ) fb ON fb.user_id = p.id
  LEFT JOIN (
    SELECT adu.user_id, adu.request_count
    FROM public.ai_daily_usage adu
    WHERE adu.usage_date = CURRENT_DATE
  ) ai ON ai.user_id = p.id
  LEFT JOIN (
    SELECT al2.user_id, COUNT(*)::int AS cnt
    FROM public.audit_logs al2
    GROUP BY al2.user_id
  ) al ON al.user_id = p.id
  ORDER BY p.created_at DESC
  LIMIT  GREATEST(1, COALESCE(p_limit, 50))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_list(INT, INT) TO authenticated;


-- =============================================================================
-- SECTION 5: search_admin_feedback()
-- =============================================================================
-- Filterable feedback rows. user_agent EXCLUDED (fingerprint risk).
-- name/email EXCLUDED (privacy-by-default).
-- Returns empty result set for any non-admin caller.

CREATE OR REPLACE FUNCTION public.search_admin_feedback(
  p_type   TEXT        DEFAULT NULL,
  p_since  TIMESTAMPTZ DEFAULT NULL,
  p_limit  INT         DEFAULT 50,
  p_offset INT         DEFAULT 0
)
RETURNS TABLE (
  id            UUID,
  user_id       UUID,
  type          TEXT,
  message       TEXT,
  current_route TEXT,
  app_version   TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_UID CONSTANT UUID := 'b4f5d3fb-634c-4fe7-a2cb-36166e00ab3c'::uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM ADMIN_UID THEN
    RETURN;
  END IF;

  PERFORM public.log_admin_access(
    'search_admin_feedback',
    jsonb_build_object(
      'type',   p_type,
      'since',  p_since,
      'limit',  p_limit,
      'offset', p_offset
    )
  );

  RETURN QUERY
  SELECT
    f.id,
    f.user_id,
    f.type::TEXT,
    f.message,
    f.current_route,
    f.app_version,
    f.created_at
  FROM public.beta_feedback f
  WHERE (p_type IS NULL  OR f.type::TEXT = p_type)
    AND (p_since IS NULL OR f.created_at >= p_since)
  ORDER BY f.created_at DESC
  LIMIT  GREATEST(1, COALESCE(p_limit, 50))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_admin_feedback(TEXT, TIMESTAMPTZ, INT, INT) TO authenticated;


-- =============================================================================
-- SECTION 6: get_admin_ai_usage()
-- =============================================================================
-- Daily per-user AI call counts. Flags users at/near the 50-call limit.
-- Returns empty result set for any non-admin caller.

CREATE OR REPLACE FUNCTION public.get_admin_ai_usage(
  p_date DATE DEFAULT NULL
)
RETURNS TABLE (
  user_id       UUID,
  email         TEXT,
  request_count INT,
  at_limit      BOOLEAN,
  near_limit    BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ADMIN_UID  CONSTANT UUID := 'b4f5d3fb-634c-4fe7-a2cb-36166e00ab3c'::uuid;
  v_date     DATE := COALESCE(p_date, CURRENT_DATE);
BEGIN
  IF auth.uid() IS DISTINCT FROM ADMIN_UID THEN
    RETURN;
  END IF;

  PERFORM public.log_admin_access(
    'get_admin_ai_usage',
    jsonb_build_object('date', v_date)
  );

  RETURN QUERY
  SELECT
    adu.user_id,
    p.email,
    adu.request_count::int,
    (adu.request_count >= 50) AS at_limit,
    (adu.request_count >= 40 AND adu.request_count < 50) AS near_limit
  FROM public.ai_daily_usage adu
  JOIN public.profiles p ON p.id = adu.user_id
  WHERE adu.usage_date = v_date
  ORDER BY adu.request_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_ai_usage(DATE) TO authenticated;


-- =============================================================================
-- SECTION 7: Update audit_logs retention 2 years → 6 years (HIPAA guidance)
-- =============================================================================
-- Unschedule the existing job first (idempotent — no-ops if already removed),
-- then reschedule with the updated SQL. Same cron schedule, same job name.

DO $$
BEGIN
  PERFORM cron.unschedule('marinloop-audit-cleanup');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job didn't exist; that's fine
END $$;

SELECT cron.schedule(
  'marinloop-audit-cleanup',
  '0 3 * * 0',  -- Sundays 03:00 UTC (unchanged)
  $$DELETE FROM public.audit_logs WHERE created_at < now() - interval '6 years'$$
);


-- =============================================================================
-- SECTION 8: New cron — beta_feedback 1-year retention
-- =============================================================================
-- beta_feedback previously had no retention policy. Deletes rows older than
-- 1 year on Wednesdays at 02:00 UTC (offset from other Sunday/Monday jobs).

DO $$
BEGIN
  PERFORM cron.unschedule('marinloop-feedback-retention');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'marinloop-feedback-retention',
  '0 2 * * 3',  -- Wednesdays 02:00 UTC
  $$DELETE FROM public.beta_feedback WHERE created_at < now() - interval '1 year'$$
);


-- =============================================================================
-- SECTION 9: New cron — admin_access_log 6-year retention
-- =============================================================================
-- Matches audit_logs retention for HIPAA alignment.
-- Runs Mondays at 04:00 UTC (offset from audit-cleanup and feedback jobs).

DO $$
BEGIN
  PERFORM cron.unschedule('marinloop-admin-access-log-retention');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'marinloop-admin-access-log-retention',
  '0 4 * * 1',  -- Mondays 04:00 UTC
  $$DELETE FROM public.admin_access_log WHERE called_at < now() - interval '6 years'$$
);
