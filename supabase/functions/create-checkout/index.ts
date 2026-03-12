// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout Session for a subscription upgrade.
// DORMANT — no client UI calls this yet. Production-ready when Stripe is enabled.
//
// Usage: POST with Authorization: Bearer <user-jwt>
// Body: { tier: 'basic' | 'pro', billingPeriod: 'monthly' | 'yearly' }
//
// Requires: STRIPE_SECRET_KEY, STRIPE_PRICE_BASIC_MONTHLY, STRIPE_PRICE_BASIC_YEARLY,
//           STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY, APP_URL
// If ALLOWED_ORIGINS is unset or empty, no origin is allowed (fail-closed).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

type Tier = 'basic' | 'pro'
type BillingPeriod = 'monthly' | 'yearly'

interface CheckoutPayload {
  tier?: unknown
  billingPeriod?: unknown
}

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')
  if (!raw?.trim()) return []
  return raw.split(',').map((o) => o.trim()).filter(Boolean)
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins()
  const originAllowed =
    origin != null &&
    origin !== 'null' &&
    (allowed.includes('*') || allowed.includes(origin))
  return {
    'Access-Control-Allow-Origin': originAllowed ? origin! : 'https://marinloop.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function scrubError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  // Never leak Stripe keys or internal service identifiers
  if (
    msg.includes('STRIPE') ||
    msg.includes('sk_') ||
    msg.includes('rk_') ||
    msg.includes('api.stripe.com')
  ) {
    return 'Request failed'
  }
  return msg
}

function resolvePriceId(tier: Tier, billingPeriod: BillingPeriod): string | undefined {
  const envKey =
    tier === 'basic' && billingPeriod === 'monthly' ? 'STRIPE_PRICE_BASIC_MONTHLY'
    : tier === 'basic' && billingPeriod === 'yearly' ? 'STRIPE_PRICE_BASIC_YEARLY'
    : tier === 'pro' && billingPeriod === 'monthly' ? 'STRIPE_PRICE_PRO_MONTHLY'
    : 'STRIPE_PRICE_PRO_YEARLY'
  return Deno.env.get(envKey)
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Fail-closed CORS check
  const allowed = getAllowedOrigins()
  const originAllowed =
    allowed.includes('*') ||
    (origin != null && origin !== 'null' && allowed.includes(origin))
  if (!originAllowed) {
    return new Response(
      JSON.stringify({ error: 'CORS not allowed' }),
      { status: 403, headers: corsHeaders },
    )
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: corsHeaders },
      )
    }

    // --- Stripe availability check ---
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 503, headers: corsHeaders },
      )
    }

    // --- Supabase clients ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: corsHeaders },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabaseService = createClient(supabaseUrl, serviceRoleKey)

    // --- Authenticate user ---
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders },
      )
    }

    // --- Validate request body ---
    let body: CheckoutPayload
    try {
      body = (await req.json()) as CheckoutPayload
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: corsHeaders },
      )
    }

    const validTiers: Tier[] = ['basic', 'pro']
    const validPeriods: BillingPeriod[] = ['monthly', 'yearly']

    if (!validTiers.includes(body.tier as Tier)) {
      return new Response(
        JSON.stringify({ error: 'tier must be "basic" or "pro"' }),
        { status: 400, headers: corsHeaders },
      )
    }
    if (!validPeriods.includes(body.billingPeriod as BillingPeriod)) {
      return new Response(
        JSON.stringify({ error: 'billingPeriod must be "monthly" or "yearly"' }),
        { status: 400, headers: corsHeaders },
      )
    }

    const tier = body.tier as Tier
    const billingPeriod = body.billingPeriod as BillingPeriod

    // --- Resolve Stripe price ID ---
    const priceId = resolvePriceId(tier, billingPeriod)
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Price not configured' }),
        { status: 503, headers: corsHeaders },
      )
    }

    // --- Look up or create Stripe customer ---
    const { data: subRow, error: subError } = await supabaseService
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (subError) {
      return new Response(
        JSON.stringify({ error: scrubError(subError) }),
        { status: 500, headers: corsHeaders },
      )
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    let stripeCustomerId: string = subRow?.stripe_customer_id ?? ''

    if (!stripeCustomerId) {
      // Get user email from auth
      const userEmail = user.email ?? ''

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail || undefined,
        metadata: { supabase_user_id: user.id },
      })
      stripeCustomerId = customer.id

      // Persist customer ID (upsert — creates row if none exists yet)
      const { error: upsertError } = await supabaseService
        .from('subscriptions')
        .upsert(
          {
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            tier: 'free',
            status: 'active',
          },
          { onConflict: 'user_id' },
        )

      if (upsertError) {
        return new Response(
          JSON.stringify({ error: scrubError(upsertError) }),
          { status: 500, headers: corsHeaders },
        )
      }
    }

    // --- Build APP_URL for redirects ---
    const appUrl = (Deno.env.get('APP_URL') ?? 'https://marinloop.com').replace(/\/$/, '')

    // --- Create Checkout Session ---
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/subscription?checkout=success`,
      cancel_url: `${appUrl}/subscription?checkout=cancelled`,
      subscription_data: {
        // 7-day free trial for Basic tier only
        trial_period_days: tier === 'basic' ? 7 : undefined,
        metadata: {
          supabase_user_id: user.id,
          tier,
          billing_period: billingPeriod,
        },
      },
      metadata: { supabase_user_id: user.id },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: corsHeaders },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: scrubError(err) }),
      { status: 500, headers: { ...getCorsHeaders(origin ?? null), 'Content-Type': 'application/json' } },
    )
  }
})
