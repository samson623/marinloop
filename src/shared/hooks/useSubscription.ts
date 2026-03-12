import { useMemo } from 'react'
import { useAuthStore } from '@/shared/stores/auth-store'
import type { Subscription, SubscriptionStatus, SubscriptionTier, TierLimits } from '@/shared/types/subscription'
import { TIER_CONFIG } from '@/shared/types/subscription'

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

export interface UseSubscriptionReturn {
  // Core state
  subscription: Subscription | null
  tier: SubscriptionTier
  status: SubscriptionStatus | null
  limits: TierLimits

  // Trial state
  isTrialing: boolean
  trialDaysRemaining: number | null

  // Derived booleans for common feature checks
  canUseAi: boolean
  canUseBarcode: boolean
  canUseOcr: boolean
  canUseCaregiverMode: boolean
  canUseSmartReminders: boolean

  // Helpers
  canAddMedication: (currentCount: number) => boolean
  isAtMedLimit: (currentCount: number) => boolean
  getMedLimitDisplay: () => string
  getAiDailyLimit: () => number
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Provides subscription state and derived feature-gate helpers to components. */
export function useSubscription(): UseSubscriptionReturn {
  const subscription = useAuthStore((s) => s.subscription)
  const getEffectiveTier = useAuthStore((s) => s.getEffectiveTier)

  const tier = getEffectiveTier()
  const limits = TIER_CONFIG[tier].limits
  const status = subscription?.status ?? null

  // Trial state — derived from status and trial_ends_at on the DB row.
  // We treat "trialing" only as active when the trial wall-clock date has not
  // yet passed; getEffectiveTier() already returns 'free' for expired trials,
  // but we still want accurate UI state here (e.g. "2 days left" banners).
  const { isTrialing, trialDaysRemaining } = useMemo(() => {
    if (status !== 'trialing' || !subscription?.trial_ends_at) {
      return { isTrialing: false, trialDaysRemaining: null }
    }

    const trialEnd = new Date(subscription.trial_ends_at)
    const now = new Date()

    if (trialEnd < now) {
      // Trial has expired — mirror getEffectiveTier() behaviour.
      return { isTrialing: false, trialDaysRemaining: null }
    }

    const msRemaining = trialEnd.getTime() - now.getTime()
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))

    return { isTrialing: true, trialDaysRemaining: daysRemaining }
  }, [status, subscription])

  // canUseAi — free tier has aiDailyLimit === 0, treat that as no AI access.
  const canUseAi = tier !== 'free'

  // Stable helper callbacks. These close over `limits` which is derived from
  // `tier` — they will be new references whenever the tier changes, which is
  // the correct behaviour (avoids stale closures in memoised child components).
  const canAddMedication = useMemo(
    () => (currentCount: number): boolean => {
      // -1 means unlimited (Pro tier).
      if (limits.maxMeds === -1) return true
      return currentCount < limits.maxMeds
    },
    [limits.maxMeds],
  )

  const isAtMedLimit = useMemo(
    () => (currentCount: number): boolean => {
      if (limits.maxMeds === -1) return false
      return currentCount >= limits.maxMeds
    },
    [limits.maxMeds],
  )

  const getMedLimitDisplay = useMemo(
    () => (): string => {
      return limits.maxMeds === -1 ? 'Unlimited' : String(limits.maxMeds)
    },
    [limits.maxMeds],
  )

  const getAiDailyLimit = useMemo(
    () => (): number => limits.aiDailyLimit,
    [limits.aiDailyLimit],
  )

  return {
    // Core state
    subscription,
    tier,
    status,
    limits,

    // Trial state
    isTrialing,
    trialDaysRemaining,

    // Feature booleans
    canUseAi,
    canUseBarcode: limits.hasBarcode,
    canUseOcr: limits.hasOcr,
    canUseCaregiverMode: limits.hasCaregiverMode,
    canUseSmartReminders: limits.hasSmartReminders,

    // Helpers
    canAddMedication,
    isAtMedLimit,
    getMedLimitDisplay,
    getAiDailyLimit,
  }
}
