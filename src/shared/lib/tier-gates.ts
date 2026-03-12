/**
 * Pure utility functions for subscription tier gating.
 * No React, no side effects, no Supabase imports — safe to use anywhere.
 * All functions derive their results solely from TIER_CONFIG.
 */

import { TIER_CONFIG } from '@/shared/types/subscription'
import type { SubscriptionTier, TierLimits } from '@/shared/types/subscription'

/**
 * Returns the TierLimits for the given tier.
 */
export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_CONFIG[tier].limits
}

/**
 * Returns true if currentCount is below the tier's maxMeds cap,
 * or if maxMeds is -1 (unlimited). Returns false for unrecognised tiers.
 */
export function canAddMedication(currentCount: number, tier: SubscriptionTier): boolean {
  const config = TIER_CONFIG[tier]
  if (!config) return false
  const { maxMeds } = config.limits
  if (maxMeds === -1) return true
  return currentCount < maxMeds
}

/**
 * Returns true if the tier includes barcode scanning.
 */
export function canUseBarcode(tier: SubscriptionTier): boolean {
  return TIER_CONFIG[tier].limits.hasBarcode
}

/**
 * Returns true if the tier includes OCR label scanning.
 */
export function canUseOcr(tier: SubscriptionTier): boolean {
  return TIER_CONFIG[tier].limits.hasOcr
}

/**
 * Returns the number of AI uses allowed per day for the tier.
 */
export function getAiDailyLimit(tier: SubscriptionTier): number {
  return TIER_CONFIG[tier].limits.aiDailyLimit
}

/**
 * Returns true if the tier includes caregiver mode.
 */
export function canUseCaregiverMode(tier: SubscriptionTier): boolean {
  return TIER_CONFIG[tier].limits.hasCaregiverMode
}

/**
 * Returns true if the tier includes smart reminders.
 */
export function canUseSmartReminders(tier: SubscriptionTier): boolean {
  return TIER_CONFIG[tier].limits.hasSmartReminders
}

/**
 * Returns the maximum number of profiles allowed for the tier.
 */
export function getMaxProfiles(tier: SubscriptionTier): number {
  return TIER_CONFIG[tier].limits.maxProfiles
}

/**
 * Returns a human-readable medication limit string.
 * Returns "Unlimited" when maxMeds is -1, otherwise the numeric count as a string.
 */
export function getMedLimitDisplay(tier: SubscriptionTier): string {
  const { maxMeds } = TIER_CONFIG[tier].limits
  return maxMeds === -1 ? 'Unlimited' : String(maxMeds)
}

/**
 * Returns true when the user is at or over the medication limit for their tier.
 * Always returns false for unlimited tiers (maxMeds === -1).
 * This is the logical inverse of canAddMedication.
 */
export function isAtMedLimit(currentCount: number, tier: SubscriptionTier): boolean {
  return !canAddMedication(currentCount, tier)
}
