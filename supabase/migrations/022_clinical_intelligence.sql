-- Migration 022: Clinical Intelligence schema additions
-- Adds RxCUI for drug interaction checking and allergy profile fields

ALTER TABLE medications ADD COLUMN IF NOT EXISTS rxcui TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allergies TEXT[] DEFAULT '{}';
