-- Migration 028: Symptom tracking for Phase 4 Health Analytics
-- =============================================================================
-- marinloop Symptoms (Migration 028)
-- =============================================================================
-- Adds the `symptoms` table for logging individual symptom episodes with
-- severity scoring, onset/resolution timestamps, and an optional link to
-- a suspected causative medication.
--
-- All statements are idempotent: IF NOT EXISTS, DROP/CREATE triggers,
-- DO/EXCEPTION blocks for policy guards.
-- Reuses public.set_updated_at() created in migration 000.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLE: symptoms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.symptoms (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  -- Human-readable symptom label e.g. "Headache", "Nausea", "Dizziness"
  name                 text        NOT NULL,
  -- Severity on a 1 (minimal) → 10 (severe) scale
  severity             smallint    NOT NULL DEFAULT 5
                       CHECK (severity BETWEEN 1 AND 10),
  onset_at             timestamptz NOT NULL DEFAULT now(),
  -- null means the symptom is still ongoing
  resolved_at          timestamptz,
  -- Optional suspected causative medication
  linked_medication_id uuid        REFERENCES public.medications(id) ON DELETE SET NULL,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at           timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 2. INDEXES
--    Primary: (user_id, onset_at DESC) for chronological symptom history.
--    Secondary: (user_id, linked_medication_id) for per-medication side-effect
--               queries (e.g. "show all symptoms linked to Metformin").
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_symptoms_user_onset_at
  ON public.symptoms (user_id, onset_at DESC);

CREATE INDEX IF NOT EXISTS idx_symptoms_user_medication
  ON public.symptoms (user_id, linked_medication_id);

-- ---------------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'symptoms'
      AND policyname = 'symptoms_user_policy'
  ) THEN
    CREATE POLICY "symptoms_user_policy" ON public.symptoms
      FOR ALL TO authenticated
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. UPDATED_AT TRIGGER
--    Reuses public.set_updated_at() created in migration 000.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_symptoms_updated_at ON public.symptoms;
CREATE TRIGGER trg_symptoms_updated_at
  BEFORE UPDATE ON public.symptoms
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
