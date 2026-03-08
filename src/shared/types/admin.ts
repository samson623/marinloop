/**
 * TypeScript types for the MarinLoop admin panel.
 * Each interface maps to a Supabase RPC function defined in migration 041.
 */

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Return shape of `get_admin_overview_stats()` (single JSONB object). */
export interface AdminOverviewStats {
  total_users: number;
  new_users_7d: number;
  users_with_push: number;
  users_who_gave_feedback: number;
  total_feedback_items: number;
  bug_reports: number;
  feature_requests: number;
  new_users_30d: number;
  users_with_ai_consent: number;
  total_ai_calls_today: number;
  total_ai_calls_7d: number;
  feedback_7d: number;
  pro_users: number;
  family_users: number;
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

/** One row returned by `get_admin_user_list(p_limit, p_offset)`. */
export interface AdminUserRow {
  user_id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'pro' | 'family';
  ai_consent_granted: boolean;
  joined_at: string;
  last_active_at: string | null;
  feedback_count: number;
  ai_calls_today: number;
  audit_actions_total: number;
}

/** One row returned by `search_admin_feedback(p_type, p_since, p_limit, p_offset)`. */
export interface AdminFeedbackRow {
  id: string;
  user_id: string;
  type: 'bug' | 'feature' | 'general';
  message: string;
  current_route: string | null;
  app_version: string;
  created_at: string;
}

/** One row returned by `get_admin_ai_usage(p_date)`. */
export interface AdminAIUsageRow {
  user_id: string;
  email: string;
  request_count: number;
  at_limit: boolean;
  near_limit: boolean;
}

// ---------------------------------------------------------------------------
// Parameter / filter types (used by hooks)
// ---------------------------------------------------------------------------

/** Parameters accepted by the `get_admin_user_list` RPC hook. */
export interface AdminUserListParams {
  limit?: number;
  offset?: number;
}

/** Parameters accepted by the `search_admin_feedback` RPC hook. */
export interface AdminFeedbackParams {
  type?: 'bug' | 'feature' | 'general' | null;
  since?: string | null;
  limit?: number;
  offset?: number;
}

/** Parameters accepted by the `get_admin_ai_usage` RPC hook. */
export interface AdminAIUsageParams {
  /** ISO date string, e.g. '2026-03-08'. Defaults to today when omitted. */
  date?: string;
}
