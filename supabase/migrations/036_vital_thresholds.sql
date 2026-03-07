-- 036_vital_thresholds.sql
-- Adds per-user vital threshold configuration to profiles.
-- Stored as JSONB: { bp_systolic: {min, max}, bp_diastolic: {min, max},
--                    heart_rate: {min, max}, glucose: {min, max},
--                    o2_saturation: {min, max}, weight: {min, max} }
-- A null min/max means no threshold on that side.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vital_thresholds JSONB DEFAULT '{}'::jsonb;
