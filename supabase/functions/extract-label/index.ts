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
import { buildRateLimitHeaders, runQuotaTrackedRequest } from '../_shared/quota-tracker.ts'

const ALLOWED_MODEL = 'gpt-5-nano'
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
  const originAllowed = origin != null && origin !== 'null' &&
    (allowed.includes('*') || allowed.includes(origin))
  return {
    'Access-Control-Allow-Origin': originAllowed ? origin! : 'https://marinloop.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
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

const PILL_IDENTIFICATION_SYSTEM_PROMPT = `Identify this pill from the photo. Describe its color, shape, size, and any imprint text or markings.
Then provide your best identification of the drug name, generic name, and dosage strength based on the visual characteristics.
Return ONLY a JSON object: {"name":"...","dosage":"...","imprint":"...","color":"...","shape":"...","confidence":0.0-1.0}`

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
  mode?: unknown
}

interface PillIdentifyResult {
  name?: string | null
  dosage?: string | null
  imprint?: string | null
  color?: string | null
  shape?: string | null
  confidence?: number
}

function parseAndValidatePill(body: unknown): PillIdentifyResult | null {
  if (!body || typeof body !== 'object') return null
  const obj = body as Record<string, unknown>
  const result: PillIdentifyResult = {}
  if (obj.name != null && typeof obj.name === 'string') result.name = obj.name
  if (obj.dosage != null && typeof obj.dosage === 'string') result.dosage = obj.dosage
  if (obj.imprint != null && typeof obj.imprint === 'string') result.imprint = obj.imprint
  if (obj.color != null && typeof obj.color === 'string') result.color = obj.color
  if (obj.shape != null && typeof obj.shape === 'string') result.shape = obj.shape
  if (obj.confidence != null && typeof obj.confidence === 'number') result.confidence = obj.confidence
  return result
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

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: corsHeaders },
      )
    }
    const supabaseService = createClient(supabaseUrl, serviceRoleKey)
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

    const limit = getAiDailyLimit()
    const currentUsage = usageRow?.request_count ?? 0
    let imageList: string[] = []
    let isPillMode = false

    const quotaResult = await runQuotaTrackedRequest({
      limit,
      currentUsage,
      resetAt: getMidnightUtcNext(),
      retryAfterSeconds: getSecondsUntilMidnightUtc(),
      baseHeaders: corsHeaders,
      limitReachedMessage: 'Daily limit reached. Try again tomorrow.',
      validate: async () => {
        let body: LabelExtractPayload
        try {
          body = (await req.json()) as LabelExtractPayload
        } catch {
          return {
            ok: false,
            response: new Response(
              JSON.stringify({ error: 'Invalid JSON body' }),
              { status: 400, headers: corsHeaders },
            ),
          }
        }

        // Support both `images` array (new) and `imageBase64` string (legacy)
        if (Array.isArray(body.images)) {
          imageList = (body.images as unknown[]).filter((i): i is string => typeof i === 'string' && i.length > 0)
        } else if (typeof body.imageBase64 === 'string' && body.imageBase64.length > 0) {
          imageList = [body.imageBase64]
        }

        if (imageList.length === 0) {
          return {
            ok: false,
            response: new Response(
              JSON.stringify({ error: 'At least one image is required (images[] or imageBase64)' }),
              { status: 400, headers: corsHeaders },
            ),
          }
        }
        if (imageList.length > MAX_IMAGES) {
          return {
            ok: false,
            response: new Response(
              JSON.stringify({ error: `Maximum ${MAX_IMAGES} images allowed` }),
              { status: 400, headers: corsHeaders },
            ),
          }
        }

        const totalSize = imageList.reduce((sum, img) => sum + new TextEncoder().encode(img).length, 0)
        if (totalSize > MAX_TOTAL_BASE64_BYTES) {
          return {
            ok: false,
            response: new Response(
              JSON.stringify({ error: 'Photos too large. Try smaller images.' }),
              { status: 400, headers: corsHeaders },
            ),
          }
        }

        const mode = typeof body.mode === 'string' && body.mode === 'pill' ? 'pill' : 'label'
        isPillMode = mode === 'pill'
        return { ok: true, data: undefined }
      },
      callProvider: async () => {

    const imageCount = imageList.length
    let textInstruction: string
    if (isPillMode) {
      textInstruction = imageCount > 1
        ? `Identify the pill shown in these ${imageCount} photos. Return only valid JSON.`
        : 'Identify the pill shown in this photo. Return only valid JSON.'
    } else {
      textInstruction = imageCount > 1
        ? `Extract and MERGE medication information from these ${imageCount} prescription label photos (different sides of the same bottle). Return only valid JSON.`
        : 'Extract medication information from this prescription label. Return only valid JSON.'
    }

    const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: string } }> = [
      { type: 'text', text: textInstruction },
      ...imageList.map((img) => ({ type: 'image_url' as const, image_url: { url: img, detail: 'low' } })),
    ]

    const systemPrompt = isPillMode ? PILL_IDENTIFICATION_SYSTEM_PROMPT : EXTRACTION_SYSTEM_PROMPT

    const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ALLOWED_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
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
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: safeMessage }),
          { status: response.status, headers: corsHeaders },
        ),
      }
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content
    if (typeof rawContent !== 'string') {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: 'Invalid extraction response' }),
          { status: 500, headers: corsHeaders },
        ),
      }
    }

    let parsed: unknown
    try {
      const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: 'Could not parse extraction' }),
          { status: 500, headers: corsHeaders },
        ),
      }
    }

    const result = isPillMode ? parseAndValidatePill(parsed) : parseAndValidate(parsed)
    if (!result) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: 'Invalid extraction structure' }),
          { status: 500, headers: corsHeaders },
        ),
      }
    }

    return { ok: true, data: result }
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
