// _shared/tier-limits.ts
// Fetches the effective tier limits for a user via Supabase RPC.
// Requires a service-role client (bypasses RLS on subscriptions).

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface EdgeTierLimits {
  aiDailyLimit: number
  hasOcr: boolean
  hasBarcode: boolean
  maxMeds: number
}

/**
 * Resolves the effective tier for a user (handles canceled/expired → 'free'),
 * then returns the limit set for that tier.
 */
export async function getUserTierLimits(
  supabase: SupabaseClient,
  userId: string,
): Promise<EdgeTierLimits> {
  const { data: tier, error: tierError } = await supabase.rpc('get_user_tier', {
    p_user_id: userId,
  })
  if (tierError) throw new Error(`Failed to resolve tier: ${tierError.message}`)

  const resolvedTier = typeof tier === 'string' ? tier : 'free'

  const { data: limits, error: limitsError } = await supabase.rpc('get_tier_limits', {
    p_tier: resolvedTier,
  })
  if (limitsError) throw new Error(`Failed to fetch tier limits: ${limitsError.message}`)

  const l = (limits ?? {}) as Record<string, unknown>
  return {
    aiDailyLimit: typeof l.ai_daily_limit === 'number' ? l.ai_daily_limit : 0,
    hasOcr: l.has_ocr === true,
    hasBarcode: l.has_barcode === true,
    maxMeds: typeof l.max_meds === 'number' ? l.max_meds : 3,
  }
}
