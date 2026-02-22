// Supabase Edge Function: extract-label
// Extracts medication info from label photos using OpenAI vision. Supports multiple images.
//
// Usage: POST with Authorization: Bearer <user-jwt>
// Body: { images: ["data:image/jpeg;base64,...", ...] }  (or legacy: { imageBase64: "..." })
//
// Requires: OPENAI_API_KEY, ALLOWED_ORIGINS. Reuses AI_DAILY_LIMIT (shared with openai-chat).
// Max total payload: 18MB base64. Max 5 images. Returns 400 if exceeded.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_MODEL = 'gpt-4o-mini'
const MAX_TOTAL_BASE64_BYTES = 18 * 1024 * 1024 // 18MB total across all images
const MAX_IMAGES = 5

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

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins()
  const effectiveOrigin =
    origin && origin !== 'null'
      ? (allowed.includes('*') || allowed.includes(origin) || allowed.length === 0)
        ? origin
        : '*'
      : '*'
  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const EXTRACTION_SYSTEM_PROMPT = `You extract medication information from prescription label photos. You may receive MULTIPLE images showing different sides of the same bottle — merge all visible information into ONE result. Return ONLY valid JSON, no markdown, no code blocks.

Rules:
- MERGE info across all images. The medication name may appear on one side, warnings on another, pharmacy info on another.
- Extract only what is clearly visible. Never invent or guess medication names or doses.
- Omit or use null for fields you cannot read from ANY image.
- freq: 1 = once daily, 2 = twice daily, 3 = three times daily. Infer from "morning and evening", "every 12 hours", etc.
- time: use "08:00" for morning, "20:00" for evening when exact time is not given.
- instructions: combine all dosage instructions visible across images (e.g. "Take with food", "Take with plenty of water").
- warnings: combine ALL warnings visible across images into one string, separated by ". ". Include drug interaction warnings, side effects, storage instructions.
- quantity: look for QTY on the pharmacy label.
- confidence: 0–1 based on text clarity and completeness of extraction across all images.

Output JSON schema:
{
  "name": string | null,
  "dosage": string | null,
  "freq": 1 | 2 | 3 | null,
  "time": string | null,
  "quantity": number | null,
  "instructions": string | null,
  "warnings": string | null,
  "confidence": number
}`

function scrubError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('OPENAI') || msg.includes('sk-') || msg.includes('api.openai.com')) {
    return 'Request failed'
  }
  return msg
}

interface LabelExtractPayload {
  imageBase64?: unknown
  images?: unknown
}

interface LabelExtractResult {
  name?: string | null
  dosage?: string | null
  freq?: number | null
  time?: string | null
  quantity?: number | null
  instructions?: string | null
  warnings?: string | null
  confidence?: number
}

function parseAndValidate(body: unknown): LabelExtractResult | null {
  if (!body || typeof body !== 'object') return null
  const obj = body as Record<string, unknown>
  const result: LabelExtractResult = {}
  if (obj.name != null && typeof obj.name === 'string') result.name = obj.name
  if (obj.dosage != null && typeof obj.dosage === 'string') result.dosage = obj.dosage
  if (obj.freq != null && typeof obj.freq === 'number' && [1, 2, 3].includes(obj.freq)) result.freq = obj.freq
  if (obj.time != null && typeof obj.time === 'string') result.time = obj.time
  if (obj.quantity != null && typeof obj.quantity === 'number') result.quantity = obj.quantity
  if (obj.instructions != null && typeof obj.instructions === 'string') result.instructions = obj.instructions
  if (obj.warnings != null && typeof obj.warnings === 'string') result.warnings = obj.warnings
  if (obj.confidence != null && typeof obj.confidence === 'number') result.confidence = obj.confidence
  return result
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Check origin: allow if ALLOWED_ORIGINS contains '*', is empty (open), or includes the origin.
  const allowed = getAllowedOrigins()
  const originAllowed =
    allowed.length === 0 ||
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
      const retryAfter = getSecondsUntilMidnightUtc()
      const headers = {
        ...corsHeaders,
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(getMidnightUtcNext()),
        'Retry-After': String(retryAfter),
      }
      return new Response(
        JSON.stringify({ error: 'Daily limit reached. Try again tomorrow.' }),
        { status: 429, headers },
      )
    }

    let body: LabelExtractPayload
    try {
      body = (await req.json()) as LabelExtractPayload
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: corsHeaders },
      )
    }

    // Support both `images` array (new) and `imageBase64` string (legacy)
    let imageList: string[] = []
    if (Array.isArray(body.images)) {
      imageList = (body.images as unknown[]).filter((i): i is string => typeof i === 'string' && i.length > 0)
    } else if (typeof body.imageBase64 === 'string' && body.imageBase64.length > 0) {
      imageList = [body.imageBase64]
    }

    if (imageList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one image is required (images[] or imageBase64)' }),
        { status: 400, headers: corsHeaders },
      )
    }
    if (imageList.length > MAX_IMAGES) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_IMAGES} images allowed` }),
        { status: 400, headers: corsHeaders },
      )
    }

    const totalSize = imageList.reduce((sum, img) => sum + new TextEncoder().encode(img).length, 0)
    if (totalSize > MAX_TOTAL_BASE64_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Photos too large. Try smaller images.' }),
        { status: 400, headers: corsHeaders },
      )
    }

    const imageCount = imageList.length
    const textInstruction = imageCount > 1
      ? `Extract and MERGE medication information from these ${imageCount} prescription label photos (different sides of the same bottle). Return only valid JSON.`
      : 'Extract medication information from this prescription label. Return only valid JSON.'

    const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
      { type: 'text', text: textInstruction },
      ...imageList.map((img) => ({ type: 'image_url' as const, image_url: { url: img } })),
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ALLOWED_MODEL,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
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
    const rawContent = data.choices?.[0]?.message?.content
    if (typeof rawContent !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid extraction response' }),
        { status: 500, headers: corsHeaders },
      )
    }

    let parsed: unknown
    try {
      const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Could not parse extraction' }),
        { status: 500, headers: corsHeaders },
      )
    }

    const result = parseAndValidate(parsed)
    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Invalid extraction structure' }),
        { status: 500, headers: corsHeaders },
      )
    }

    const successHeaders = {
      ...corsHeaders,
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(Math.max(0, limit - requestCount)),
      'X-RateLimit-Reset': String(getMidnightUtcNext()),
    }
    return new Response(JSON.stringify(result), {
      headers: successHeaders,
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: scrubError(err) }),
      { status: 500, headers: { ...getCorsHeaders(origin ?? null), 'Content-Type': 'application/json' } },
    )
  }
})
