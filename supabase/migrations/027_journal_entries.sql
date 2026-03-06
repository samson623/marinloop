-- Migration 027: Journal entries for Phase 4 Health Analytics
-- =============================================================================
-- marinloop Journal Entries (Migration 027)
-- =============================================================================
-- Adds the `journal_entries` table for free-form health journaling with
-- optional mood scoring and links to medications or appointments.
--
-- All statements are idempotent: IF NOT EXISTS, DROP/CREATE triggers,
-- DO/EXCEPTION blocks for policy guards.
-- Reuses public.set_updated_at() created in migration 000.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLE: journal_entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  title                   text        NOT NULL DEFAULT '',
  content                 text        NOT NULL,
  -- mood: 1 (terrible) → 5 (great). Nullable — user may skip mood rating.
  mood                    smallint    CHECK (mood BETWEEN 1 AND 5),
  tags                    text[]      NOT NULL DEFAULT '{}',
  -- Optional links to existing records
  linked_medication_id    uuid        REFERENCES public.medications(id)   ON DELETE SET NULL,
  linked_appointment_id   uuid        REFERENCES public.appointments(id)  ON DELETE SET NULL,
  entry_date              date        NOT NULL DEFAULT CURRENT_DATE,
  created_at              timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at              timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- 2. INDEXES
--    Primary: (user_id, entry_date DESC) for date-ordered journal views.
--    Partial:  (user_id) WHERE mood IS NOT NULL for mood trend queries —
--              avoids scanning rows that have no mood rating.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_entry_date
  ON public.journal_entries (user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_mood
  ON public.journal_entries (user_id)
  WHERE mood IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'journal_entries'
      AND policyname = 'journal_entries_user_policy'
  ) THEN
    CREATE POLICY "journal_entries_user_policy" ON public.journal_entries
      FOR ALL TO authenticated
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. UPDATED_AT TRIGGER
--    Reuses public.set_updated_at() created in migration 000.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_journal_entries_updated_at ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
