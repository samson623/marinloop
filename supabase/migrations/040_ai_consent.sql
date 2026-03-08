-- 040_ai_consent.sql
-- Phase 1 AI consent enforcement: adds consent fields to profiles and creates
-- an append-only audit table that records every grant/revoke action.

-- =============================================================================
-- 1. Add AI consent columns to profiles
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_consent_granted    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_consent_granted_at TIMESTAMPTZ;

-- =============================================================================
-- 2. Create ai_consent_audit table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_consent_audit (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL CHECK (action IN ('granted', 'revoked')),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_hint TEXT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ai_consent_audit_user_id_granted_at
  ON public.ai_consent_audit(user_id, granted_at DESC);

-- =============================================================================
-- 3. RLS
-- =============================================================================

ALTER TABLE public.ai_consent_audit ENABLE ROW LEVEL SECURITY;

-- Users can only read their own consent audit rows
CREATE POLICY "ai_consent_audit_select_own"
  ON public.ai_consent_audit FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can only insert their own consent audit rows
CREATE POLICY "ai_consent_audit_insert_own"
  ON public.ai_consent_audit FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
