-- 042_subscriptions.sql
-- Subscription billing tier system: stores Stripe subscription state,
-- exposes helper functions for tier resolution and limit enforcement,
-- and seeds rows for existing users.

-- =============================================================================
-- 1. Subscriptions table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                    TEXT        NOT NULL DEFAULT 'free'
                                      CHECK (tier IN ('free', 'basic', 'pro')),
  billing_period          TEXT        CHECK (billing_period IN ('monthly', 'yearly')),
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  status                  TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  trial_ends_at           TIMESTAMPTZ,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT subscriptions_one_per_user UNIQUE (user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON public.subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- =============================================================================
-- 2. updated_at trigger (reuses set_updated_at() from 000_initial_schema)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- =============================================================================
-- 3. get_user_tier(p_user_id) — resolve effective tier for a user
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tier   TEXT;
  v_status TEXT;
  v_trial  TIMESTAMPTZ;
BEGIN
  SELECT tier, status, trial_ends_at
    INTO v_tier, v_status, v_trial
    FROM public.subscriptions
   WHERE user_id = p_user_id;

  -- No subscription row → free
  IF NOT FOUND THEN
    RETURN 'free';
  END IF;

  -- Canceled or expired → free
  IF v_status IN ('canceled', 'expired') THEN
    RETURN 'free';
  END IF;

  -- Trial that has lapsed → free
  IF v_status = 'trialing' AND v_trial < now() THEN
    RETURN 'free';
  END IF;

  RETURN v_tier;
END;
$$;

-- =============================================================================
-- 4. get_tier_limits(p_tier) — returns JSON limits for a given tier
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_tier_limits(p_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_tier
    WHEN 'free' THEN
      RETURN jsonb_build_object(
        'max_meds',            3,
        'max_profiles',        1,
        'ai_daily_limit',      0,
        'has_barcode',         false,
        'has_ocr',             false,
        'has_caregiver',       false,
        'has_smart_reminders', false
      );
    WHEN 'basic' THEN
      RETURN jsonb_build_object(
        'max_meds',            8,
        'max_profiles',        1,
        'ai_daily_limit',      10,
        'has_barcode',         true,
        'has_ocr',             true,
        'has_caregiver',       false,
        'has_smart_reminders', true
      );
    WHEN 'pro' THEN
      RETURN jsonb_build_object(
        'max_meds',            -1,
        'max_profiles',        3,
        'ai_daily_limit',      30,
        'has_barcode',         true,
        'has_ocr',             true,
        'has_caregiver',       true,
        'has_smart_reminders', true
      );
    ELSE
      -- Unknown tier falls back to free limits
      RETURN jsonb_build_object(
        'max_meds',            3,
        'max_profiles',        1,
        'ai_daily_limit',      0,
        'has_barcode',         false,
        'has_ocr',             false,
        'has_caregiver',       false,
        'has_smart_reminders', false
      );
  END CASE;
END;
$$;

-- =============================================================================
-- 5. check_medication_limit(p_user_id) — true if user can add another med
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_medication_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_max_meds INTEGER;
  v_current  INTEGER;
BEGIN
  v_max_meds := (public.get_tier_limits(public.get_user_tier(p_user_id)) ->> 'max_meds')::INTEGER;

  -- -1 means unlimited
  IF v_max_meds = -1 THEN
    RETURN TRUE;
  END IF;

  SELECT count(*)::INTEGER
    INTO v_current
    FROM public.medications
   WHERE user_id = p_user_id;

  RETURN v_current < v_max_meds;
END;
$$;

-- =============================================================================
-- 6. RLS — users can only read their own subscription; writes via service_role
-- =============================================================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies for authenticated role.
-- Only service_role (edge functions, webhooks) can modify subscription rows.

-- =============================================================================
-- 7. Seed subscription rows for existing users
-- =============================================================================

INSERT INTO public.subscriptions (user_id, tier)
SELECT
  id,
  CASE
    WHEN plan = 'pro'    THEN 'pro'
    WHEN plan = 'family' THEN 'pro'
    ELSE 'free'
  END
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions WHERE subscriptions.user_id = profiles.id
);
