-- 035_ice_card_and_med_history.sql
-- Adds ICE (In Case of Emergency) card fields to profiles,
-- and soft-delete support to medications.

-- ── profiles: ICE card fields ──────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS blood_type         TEXT,
  ADD COLUMN IF NOT EXISTS conditions         TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ice_share_token    TEXT;

-- Backfill share tokens for existing profiles
UPDATE profiles
  SET ice_share_token = encode(extensions.gen_random_bytes(16), 'hex')
  WHERE ice_share_token IS NULL;

-- Default for new rows
ALTER TABLE profiles
  ALTER COLUMN ice_share_token SET DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

-- ── medications: soft-delete ───────────────────────────────────────────────
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS discontinued_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discontinuation_reason TEXT;

-- Index for fast active/archived queries
CREATE INDEX IF NOT EXISTS idx_medications_discontinued_at
  ON medications(user_id, discontinued_at)
  WHERE discontinued_at IS NULL;
