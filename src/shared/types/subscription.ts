/**
 * TypeScript types for MarinLoop subscription & billing.
 * Used by the paywall, pricing page, tier-gating hooks, and Stripe webhooks.
 */

// ---------------------------------------------------------------------------
// Enums / union types
// ---------------------------------------------------------------------------

export type SubscriptionTier = 'free' | 'basic' | 'pro';

export type BillingPeriod = 'monthly' | 'yearly';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'expired';

// ---------------------------------------------------------------------------
// Tier configuration
// ---------------------------------------------------------------------------

/** Hard limits enforced per tier. Use `-1` for unlimited. */
export interface TierLimits {
  maxMeds: number;
  maxProfiles: number;
  aiDailyLimit: number;
  hasBarcode: boolean;
  hasOcr: boolean;
  hasCaregiverMode: boolean;
  hasSmartReminders: boolean;
  hasPrioritySupport: boolean;
}

/** Monthly and yearly price in USD. */
export interface TierPricing {
  monthly: number;
  yearly: number;
}

/** Full descriptor for a single tier — limits, pricing, and marketing copy. */
export interface TierInfo {
  tier: SubscriptionTier;
  /** Display name shown in the UI (e.g. "Free", "Basic", "Pro"). */
  name: string;
  limits: TierLimits;
  pricing: TierPricing;
  /** Marketing feature list rendered on the pricing page. */
  features: string[];
}

// ---------------------------------------------------------------------------
// DB row
// ---------------------------------------------------------------------------

/** Mirrors the `subscriptions` table row returned by Supabase. */
export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  billing_period: BillingPeriod | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Static tier configuration
// ---------------------------------------------------------------------------

export const TIER_CONFIG: Record<SubscriptionTier, TierInfo> = {
  free: {
    tier: 'free',
    name: 'Free',
    limits: {
      maxMeds: 3,
      maxProfiles: 1,
      aiDailyLimit: 0,
      hasBarcode: false,
      hasOcr: false,
      hasCaregiverMode: false,
      hasSmartReminders: false,
      hasPrioritySupport: false,
    },
    pricing: { monthly: 0, yearly: 0 },
    features: [
      'Up to 3 medications',
      'Manual medication entry',
      'Basic reminders',
      'Push notifications',
      'Full medication history',
    ],
  },
  basic: {
    tier: 'basic',
    name: 'Basic',
    limits: {
      maxMeds: 8,
      maxProfiles: 1,
      aiDailyLimit: 10,
      hasBarcode: true,
      hasOcr: true,
      hasCaregiverMode: false,
      hasSmartReminders: true,
      hasPrioritySupport: false,
    },
    pricing: { monthly: 4.99, yearly: 39.99 },
    features: [
      'Up to 8 medications',
      'Barcode scanning',
      'OCR label scanning',
      'Smart reminders',
      '10 AI uses per day',
      '7-day free trial',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    limits: {
      maxMeds: -1,
      maxProfiles: 3,
      aiDailyLimit: 30,
      hasBarcode: true,
      hasOcr: true,
      hasCaregiverMode: true,
      hasSmartReminders: true,
      hasPrioritySupport: true,
    },
    pricing: { monthly: 9.99, yearly: 79.99 },
    features: [
      'Unlimited medications',
      'Up to 3 profiles',
      '30 AI uses per day',
      'Caregiver mode',
      'Priority support',
      'Everything in Basic',
    ],
  },
} as const;
