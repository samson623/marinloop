/**
 * Client-side Stripe service for MarinLoop.
 * DORMANT — no UI calls these yet. SubscriptionView shows a "coming soon" toast.
 * Production-ready when Stripe is enabled and the pricing UI is wired up.
 *
 * Uses Supabase Edge Functions (`create-checkout`, `create-portal`) so that
 * Stripe secret keys are never exposed to the browser.
 */

import { supabase } from '@/shared/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckoutOptions {
  tier: 'basic' | 'pro'
  billingPeriod: 'monthly' | 'yearly'
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the error message from a FunctionsHttpError response body,
 * falling back to the raw error if JSON parsing fails or no message is present.
 */
async function extractFunctionError(error: unknown): Promise<Error> {
  if (
    error !== null &&
    typeof error === 'object' &&
    (error as Record<string, unknown>).name === 'FunctionsHttpError'
  ) {
    const errObj = error as Record<string, unknown>
    if (typeof errObj.context === 'object' && errObj.context !== null) {
      const ctx = errObj.context as Record<string, unknown>
      if (typeof ctx.json === 'function') {
        try {
          const body = (await (ctx.json as () => Promise<unknown>)()) as { error?: string } | null
          if (body && body.error) {
            return new Error(body.error)
          }
        } catch {
          // ignore JSON parse failure — fall through to raw error
        }
      }
    }
  }
  // Return original error coerced to Error
  return error instanceof Error ? error : new Error(String(error))
}

// ---------------------------------------------------------------------------
// StripeService
// ---------------------------------------------------------------------------

export const StripeService = {
  /**
   * Creates a Stripe Checkout session and redirects the browser to the hosted
   * checkout page.
   *
   * Throws if:
   * - The user is not logged in
   * - The edge function returns an error (e.g. STRIPE_SECRET_KEY not configured)
   * - The session URL is missing from the response
   */
  async startCheckout(options: CheckoutOptions): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Must be logged in')
    }

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        tier: options.tier,
        billingPeriod: options.billingPeriod,
      },
    })

    if (error) {
      throw await extractFunctionError(error)
    }

    const result = data as { url?: string; error?: string } | null
    if (result?.error) {
      throw new Error(result.error)
    }
    if (!result?.url) {
      throw new Error('No checkout URL returned from server')
    }

    window.location.href = result.url
  },

  /**
   * Opens the Stripe Customer Portal so the user can manage their subscription
   * (change plan, update payment method, cancel, etc.).
   *
   * Throws if:
   * - The user is not logged in
   * - The user has no active subscription with a Stripe customer ID
   * - The edge function returns an error
   */
  async openPortal(): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Must be logged in')
    }

    const { data, error } = await supabase.functions.invoke('create-portal', {
      body: {},
    })

    if (error) {
      throw await extractFunctionError(error)
    }

    const result = data as { url?: string; error?: string } | null
    if (result?.error) {
      throw new Error(result.error)
    }
    if (!result?.url) {
      throw new Error('No portal URL returned from server')
    }

    window.location.href = result.url
  },
}
