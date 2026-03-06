-- Migration 026: Vitals tracking for Phase 4 Health Analytics
-- =============================================================================
-- marinloop Vitals (Migration 026)
-- =============================================================================
-- Adds the `vitals` table for user-recorded biometric measurements:
--   blood pressure, heart rate, blood glucose, weight, temperature,
--   and O2 saturation.
--
-- All statements are idempotent: IF NOT EXISTS, DROP/CREATE triggers,
-- DO/EXCEPTION blocks for policy guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLE: vitals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vitals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  -- Blood pressure (mmHg)
  bp_systolic    smallint    CHECK (bp_systolic  BETWEEN 60  AND 250),
  bp_diastolic   smallint    CHECK (bp_diastolic BETWEEN 40  AND 150),
  -- Heart rate (BPM)
  heart_rate     smallint    CHECK (heart_rate   BETWEEN 30  AND 250),
  -- Blood glucose (mg/dL)
  glucose        numeric(6,1) CHECK (glucose     BETWEEN 20  AND 600),
  -- Body weight (kg)
  weight         numeric(6,2) CHECK (weight      BETWEEN 10  AND 500),
  -- Body temperature (Celsius)
  temperature    numeric(4,1) CHECK (temperature BETWEEN 30  AND 45),
  -- Oxygen saturation (%)
  o2_saturation  smallint    CHECK (o2_saturation BETWEEN 50 AND 100),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 2. INDEX
--    Composite index on (user_id, recorded_at DESC) for paginated timeline
--    queries ordered by most recent reading.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vitals_user_recorded_at
  ON public.vitals (user_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'vitals'
      AND policyname = 'vitals_user_policy'
  ) THEN
    CREATE POLICY "vitals_user_policy" ON public.vitals
      FOR ALL TO authenticated
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
