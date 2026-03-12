-- 046_beta_all_pro.sql
-- During beta, all users receive full Pro access at no charge.
-- Updates every existing subscription to tier='pro', status='active',
-- and seeds a pro row for any user who doesn't have one yet.

-- Upgrade all existing subscription rows to pro/active
UPDATE public.subscriptions
SET
  tier   = 'pro',
  status = 'active',
  trial_ends_at          = NULL,
  current_period_start   = now(),
  current_period_end     = NULL
WHERE tier != 'pro'
   OR status NOT IN ('active');

-- Seed pro rows for any profiles without a subscription row
INSERT INTO public.subscriptions (user_id, tier, status)
SELECT id, 'pro', 'active'
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions WHERE subscriptions.user_id = profiles.id
);
