// Supabase Edge Function: stripe-webhook
// Receives Stripe webhook events and updates the subscriptions table via service role.
// DORMANT — no client UI triggers Stripe purchases yet. Production-ready when Stripe is enabled.
//
// This function is called by Stripe servers, NOT the browser:
//   - No user Authorization header required
//   - Stripe signature is verified with STRIPE_WEBHOOK_SECRET
//
// Handles: checkout.session.completed, customer.subscription.updated,
//          customer.subscription.deleted, invoice.payment_failed
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// ALLOWED_ORIGINS is included for consistency but the CORS origin check is skipped for Stripe calls.

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
    msg.includes('whsec_') ||
    msg.includes('api.stripe.com')
  ) {
    return 'Request failed'
  }
  return msg
}

/**
 * Maps a Stripe subscription status string to our internal status.
 */
function mapStripeStatus(status: string): string {
  switch (status) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due': return 'past_due'
    case 'canceled': return 'canceled'
    case 'unpaid': return 'past_due'
    default: return 'active'
  }
}

/**
 * Converts a Unix timestamp (seconds) to an ISO 8601 string, or null if falsy.
 */
function unixToIso(ts: number | null | undefined): string | null {
  if (!ts) return null
  return new Date(ts * 1000).toISOString()
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Read raw body as text — required for Stripe signature verification.
  // Must be read before any other body parsing.
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to read request body' }),
      { status: 400, headers: corsHeaders },
    )
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return new Response(
      JSON.stringify({ error: 'Missing stripe-signature header' }),
      { status: 400, headers: corsHeaders },
    )
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeSecretKey) {
    return new Response(
      JSON.stringify({ error: 'Stripe not configured' }),
      { status: 500, headers: corsHeaders },
    )
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Webhook secret not configured' }),
      { status: 500, headers: corsHeaders },
    )
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Service configuration error' }),
      { status: 500, headers: corsHeaders },
    )
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  // Verify Stripe webhook signature
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('Stripe signature verification failed:', scrubError(err))
    return new Response(
      JSON.stringify({ error: 'Invalid signature' }),
      { status: 400, headers: corsHeaders },
    )
  }

  // Service role client — bypasses RLS so we can write subscription rows
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseService = createClient(supabaseUrl, serviceRoleKey)

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // checkout.session.completed
      // Fired when a user completes Stripe Checkout. Creates/upserts our row.
      // -----------------------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const stripeSubscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null

        const stripeCustomerId = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id ?? null

        const supabaseUserId = session.metadata?.supabase_user_id ?? null

        if (!supabaseUserId || !stripeSubscriptionId || !stripeCustomerId) {
          console.error('checkout.session.completed: missing required fields', {
            supabaseUserId,
            stripeSubscriptionId,
            stripeCustomerId,
          })
          // Return 200 so Stripe does not retry — this session is malformed
          return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders })
        }

        // Fetch the full Stripe subscription to read metadata, trial info, and period
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

        const tier = subscription.metadata?.tier ?? 'basic'
        const billingPeriod = subscription.metadata?.billing_period ?? 'monthly'
        const status = mapStripeStatus(subscription.status)

        const { error: upsertError } = await supabaseService
          .from('subscriptions')
          .upsert(
            {
              user_id: supabaseUserId,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              tier,
              billing_period: billingPeriod,
              status,
              trial_ends_at: unixToIso(subscription.trial_end),
              current_period_start: unixToIso(subscription.current_period_start),
              current_period_end: unixToIso(subscription.current_period_end),
            },
            { onConflict: 'user_id' },
          )

        if (upsertError) {
          console.error('checkout.session.completed: upsert error', scrubError(upsertError))
          return new Response(
            JSON.stringify({ error: scrubError(upsertError) }),
            { status: 500, headers: corsHeaders },
          )
        }

        console.log('checkout.session.completed: subscription upserted for user', supabaseUserId)
        break
      }

      // -----------------------------------------------------------------------
      // customer.subscription.updated
      // Fired on plan changes, renewal, trial ending, status changes, etc.
      // -----------------------------------------------------------------------
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        const tier = subscription.metadata?.tier ?? undefined
        const billingPeriod = subscription.metadata?.billing_period ?? undefined
        const status = mapStripeStatus(subscription.status)

        const updatePayload: Record<string, unknown> = {
          status,
          current_period_start: unixToIso(subscription.current_period_start),
          current_period_end: unixToIso(subscription.current_period_end),
        }

        if (tier !== undefined) {
          updatePayload.tier = tier
        }
        if (billingPeriod !== undefined) {
          updatePayload.billing_period = billingPeriod
        }
        if (subscription.status === 'trialing') {
          updatePayload.trial_ends_at = unixToIso(subscription.trial_end)
        }

        const { error: updateError } = await supabaseService
          .from('subscriptions')
          .update(updatePayload)
          .eq('stripe_subscription_id', subscription.id)

        if (updateError) {
          console.error('customer.subscription.updated: update error', scrubError(updateError))
          return new Response(
            JSON.stringify({ error: scrubError(updateError) }),
            { status: 500, headers: corsHeaders },
          )
        }

        console.log('customer.subscription.updated: updated subscription', subscription.id)
        break
      }

      // -----------------------------------------------------------------------
      // customer.subscription.deleted
      // Fired when a subscription is fully canceled.
      // Tier is intentionally left as-is; the SQL get_user_tier function handles
      // returning 'free' for canceled subscriptions.
      // -----------------------------------------------------------------------
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        const { error: deleteError } = await supabaseService
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id)

        if (deleteError) {
          console.error('customer.subscription.deleted: update error', scrubError(deleteError))
          return new Response(
            JSON.stringify({ error: scrubError(deleteError) }),
            { status: 500, headers: corsHeaders },
          )
        }

        console.log('customer.subscription.deleted: marked canceled', subscription.id)
        break
      }

      // -----------------------------------------------------------------------
      // invoice.payment_failed
      // Fired when a renewal payment fails. Mark subscription as past_due.
      // We match on stripe_customer_id because the invoice object is the source,
      // not the subscription ID directly.
      // -----------------------------------------------------------------------
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        const stripeCustomerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id ?? null

        if (!stripeCustomerId) {
          console.error('invoice.payment_failed: missing customer ID')
          return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders })
        }

        const { error: failError } = await supabaseService
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_customer_id', stripeCustomerId)

        if (failError) {
          console.error('invoice.payment_failed: update error', scrubError(failError))
          return new Response(
            JSON.stringify({ error: scrubError(failError) }),
            { status: 500, headers: corsHeaders },
          )
        }

        console.log('invoice.payment_failed: marked past_due for customer', stripeCustomerId)
        break
      }

      // -----------------------------------------------------------------------
      // customer.subscription.trial_will_end
      // Fired by Stripe 3 days before a trial ends. Refreshes trial_ends_at
      // in case it changed, and acknowledges the event so Stripe stops retrying.
      // -----------------------------------------------------------------------
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription

        const { error: trialError } = await supabaseService
          .from('subscriptions')
          .update({ trial_ends_at: unixToIso(subscription.trial_end) })
          .eq('stripe_subscription_id', subscription.id)

        if (trialError) {
          console.error('customer.subscription.trial_will_end: update error', scrubError(trialError))
          return new Response(
            JSON.stringify({ error: scrubError(trialError) }),
            { status: 500, headers: corsHeaders },
          )
        }

        console.log('customer.subscription.trial_will_end: refreshed trial_ends_at for', subscription.id)
        break
      }

      // -----------------------------------------------------------------------
      // Unrecognized events — log and acknowledge. Do not fail.
      // -----------------------------------------------------------------------
      default: {
        console.log('stripe-webhook: unhandled event type', event.type)
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders })
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error('stripe-webhook: unhandled error', scrubError(err))
    return new Response(
      JSON.stringify({ error: scrubError(err) }),
      { status: 500, headers: { ...getCorsHeaders(origin ?? null), 'Content-Type': 'application/json' } },
    )
  }
})
