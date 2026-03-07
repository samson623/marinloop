-- 037_audit_logs.sql
-- Audit log: records security-relevant actions with user ID and metadata.
-- Retention: rows older than 2 years are automatically purged.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,          -- e.g. 'medication.created', 'dose.logged', 'account.deleted'
  entity_type TEXT        NOT NULL,          -- e.g. 'medication', 'dose_log', 'care_connection'
  entity_id   TEXT,                          -- FK to the affected row (as text for flexibility)
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- ip, user_agent, extra context
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs(action);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own logs
CREATE POLICY "audit_logs_select_own"
  ON audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own logs (action/entity validated at service layer)
CREATE POLICY "audit_logs_insert_own"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── Retention cron: weekly cleanup of logs older than 2 years ─────────────
SELECT cron.schedule(
  'marinloop-audit-cleanup',
  '0 3 * * 0',   -- Sundays at 03:00 UTC
  $$DELETE FROM public.audit_logs WHERE created_at < now() - interval '2 years'$$
);
