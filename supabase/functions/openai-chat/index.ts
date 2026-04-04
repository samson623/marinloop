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
import { buildRateLimitHeaders } from '../_shared/quota-tracker.ts'
import { getUserTierLimits } from '../_shared/tier-limits.ts'

const PRIMARY_MODEL = 'gpt-5-nano'
const FALLBACK_MODEL = 'gpt-4o-mini'
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

const DEFAULT_ORIGINS = [
  'https://marinloop.com',
  'https://www.marinloop.com',
  'https://medflow-care.vercel.app',
]

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')
  if (!raw?.trim()) return DEFAULT_ORIGINS
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
  stream?: boolean
}

function scrubError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('OPENAI') || msg.includes('sk-') || msg.includes('api.openai.com')) {
    return 'Request failed'
  }
  return msg
}

type OpenAIErrorBody = {
  error?: {
    message?: string
    code?: string
    type?: string
  }
}

async function readProviderError(response: Response): Promise<{ safeMessage: string; rawMessage: string }> {
  let rawMessage = ''

  try {
    const body = await response.json() as OpenAIErrorBody
    rawMessage = body.error?.message?.trim() ?? ''
  } catch {
    try {
      rawMessage = (await response.text()).trim()
    } catch {
      rawMessage = ''
    }
  }

  const normalized = rawMessage.toLowerCase()
  if (response.status === 429) {
    return { safeMessage: 'Too many requests; try again later', rawMessage }
  }
  if (
    response.status === 401
    || normalized.includes('incorrect api key')
    || normalized.includes('invalid api key')
    || normalized.includes('organization')
  ) {
    return { safeMessage: 'AI service configuration error', rawMessage }
  }
  if (response.status === 403 || normalized.includes('permission')) {
    return { safeMessage: 'AI provider rejected the request', rawMessage }
  }
  if (response.status === 400 || response.status === 404) {
    if (normalized.includes('model') || normalized.includes('does not exist') || normalized.includes('not found')) {
      return { safeMessage: 'AI model unavailable', rawMessage }
    }
    return { safeMessage: 'AI request was rejected', rawMessage }
  }

  return { safeMessage: 'Request failed', rawMessage }
}

function shouldRetryWithFallbackModel(response: Response, rawMessage: string): boolean {
  if (![400, 404].includes(response.status)) return false
  const normalized = rawMessage.toLowerCase()
  return normalized.includes('model') || normalized.includes('does not exist') || normalized.includes('not found')
}

async function callOpenAIChat(
  apiKey: string,
  messages: ChatMessage[],
  stream: boolean,
): Promise<Response> {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL]

  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_completion_tokens: 1024,
        stream,
      }),
    })

    if (response.ok) return response

    const { rawMessage } = await readProviderError(response.clone())
    if (i < models.length - 1 && shouldRetryWithFallbackModel(response, rawMessage)) {
      await response.text()
      continue
    }
    return response
  }

  throw new Error('OpenAI request did not return a response')
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

    // ── Parse & validate body ──────────────────────────────────────────
    let body: ChatPayload
    try {
      body = (await req.json()) as ChatPayload
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: corsHeaders },
      )
    }

    const wantStream = body.stream === true

    const rawMessages = body.messages
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required and must be non-empty' }),
        { status: 400, headers: corsHeaders },
      )
    }
    if (rawMessages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ error: `Too many messages; maximum ${MAX_MESSAGES}` }),
        { status: 400, headers: corsHeaders },
      )
    }

    const validatedMessages: ChatMessage[] = []
    for (let i = 0; i < rawMessages.length; i++) {
      const m = rawMessages[i]
      if (!m || typeof m !== 'object' || typeof (m as ChatMessage).content !== 'string') {
        return new Response(
          JSON.stringify({ error: `messages[${i}] must have role and content` }),
          { status: 400, headers: corsHeaders },
        )
      }
      const role = (m as ChatMessage).role
      if (!['system', 'user', 'assistant'].includes(role)) {
        return new Response(
          JSON.stringify({ error: `messages[${i}].role must be system, user, or assistant` }),
          { status: 400, headers: corsHeaders },
        )
      }
      const content = String((m as ChatMessage).content)
      if (content.length > MAX_CONTENT_LENGTH) {
        return new Response(
          JSON.stringify({ error: `messages[${i}].content exceeds ${MAX_CONTENT_LENGTH} characters` }),
          { status: 400, headers: corsHeaders },
        )
      }
      validatedMessages.push({ role, content })
    }

    // ── Quota check ────────────────────────────────────────────────────
    if (currentUsage >= limit) {
      return new Response(
        JSON.stringify({ error: 'Daily AI usage limit reached; resets at midnight UTC.' }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            ...buildRateLimitHeaders(limit, currentUsage, getMidnightUtcNext()),
            'Retry-After': String(getSecondsUntilMidnightUtc()),
          },
        },
      )
    }

    // ── Increment usage (before calling provider) ──────────────────────
    const incrementUsage = async () => {
      const { data: newCount, error: rpcError } = await supabaseService.rpc('increment_ai_daily_usage', {
        p_user_id: user.id,
        p_usage_date: today,
      })
      if (rpcError) throw rpcError
      return typeof newCount === 'number' ? newCount : (newCount as number[])?.[0] ?? currentUsage + 1
    }

    // ── Streaming path ─────────────────────────────────────────────────
    if (wantStream) {
      const openaiRes = await callOpenAIChat(apiKey, validatedMessages, true)

      if (!openaiRes.ok) {
        const { safeMessage } = await readProviderError(openaiRes)
        return new Response(
          JSON.stringify({ error: safeMessage }),
          { status: openaiRes.status, headers: corsHeaders },
        )
      }

      await incrementUsage()

      return new Response(openaiRes.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // ── Non-streaming path (original) ──────────────────────────────────
    const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        messages: validatedMessages.map((m) => ({ role: m.role, content: m.content })),
        max_completion_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const { rawMessage } = await readProviderError(response.clone())
      if (shouldRetryWithFallbackModel(response, rawMessage)) {
        await response.text()
        const fallbackResponse = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: FALLBACK_MODEL,
            messages: validatedMessages.map((m) => ({ role: m.role, content: m.content })),
            max_completion_tokens: 1024,
          }),
        })
        if (!fallbackResponse.ok) {
          const { safeMessage } = await readProviderError(fallbackResponse)
          return new Response(
            JSON.stringify({ error: safeMessage }),
            { status: fallbackResponse.status, headers: corsHeaders },
          )
        }

        const fallbackData = await fallbackResponse.json()
        const newUsage = await incrementUsage()

        const successHeaders = {
          ...corsHeaders,
          ...buildRateLimitHeaders(limit, newUsage, getMidnightUtcNext()),
        }
        return new Response(JSON.stringify(fallbackData), {
          headers: successHeaders,
        })
      }

      const { safeMessage } = await readProviderError(response)
      return new Response(
        JSON.stringify({ error: safeMessage }),
        { status: response.status, headers: corsHeaders },
      )
    }

    const data = await response.json()
    const newUsage = await incrementUsage()

    const successHeaders = {
      ...corsHeaders,
      ...buildRateLimitHeaders(limit, newUsage, getMidnightUtcNext()),
    }
    return new Response(JSON.stringify(data), {
      headers: successHeaders,
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: scrubError(err) }),
      { status: 500, headers: { ...getCorsHeaders(origin ?? null), 'Content-Type': 'application/json' } },
    )
  }
})
