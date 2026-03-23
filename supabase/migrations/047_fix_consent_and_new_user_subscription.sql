-- 047_fix_consent_and_new_user_subscription.sql
-- Fixes three issues:
-- 1. AI consent grant/revoke was fire-and-forget from client → could silently fail.
--    Now uses SECURITY DEFINER RPCs that atomically update profile + insert audit row.
-- 2. New users who sign up after migration 046 get no subscription row → free tier.
--    Updates handle_new_user() to also seed a Pro subscription during beta.
-- 3. Backfill: any profiles still missing a subscription row get Pro.

-- =============================================================================
-- 1. SECURITY DEFINER RPC: grant_ai_consent
-- =============================================================================

CREATE OR REPLACE FUNCTION public.grant_ai_consent()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET ai_consent_granted    = TRUE,
      ai_consent_granted_at = NOW()
  WHERE id = v_uid;

  INSERT INTO public.ai_consent_audit (user_id, action, granted_at)
  VALUES (v_uid, 'granted', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_ai_consent() TO authenticated;

-- =============================================================================
-- 2. SECURITY DEFINER RPC: revoke_ai_consent
-- =============================================================================

CREATE OR REPLACE FUNCTION public.revoke_ai_consent()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET ai_consent_granted = FALSE
  WHERE id = v_uid;

  INSERT INTO public.ai_consent_audit (user_id, action, granted_at)
  VALUES (v_uid, 'revoked', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_ai_consent() TO authenticated;

-- =============================================================================
-- 3. Update handle_new_user() to also seed a Pro subscription during beta
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    name       = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = timezone('utc', now());

  -- Beta: seed every new user with Pro access
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'pro', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 4. Backfill: any profiles still missing a subscription row get Pro
-- =============================================================================

INSERT INTO public.subscriptions (user_id, tier, status)
SELECT id, 'pro', 'active'
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions WHERE subscriptions.user_id = profiles.id
);
