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

const ALLOWED_MODEL = 'gpt-4o-mini'
const MAX_MESSAGES = 20
const MAX_CONTENT_LENGTH = 8000

function getAiDailyLimit(): number {
  const raw = Deno.env.get('AI_DAILY_LIMIT')
  if (raw == null || raw.trim() === '') return 50
  const n = parseInt(raw, 10)
  return Number.isNaN(n) || n < 1 ? 50 : n
}

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

function isNullOrigin(origin: string | null): boolean {
  return origin == null || origin === 'null'
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins()
  const nullOrigin = isNullOrigin(origin)
  const allowOrigin =
    allowed.includes('*') ? (origin && origin !== 'null' ? origin : '*')
      : (origin && origin !== 'null' && allowed.includes(origin)) ? origin
        : (nullOrigin && allowed.length > 0) ? '*'
          : null
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (allowOrigin != null) {
    headers['Access-Control-Allow-Origin'] = allowOrigin
    headers['Vary'] = 'Origin'
  }
  return headers
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

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Fail closed: reject requests from disallowed origins (no auth/OpenAI for them).
  const allowed = getAllowedOrigins()
  const nullOrigin = isNullOrigin(origin)
  const originAllowed =
    allowed.includes('*') ||
    (origin != null && origin !== 'null' && allowed.includes(origin)) ||
    (nullOrigin && allowed.length > 0)
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

    // Per-user daily quota (service-role client bypasses RLS)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: corsHeaders },
      )
    }
    const supabaseService = createClient(supabaseUrl, serviceRoleKey)
    const today = new Date().toISOString().slice(0, 10)
    const { data: newCount, error: rpcError } = await supabaseService.rpc('increment_ai_daily_usage', {
      p_user_id: user.id,
      p_usage_date: today,
    })
    if (rpcError) {
      return new Response(
        JSON.stringify({ error: scrubError(rpcError) }),
        { status: 500, headers: corsHeaders },
      )
    }
    const requestCount = typeof newCount === 'number' ? newCount : (newCount as number[])?.[0] ?? 0
    const limit = getAiDailyLimit()
    if (requestCount > limit) {
      const resetAt = getMidnightUtcNext()
      const retryAfter = getSecondsUntilMidnightUtc()
      const headers = {
        ...corsHeaders,
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(resetAt),
        'Retry-After': String(retryAfter),
      }
      return new Response(
        JSON.stringify({ error: 'Daily AI usage limit reached; resets at midnight UTC.' }),
        { status: 429, headers },
      )
    }

    let body: ChatPayload
    try {
      body = (await req.json()) as ChatPayload
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: corsHeaders },
      )
    }

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

    const messages: ChatMessage[] = []
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
      messages.push({ role, content })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ALLOWED_MODEL,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      await response.text()
      const safeMessage = response.status === 429
        ? 'Too many requests; try again later'
        : 'Request failed'
      return new Response(
        JSON.stringify({ error: safeMessage }),
        { status: response.status, headers: corsHeaders },
      )
    }

    const data = await response.json()
    const remaining = Math.max(0, limit - requestCount)
    const successHeaders = {
      ...corsHeaders,
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(getMidnightUtcNext()),
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
