// Supabase Edge Function: openai-chat
// Proxies chat completion requests to OpenAI. Model and key are server-side only.
//
// Usage: POST with Authorization: Bearer <user-jwt>
// Body: { messages: [{ role: 'user', content: '...' }] }  (model is ignored; set server-side)
//
// Requires: OPENAI_API_KEY. In production, set ALLOWED_ORIGINS (comma-separated).
// If ALLOWED_ORIGINS is unset or empty, no origin is allowed (fail-closed).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildRateLimitHeaders, runQuotaTrackedRequest } from '../_shared/quota-tracker.ts'
import { getUserTierLimits } from '../_shared/tier-limits.ts'

const ALLOWED_MODEL = 'gpt-5-nano'
const MAX_MESSAGES = 20
const MAX_CONTENT_LENGTH = 8000

function getMidnightUtcNext(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return Math.floor(tomorrow.getTime() / 1000)
}

function getSecondsUntilMidnightUtc(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return Math.floor((tomorrow.getTime() - now.getTime()) / 1000)
}

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')
  if (!raw?.trim()) return []
  return raw.split(',').map((o) => o.trim()).filter(Boolean)
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins()
  const originAllowed = origin != null && origin !== 'null' &&
    (allowed.includes('*') || allowed.includes(origin))
  return {
    'Access-Control-Allow-Origin': originAllowed ? origin! : 'https://marinloop.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatPayload {
  messages?: unknown
}

function scrubError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('OPENAI') || msg.includes('sk-') || msg.includes('api.openai.com')) {
    return 'Request failed'
  }
  return msg
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<Response> {
  const res = await fetch(url, options)
  if (retries > 0 && [500, 502, 503].includes(res.status)) {
    await res.text() // consume body to avoid resource leak
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return fetchWithRetry(url, options, retries - 1)
  }
  return res
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Check origin: fail-closed when ALLOWED_ORIGINS is unset. Only allow wildcard or listed origins.
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: corsHeaders },
      )
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: corsHeaders },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders },
      )
    }

    // Consent check: user must have explicitly granted AI consent
    const { data: profile } = await supabase.from('profiles').select('ai_consent_granted').eq('id', user.id).single()
    if (!profile?.ai_consent_granted) {
      return new Response(
        JSON.stringify({ error: 'AI consent required. Please enable AI features in your profile settings.' }),
        { status: 403, headers: corsHeaders },
      )
    }

    // Per-user daily quota (service-role client bypasses RLS)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: corsHeaders },
      )
    }
    const supabaseService = createClient(supabaseUrl, serviceRoleKey)

    let tierLimits: { aiDailyLimit: number }
    try {
      tierLimits = await getUserTierLimits(supabaseService, user.id)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: corsHeaders },
      )
    }

    if (tierLimits.aiDailyLimit === 0) {
      return new Response(
        JSON.stringify({ error: 'AI features require a paid plan. Upgrade to Basic or Pro.' }),
        { status: 403, headers: corsHeaders },
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    const { data: usageRow, error: usageError } = await supabaseService
      .from('ai_daily_usage')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('usage_date', today)
      .maybeSingle()
    if (usageError) {
      return new Response(
        JSON.stringify({ error: scrubError(usageError) }),
        { status: 500, headers: corsHeaders },
      )
    }

    const limit = tierLimits.aiDailyLimit
    const currentUsage = usageRow?.request_count ?? 0
    let validatedMessages: ChatMessage[] = []
    const quotaResult = await runQuotaTrackedRequest({
      limit,
      currentUsage,
      resetAt: getMidnightUtcNext(),
      retryAfterSeconds: getSecondsUntilMidnightUtc(),
      baseHeaders: corsHeaders,
      limitReachedMessage: 'Daily AI usage limit reached; resets at midnight UTC.',
      validate: async () => {
        let body: ChatPayload
        try {
          body = (await req.json()) as ChatPayload
        } catch {
          return {
            ok: false,
            response: new Response(
              JSON.stringify({ error: 'Invalid JSON body' }),
              { status: 400, headers: corsHeaders },
            ),
          }
        }

        const rawMessages = body.messages
        if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
          return {
            ok: false,
            response: new Response(
              JSON.stringify({ error: 'messages array is required and must be non-empty' }),
              { status: 400, headers: corsHeaders },
            ),
          }
        }
        if (rawMessages.length > MAX_MESSAGES) {
          return {
            ok: false,
            response: new Response(
              JSON.stringify({ error: `Too many messages; maximum ${MAX_MESSAGES}` }),
              { status: 400, headers: corsHeaders },
            ),
          }
        }

        const messages: ChatMessage[] = []
        for (let i = 0; i < rawMessages.length; i++) {
          const m = rawMessages[i]
          if (!m || typeof m !== 'object' || typeof (m as ChatMessage).content !== 'string') {
            return {
              ok: false,
              response: new Response(
                JSON.stringify({ error: `messages[${i}] must have role and content` }),
                { status: 400, headers: corsHeaders },
              ),
            }
          }
          const role = (m as ChatMessage).role
          if (!['system', 'user', 'assistant'].includes(role)) {
            return {
              ok: false,
              response: new Response(
                JSON.stringify({ error: `messages[${i}].role must be system, user, or assistant` }),
                { status: 400, headers: corsHeaders },
              ),
            }
          }
          const content = String((m as ChatMessage).content)
          if (content.length > MAX_CONTENT_LENGTH) {
            return {
              ok: false,
              response: new Response(
                JSON.stringify({ error: `messages[${i}].content exceeds ${MAX_CONTENT_LENGTH} characters` }),
                { status: 400, headers: corsHeaders },
              ),
            }
          }
          messages.push({ role, content })
        }

        validatedMessages = messages
        return { ok: true, data: undefined }
      },
      callProvider: async () => {
        const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: ALLOWED_MODEL,
            messages: validatedMessages.map((m) => ({ role: m.role, content: m.content })),
            max_tokens: 1024,
          }),
        })

        if (!response.ok) {
          await response.text()
          const safeMessage = response.status === 429
            ? 'Too many requests; try again later'
            : 'Request failed'
          return {
            ok: false,
            response: new Response(
              JSON.stringify({ error: safeMessage }),
              { status: response.status, headers: corsHeaders },
            ),
          }
        }

        const data = await response.json()
        return { ok: true, data }
      },
      incrementUsage: async () => {
        const { data: newCount, error: rpcError } = await supabaseService.rpc('increment_ai_daily_usage', {
          p_user_id: user.id,
          p_usage_date: today,
        })
        if (rpcError) throw rpcError
        return typeof newCount === 'number' ? newCount : (newCount as number[])?.[0] ?? currentUsage + 1
      },
    })

    if (!quotaResult.ok) {
      return quotaResult.response!
    }

    const successHeaders = {
      ...corsHeaders,
      ...buildRateLimitHeaders(limit, quotaResult.newUsage ?? currentUsage + 1, getMidnightUtcNext()),
    }
    return new Response(JSON.stringify(quotaResult.data), {
      headers: successHeaders,
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: scrubError(err) }),
      { status: 500, headers: { ...getCorsHeaders(origin ?? null), 'Content-Type': 'application/json' } },
    )
  }
})
