-- 045_managed_profiles.sql
-- Multi-profile support for Pro tier (Phase 8).
-- Adds managed_profiles table, attaches a nullable profile_id FK to each
-- user-data table, and extends RLS policies to allow owners to access data
-- belonging to any of their managed profiles.

-- =============================================================================
-- 1. managed_profiles table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.managed_profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  relationship  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_managed_profiles_owner_user_id
  ON public.managed_profiles(owner_user_id);

-- updated_at trigger (reuses set_updated_at() from 000_initial_schema)
DROP TRIGGER IF EXISTS trg_managed_profiles_updated_at ON public.managed_profiles;
CREATE TRIGGER trg_managed_profiles_updated_at
  BEFORE UPDATE ON public.managed_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- =============================================================================
-- 2. RLS on managed_profiles
-- =============================================================================

ALTER TABLE public.managed_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS managed_profiles_select_own ON public.managed_profiles;
CREATE POLICY managed_profiles_select_own
  ON public.managed_profiles FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS managed_profiles_insert_own ON public.managed_profiles;
CREATE POLICY managed_profiles_insert_own
  ON public.managed_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS managed_profiles_update_own ON public.managed_profiles;
CREATE POLICY managed_profiles_update_own
  ON public.managed_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS managed_profiles_delete_own ON public.managed_profiles;
CREATE POLICY managed_profiles_delete_own
  ON public.managed_profiles FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

-- =============================================================================
-- 3. Add nullable profile_id column to user-data tables
-- =============================================================================

ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS profile_id UUID
    REFERENCES public.managed_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS profile_id UUID
    REFERENCES public.managed_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.dose_logs
  ADD COLUMN IF NOT EXISTS profile_id UUID
    REFERENCES public.managed_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS profile_id UUID
    REFERENCES public.managed_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS profile_id UUID
    REFERENCES public.managed_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.refills
  ADD COLUMN IF NOT EXISTS profile_id UUID
    REFERENCES public.managed_profiles(id) ON DELETE CASCADE;

-- Partial indexes (only index rows that actually belong to a managed profile)
CREATE INDEX IF NOT EXISTS idx_medications_profile_id
  ON public.medications(profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_profile_id
  ON public.schedules(profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dose_logs_profile_id
  ON public.dose_logs(profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_profile_id
  ON public.appointments(profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notes_profile_id
  ON public.notes(profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refills_profile_id
  ON public.refills(profile_id)
  WHERE profile_id IS NOT NULL;

-- =============================================================================
-- 4. Update RLS policies on user-data tables
--    Drop the existing _own policies (defined in 000_initial_schema.sql) and
--    recreate them to also permit access when profile_id belongs to a managed
--    profile owned by the current user.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- medications
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS medications_select_own ON public.medications;
CREATE POLICY medications_select_own_or_managed
  ON public.medications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS medications_insert_own ON public.medications;
CREATE POLICY medications_insert_own_or_managed
  ON public.medications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      profile_id IS NULL
      OR profile_id IN (
        SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS medications_update_own ON public.medications;
CREATE POLICY medications_update_own_or_managed
  ON public.medications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS medications_delete_own ON public.medications;
CREATE POLICY medications_delete_own_or_managed
  ON public.medications FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- schedules
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS schedules_select_own ON public.schedules;
CREATE POLICY schedules_select_own_or_managed
  ON public.schedules FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS schedules_insert_own ON public.schedules;
CREATE POLICY schedules_insert_own_or_managed
  ON public.schedules FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      profile_id IS NULL
      OR profile_id IN (
        SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS schedules_update_own ON public.schedules;
CREATE POLICY schedules_update_own_or_managed
  ON public.schedules FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS schedules_delete_own ON public.schedules;
CREATE POLICY schedules_delete_own_or_managed
  ON public.schedules FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- dose_logs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS dose_logs_select_own ON public.dose_logs;
CREATE POLICY dose_logs_select_own_or_managed
  ON public.dose_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS dose_logs_insert_own ON public.dose_logs;
CREATE POLICY dose_logs_insert_own_or_managed
  ON public.dose_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      profile_id IS NULL
      OR profile_id IN (
        SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS dose_logs_update_own ON public.dose_logs;
CREATE POLICY dose_logs_update_own_or_managed
  ON public.dose_logs FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS dose_logs_delete_own ON public.dose_logs;
CREATE POLICY dose_logs_delete_own_or_managed
  ON public.dose_logs FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS appointments_select_own ON public.appointments;
CREATE POLICY appointments_select_own_or_managed
  ON public.appointments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS appointments_insert_own ON public.appointments;
CREATE POLICY appointments_insert_own_or_managed
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      profile_id IS NULL
      OR profile_id IN (
        SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS appointments_update_own ON public.appointments;
CREATE POLICY appointments_update_own_or_managed
  ON public.appointments FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS appointments_delete_own ON public.appointments;
CREATE POLICY appointments_delete_own_or_managed
  ON public.appointments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS notes_select_own ON public.notes;
CREATE POLICY notes_select_own_or_managed
  ON public.notes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notes_insert_own ON public.notes;
CREATE POLICY notes_insert_own_or_managed
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      profile_id IS NULL
      OR profile_id IN (
        SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS notes_update_own ON public.notes;
CREATE POLICY notes_update_own_or_managed
  ON public.notes FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notes_delete_own ON public.notes;
CREATE POLICY notes_delete_own_or_managed
  ON public.notes FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- refills
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS refills_select_own ON public.refills;
CREATE POLICY refills_select_own_or_managed
  ON public.refills FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS refills_insert_own ON public.refills;
CREATE POLICY refills_insert_own_or_managed
  ON public.refills FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      profile_id IS NULL
      OR profile_id IN (
        SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS refills_update_own ON public.refills;
CREATE POLICY refills_update_own_or_managed
  ON public.refills FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS refills_delete_own ON public.refills;
CREATE POLICY refills_delete_own_or_managed
  ON public.refills FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM public.managed_profiles WHERE owner_user_id = auth.uid()
    )
  );
