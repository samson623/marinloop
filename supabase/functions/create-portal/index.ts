// Supabase Edge Function: create-portal
// Opens the Stripe Customer Portal for subscription management
// (cancel, update payment method, change plan).
// DORMANT — no client UI calls this yet. Production-ready when Stripe is enabled.
//
// Usage: POST with Authorization: Bearer <user-jwt>
// Body: {} or empty
//
// Requires: STRIPE_SECRET_KEY, APP_URL
// If ALLOWED_ORIGINS is unset or empty, no origin is allowed (fail-closed).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

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

    // --- Look up Stripe customer ID ---
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

    const stripeCustomerId: string = subRow?.stripe_customer_id ?? ''
    if (!stripeCustomerId) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 400, headers: corsHeaders },
      )
    }

    // --- Build return URL ---
    const appUrl = (Deno.env.get('APP_URL') ?? 'https://marinloop.com').replace(/\/$/, '')
    const returnUrl = `${appUrl}/subscription`

    // --- Create Stripe Customer Portal session ---
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    })

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { status: 200, headers: corsHeaders },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: scrubError(err) }),
      { status: 500, headers: { ...getCorsHeaders(origin ?? null), 'Content-Type': 'application/json' } },
    )
  }
})
