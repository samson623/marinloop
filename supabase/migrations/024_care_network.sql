-- =============================================================================
-- marinloop Care Network (Migration 024)
-- =============================================================================
-- Adds Care Coordination tables:
--   • care_connections  — caregiver relationship invitations
--   • providers         — care team directory (doctors, pharmacists, etc.)
--   • profiles.emergency_contacts — jsonb column for emergency contacts
--
-- All statements are idempotent: IF NOT EXISTS, CREATE OR REPLACE, DROP/CREATE
-- triggers, DO/EXCEPTION blocks for enum-style constraints and cron.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUM-STYLE CHECK DOMAINS
--    We use text columns with CHECK constraints rather than ENUM types because
--    ALTER TYPE ADD VALUE cannot run inside a transaction, which breaks
--    Supabase's transactional migration runner.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2. TABLE: care_connections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_connections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_email  text        NOT NULL,
  caregiver_name   text        NOT NULL,
  -- relationship: spouse | parent | child | friend | nurse | other
  relationship     text        NOT NULL DEFAULT 'other'
                   CHECK (relationship IN ('spouse','parent','child','friend','nurse','other')),
  -- status: pending | accepted | revoked
  status           text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','revoked')),
  notify_on_miss   boolean     NOT NULL DEFAULT true,
  -- invite_token is sent in the invitation link; caregiver clicks it to accept
  invite_token     uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, caregiver_email)
);

-- ---------------------------------------------------------------------------
-- 3. TABLE: providers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.providers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  -- specialty: primary_care | cardiologist | pharmacist | neurologist | specialist | other
  specialty  text        NOT NULL DEFAULT 'primary_care'
             CHECK (specialty IN ('primary_care','cardiologist','pharmacist','neurologist','specialist','other')),
  phone      text,
  email      text,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 4. COLUMN: profiles.emergency_contacts
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------

-- care_connections
ALTER TABLE public.care_connections ENABLE ROW LEVEL SECURITY;

-- Primary user owns their own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'care_connections'
      AND policyname = 'care_connections_owner_all'
  ) THEN
    CREATE POLICY "care_connections_owner_all" ON public.care_connections
      FOR ALL TO authenticated
      USING  (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Caregivers can see invitations sent to their email address
-- (so they can read the invite before accepting via the RPC)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'care_connections'
      AND policyname = 'care_connections_caregiver_select'
  ) THEN
    CREATE POLICY "care_connections_caregiver_select" ON public.care_connections
      FOR SELECT TO authenticated
      USING (
        caregiver_email = (
          SELECT email FROM public.profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- providers
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'providers'
      AND policyname = 'providers_owner_all'
  ) THEN
    CREATE POLICY "providers_owner_all" ON public.providers
      FOR ALL TO authenticated
      USING  (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_care_connections_user_id
  ON public.care_connections (user_id);

CREATE INDEX IF NOT EXISTS idx_care_connections_caregiver_email
  ON public.care_connections (caregiver_email);

-- Partial index to speed up the cron's accepted+notify_on_miss join
CREATE INDEX IF NOT EXISTS idx_care_connections_accepted_notify
  ON public.care_connections (caregiver_email)
  WHERE status = 'accepted' AND notify_on_miss = true;

CREATE INDEX IF NOT EXISTS idx_providers_user_id
  ON public.providers (user_id);

-- ---------------------------------------------------------------------------
-- 7. UPDATED_AT TRIGGERS
--    Reuses public.set_updated_at() created in migration 000.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_care_connections_updated_at ON public.care_connections;
CREATE TRIGGER trg_care_connections_updated_at
  BEFORE UPDATE ON public.care_connections
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_providers_updated_at ON public.providers;
CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. RPC: accept_care_invite(p_token uuid)
-- ---------------------------------------------------------------------------
-- Called by the caregiver after they click the invitation link.
-- Finds the pending connection by token, transitions it to 'accepted', and
-- returns the updated row so the frontend can display confirmation.
-- SECURITY DEFINER so the caregiver (who does NOT own the row) can update it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_care_invite(p_token uuid)
RETURNS SETOF public.care_connections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.care_connections%ROWTYPE;
BEGIN
  -- Find the pending invite
  SELECT * INTO v_row
    FROM public.care_connections
    WHERE invite_token = p_token
      AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already used (token: %)', p_token
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Transition to accepted
  UPDATE public.care_connections
    SET status     = 'accepted',
        updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;

  RETURN NEXT v_row;
END;
$$;
