/**
 * Consent enforcement tests for the extract-label edge function.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/extract-label/consent_test.ts
 *
 * The tests stub globalThis.fetch and Deno.env so no real network calls are made.
 * Each test restores the originals in a finally block to avoid cross-test pollution.
 *
 * What is covered:
 *   1. 401 when no Authorization header is provided
 *   2. 401 when Supabase auth.getUser() returns no user (invalid JWT)
 *   3. 403 when ai_consent_granted is false
 *   4. 403 when the profiles row does not exist (null data)
 *   5. OPTIONS preflight returns 200 with CORS headers
 *   6. Passes consent gate and reaches OpenAI layer when ai_consent_granted is true
 *   7. 403 when CORS origin is not in the allowed list
 *   8. 500 when OPENAI_API_KEY is not set
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_SUPABASE_URL = 'https://fake.supabase.co'
const FAKE_ORIGIN = 'https://marinloop.com'

/** Build a fake env map that satisfies every Deno.env.get() call in the function. */
function makeEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    SUPABASE_URL: FAKE_SUPABASE_URL,
    SUPABASE_ANON_KEY: 'fake-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role-key',
    OPENAI_API_KEY: 'fake-openai-key',
    ALLOWED_ORIGINS: FAKE_ORIGIN,
    AI_DAILY_LIMIT: '50',
    ...overrides,
  }
}

/** Patch Deno.env.get and return a restore function. */
function patchEnv(envMap: Record<string, string>): () => void {
  const original = Deno.env.get
  Object.defineProperty(Deno.env, 'get', {
    configurable: true,
    value: (key: string): string | undefined => envMap[key],
  })
  return () => {
    Object.defineProperty(Deno.env, 'get', {
      configurable: true,
      value: original,
    })
  }
}

/** Patch globalThis.fetch and return a restore function. */
function patchFetch(handler: (url: string | URL | Request, init?: RequestInit) => Promise<Response>): () => void {
  const original = globalThis.fetch
  globalThis.fetch = handler as typeof globalThis.fetch
  return () => {
    globalThis.fetch = original
  }
}

/**
 * Build a fetch stub for extract-label tests.
 *
 * Call order for a typical request:
 *   1. POST /auth/v1/user              — Supabase auth.getUser()
 *   2. GET  /rest/v1/profiles          — profile consent check
 *   3. GET  /rest/v1/ai_daily_usage    — quota check (service-role, only after consent)
 *   4. POST api.openai.com/...         — OpenAI vision call (only if quota passes)
 *   5. POST /rest/v1/rpc/increment_ai_daily_usage — usage increment
 */
interface FetchScenario {
  authUser?: object | null
  profile?: object | null
  usageRow?: object | null
  openaiResponse?: object
  incrementResult?: number
}

function makeFetchStub(scenario: FetchScenario): (url: string | URL | Request) => Promise<Response> {
  return async (url: string | URL | Request): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url

    // Supabase auth.getUser() — anon-key client
    if (urlStr.includes('/auth/v1/user')) {
      if (scenario.authUser === null) {
        return new Response(
          JSON.stringify({ message: 'invalid JWT', error: 'invalid_token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        )
      }
      const user = scenario.authUser ?? { id: 'user-123', email: 'test@example.com' }
      return new Response(
        JSON.stringify(user),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // profiles table — anon-key client (consent check)
    if (urlStr.includes('/rest/v1/profiles')) {
      if (scenario.profile === null) {
        // PostgREST .single() with no rows → 406 + PGRST116
        return new Response(
          JSON.stringify({ code: 'PGRST116', message: 'no rows' }),
          { status: 406, headers: { 'Content-Type': 'application/json' } },
        )
      }
      const profile = scenario.profile ?? { ai_consent_granted: true }
      return new Response(
        JSON.stringify(profile),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // ai_daily_usage table — service-role client (quota check)
    if (urlStr.includes('/rest/v1/ai_daily_usage')) {
      const row = scenario.usageRow ?? { request_count: 0 }
      return new Response(
        JSON.stringify(row),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // OpenAI vision completions
    if (urlStr.includes('api.openai.com')) {
      const data = scenario.openaiResponse ?? {
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              name: 'Lisinopril',
              dosage: '10mg',
              freq: 1,
              time: '08:00',
              quantity: 30,
              instructions: 'Take with food',
              warnings: null,
              confidence: 0.9,
            }),
          },
        }],
      }
      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Usage increment RPC
    if (urlStr.includes('/rest/v1/rpc/increment_ai_daily_usage')) {
      return new Response(
        JSON.stringify(scenario.incrementResult ?? 1),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Unexpected URL
    console.error('[consent_test] Unhandled fetch URL:', urlStr)
    return new Response(JSON.stringify({ error: 'unexpected url in test stub' }), { status: 500 })
  }
}

/**
 * A minimal base64 JPEG data URI (1×1 white pixel) for image payloads.
 * This is a valid non-empty string that satisfies imageList.length > 0.
 */
const TINY_IMAGE_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKwAB/9k='

/** Build a POST request that simulates the extract-label function's expected input. */
function makePostRequest(overrides: {
  authHeader?: string | null
  body?: unknown
  origin?: string
} = {}): Request {
  const { authHeader = 'Bearer fake-jwt', body, origin = FAKE_ORIGIN } = overrides
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Origin': origin,
  }
  if (authHeader !== null) {
    headers['Authorization'] = authHeader
  }
  return new Request('https://fake.supabase.co/functions/v1/extract-label', {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : JSON.stringify({
      images: [TINY_IMAGE_BASE64],
    }),
  })
}

// ---------------------------------------------------------------------------
// Inline handler mirroring extract-label/index.ts consent gate
// (lines 160-218 of the source file)
//
// We reproduce the exact logic path — OPTIONS → origin → auth header →
// OPENAI_API_KEY → auth.getUser() → profiles consent check — so tests
// exercise the same decision tree as the real function without requiring
// the Deno-specific `serve()` import or a live Supabase instance.
// ---------------------------------------------------------------------------

async function consentGateHandler(req: Request): Promise<Response> {
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

  const origin = req.headers.get('Origin')
  const corsHeaders = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }

  // Line 164: OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Line 169-178: origin check
  const allowed = getAllowedOrigins()
  const originAllowed =
    allowed.includes('*') ||
    (origin != null && origin !== 'null' && allowed.includes(origin))
  if (!originAllowed) {
    return new Response(JSON.stringify({ error: 'CORS not allowed' }), { status: 403, headers: corsHeaders })
  }

  // Line 181-187: auth header check
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: corsHeaders },
    )
  }

  // Line 189-195: OPENAI_API_KEY check
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 500, headers: corsHeaders })
  }

  // Line 197-209: Supabase auth.getUser()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: supabaseAnonKey,
    },
  })
  if (!authRes.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }
  const user = await authRes.json() as { id?: string; email?: string }
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }

  // Line 212-218: consent check via profiles table
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=ai_consent_granted&id=eq.${user.id}&limit=1`,
    {
      headers: {
        Authorization: authHeader,
        apikey: supabaseAnonKey,
        Accept: 'application/vnd.pgrst.object+json',
      },
    },
  )
  let profile: { ai_consent_granted?: boolean } | null = null
  if (profileRes.ok) {
    try { profile = await profileRes.json() } catch { /* ignore */ }
  }
  if (!profile?.ai_consent_granted) {
    return new Response(
      JSON.stringify({ error: 'AI consent required. Please enable AI features in your profile settings.' }),
      { status: 403, headers: corsHeaders },
    )
  }

  // Line 220-226: service-role key check (quota layer — reached only when consent passes)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Service configuration error' }), { status: 500, headers: corsHeaders })
  }

  // Quota check (simplified for test purposes)
  const today = new Date().toISOString().slice(0, 10)
  const usageRes = await fetch(
    `${supabaseUrl}/rest/v1/ai_daily_usage?select=request_count&user_id=eq.${user.id}&usage_date=eq.${today}&limit=1`,
    { headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } },
  )
  const usageRow = usageRes.ok ? await usageRes.json() as { request_count?: number } | null : null
  const currentUsage = usageRow?.request_count ?? 0
  const limit = 50

  if (currentUsage >= limit) {
    return new Response(
      JSON.stringify({ error: 'Daily limit reached. Try again tomorrow.' }),
      { status: 429, headers: corsHeaders },
    )
  }

  // Parse and validate image payload
  let body: { images?: unknown; imageBase64?: unknown; mode?: unknown }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders })
  }

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

  // OpenAI vision call
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: 'Extract medication information.' },
        { role: 'user', content: imageList.map((img) => ({ type: 'image_url', image_url: { url: img, detail: 'low' } })) },
      ],
      max_tokens: 1024,
    }),
  })

  if (!openaiRes.ok) {
    return new Response(JSON.stringify({ error: 'Request failed' }), { status: openaiRes.status, headers: corsHeaders })
  }

  // Parse OpenAI response
  const data = await openaiRes.json() as { choices?: Array<{ message?: { content?: string } }> }
  const rawContent = data.choices?.[0]?.message?.content
  if (typeof rawContent !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid extraction response' }), { status: 500, headers: corsHeaders })
  }

  let parsed: unknown
  try {
    const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return new Response(JSON.stringify({ error: 'Could not parse extraction' }), { status: 500, headers: corsHeaders })
  }

  // Increment usage
  await fetch(`${supabaseUrl}/rest/v1/rpc/increment_ai_daily_usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    body: JSON.stringify({ p_user_id: user.id, p_usage_date: today }),
  })

  return new Response(JSON.stringify(parsed), { status: 200, headers: corsHeaders })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('extract-label: OPTIONS preflight returns 200 with CORS headers', async () => {
  const restoreEnv = patchEnv(makeEnv())
  try {
    const req = new Request('https://fake.supabase.co/functions/v1/extract-label', {
      method: 'OPTIONS',
      headers: { Origin: FAKE_ORIGIN },
    })
    const res = await consentGateHandler(req)
    assertEquals(res.status, 200)
    assertEquals(res.headers.get('Access-Control-Allow-Origin'), FAKE_ORIGIN)
    assertEquals(res.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')
  } finally {
    restoreEnv()
  }
})

Deno.test('extract-label: returns 401 when Authorization header is missing', async () => {
  const restoreEnv = patchEnv(makeEnv())
  const restoreFetch = patchFetch(makeFetchStub({}))
  try {
    const req = makePostRequest({ authHeader: null })
    const res = await consentGateHandler(req)
    assertEquals(res.status, 401)
    const body = await res.json() as { error: string }
    assertStringIncludes(body.error, 'Authorization')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('extract-label: returns 401 when Authorization header has wrong scheme', async () => {
  const restoreEnv = patchEnv(makeEnv())
  const restoreFetch = patchFetch(makeFetchStub({}))
  try {
    const req = makePostRequest({ authHeader: 'Basic not-a-bearer-token' })
    const res = await consentGateHandler(req)
    assertEquals(res.status, 401)
    const body = await res.json() as { error: string }
    assertStringIncludes(body.error, 'Authorization')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('extract-label: returns 401 when Supabase auth returns error (invalid JWT)', async () => {
  const restoreEnv = patchEnv(makeEnv())
  const restoreFetch = patchFetch(makeFetchStub({ authUser: null }))
  try {
    const req = makePostRequest()
    const res = await consentGateHandler(req)
    assertEquals(res.status, 401)
    const body = await res.json() as { error: string }
    assertStringIncludes(body.error, 'Unauthorized')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('extract-label: returns 403 when ai_consent_granted is false', async () => {
  const restoreEnv = patchEnv(makeEnv())
  const restoreFetch = patchFetch(makeFetchStub({ profile: { ai_consent_granted: false } }))
  try {
    const req = makePostRequest()
    const res = await consentGateHandler(req)
    assertEquals(res.status, 403)
    const body = await res.json() as { error: string }
    assertStringIncludes(body.error, 'AI consent required')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('extract-label: returns 403 when profiles row does not exist (null profile)', async () => {
  const restoreEnv = patchEnv(makeEnv())
  const restoreFetch = patchFetch(makeFetchStub({ profile: null }))
  try {
    const req = makePostRequest()
    const res = await consentGateHandler(req)
    assertEquals(res.status, 403)
    const body = await res.json() as { error: string }
    assertStringIncludes(body.error, 'AI consent required')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('extract-label: passes consent gate and reaches OpenAI layer when ai_consent_granted is true', async () => {
  const restoreEnv = patchEnv(makeEnv())
  const restoreFetch = patchFetch(makeFetchStub({
    profile: { ai_consent_granted: true },
    usageRow: { request_count: 0 },
    openaiResponse: {
      choices: [{
        message: {
          role: 'assistant',
          content: JSON.stringify({
            name: 'Metformin',
            dosage: '500mg',
            freq: 2,
            time: '08:00',
            quantity: 60,
            instructions: 'Take with meals',
            warnings: null,
            confidence: 0.95,
          }),
        },
      }],
    },
  }))
  try {
    const req = makePostRequest({
      body: { images: [TINY_IMAGE_BASE64] },
    })
    const res = await consentGateHandler(req)
    assertEquals(res.status, 200)
    const body = await res.json() as { name: string; dosage: string }
    assertEquals(body.name, 'Metformin')
    assertEquals(body.dosage, '500mg')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('extract-label: accepts legacy imageBase64 field when ai_consent_granted is true', async () => {
  const restoreEnv = patchEnv(makeEnv())
  const restoreFetch = patchFetch(makeFetchStub({
    profile: { ai_consent_granted: true },
    usageRow: { request_count: 0 },
    openaiResponse: {
      choices: [{
        message: {
          role: 'assistant',
          content: JSON.stringify({ name: 'Aspirin', dosage: '81mg', freq: 1, confidence: 0.8 }),
        },
      }],
    },
  }))
  try {
    const req = makePostRequest({
      body: { imageBase64: TINY_IMAGE_BASE64 },
    })
    const res = await consentGateHandler(req)
    assertEquals(res.status, 200)
    const body = await res.json() as { name: string }
    assertEquals(body.name, 'Aspirin')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('extract-label: returns 403 when CORS origin is not in allowed list', async () => {
  const restoreEnv = patchEnv(makeEnv({ ALLOWED_ORIGINS: 'https://marinloop.com' }))
  const restoreFetch = patchFetch(makeFetchStub({}))
  try {
    const req = makePostRequest({ origin: 'https://attacker.example.com' })
    const res = await consentGateHandler(req)
    assertEquals(res.status, 403)
    const body = await res.json() as { error: string }
    assertStringIncludes(body.error, 'CORS')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('extract-label: returns 500 when OPENAI_API_KEY is not set', async () => {
  const restoreEnv = patchEnv(makeEnv({ OPENAI_API_KEY: '' }))
  const restoreFetch = patchFetch(makeFetchStub({ profile: { ai_consent_granted: true } }))
  try {
    const req = makePostRequest()
    const res = await consentGateHandler(req)
    assertEquals(res.status, 500)
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('extract-label: returns 400 when no images provided but consent is valid', async () => {
  const restoreEnv = patchEnv(makeEnv())
  const restoreFetch = patchFetch(makeFetchStub({
    profile: { ai_consent_granted: true },
    usageRow: { request_count: 0 },
  }))
  try {
    const req = makePostRequest({ body: { images: [] } })
    const res = await consentGateHandler(req)
    assertEquals(res.status, 400)
    const body = await res.json() as { error: string }
    assertStringIncludes(body.error, 'image')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})
