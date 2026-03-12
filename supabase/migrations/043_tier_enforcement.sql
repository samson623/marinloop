-- 043_tier_enforcement.sql
-- Server-side enforcement of per-tier medication limits via a BEFORE INSERT trigger.
-- Works in tandem with check_medication_limit() from 042_subscriptions.sql.

-- =============================================================================
-- 1. Trigger function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_medication_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.check_medication_limit(NEW.user_id) THEN
    RAISE EXCEPTION 'medication_limit_exceeded'
      USING
        HINT    = 'Upgrade your plan to add more medications',
        ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. Attach trigger to medications table
-- =============================================================================

DROP TRIGGER IF EXISTS trg_enforce_medication_limit ON public.medications;

CREATE TRIGGER trg_enforce_medication_limit
  BEFORE INSERT ON public.medications
  FOR EACH ROW EXECUTE PROCEDURE public.enforce_medication_limit();
