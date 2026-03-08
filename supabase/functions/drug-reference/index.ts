// Supabase Edge Function: drug-reference
// Server-side proxy for NIH RxNav and OpenFDA API calls.
// Prevents client IP and medication lookup patterns from being sent to third-party APIs.
//
// Usage: POST with Authorization: Bearer <user-jwt>
// Body: { action: string; params: Record<string, unknown> }
//
// Requires: SUPABASE_URL, SUPABASE_ANON_KEY. In production, set ALLOWED_ORIGINS (comma-separated).
// If ALLOWED_ORIGINS is unset or empty, no origin is allowed (fail-closed).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// ── Helper: clean raw label text (same logic as client-side helpers) ──────────

function cleanText(text: string | undefined): string {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

// ── NDC / barcode helpers (ported from openfda.ts) ────────────────────────────

interface NdcProduct {
  brand_name?: string
  generic_name?: string
  active_ingredients?: Array<{ strength: string }>
  route?: string[]
  dosage_form?: string
  pharm_class?: string[]
}

interface MedLookupResult {
  name: string
  dosage: string
  instructions: string
  warnings: string
}

function isHyphenatedNdc(s: string): boolean {
  return /^\d{4,5}-\d{3,4}-\d{1,2}$/.test(s.replace(/\s/g, ''))
}

function upcToNdcVariants(barcode: string): string[] {
  const digits = barcode.replace(/\D/g, '')
  if (digits.length < 10) return []

  if (isHyphenatedNdc(barcode)) {
    return [barcode.replace(/\s/g, '')]
  }

  let ndc10: string
  if (digits.length >= 12) {
    ndc10 = digits.slice(1, 11)
  } else if (digits.length === 11) {
    ndc10 = digits.slice(0, 10)
  } else {
    ndc10 = digits.slice(0, 10)
  }

  const variants = [
    `${ndc10.slice(0, 4)}-${ndc10.slice(4, 8)}-${ndc10.slice(8, 10)}`,
    `${ndc10.slice(0, 5)}-${ndc10.slice(5, 8)}-${ndc10.slice(8, 10)}`,
    `${ndc10.slice(0, 5)}-${ndc10.slice(5, 9)}-${ndc10.slice(9, 10)}`,
  ]

  const ndc11 = digits.length >= 11 ? digits.slice(0, 11) : ndc10 + '0'
  if (ndc11.length >= 11) {
    variants.push(
      `${ndc11.slice(0, 5)}-${ndc11.slice(5, 9)}-${ndc11.slice(9, 11)}`
    )
  }

  return [...new Set(variants)]
}

function extractFromNdcResult(product: NdcProduct): MedLookupResult {
  const name = product.brand_name || product.generic_name || ''
  const strength = product.active_ingredients
    ?.map((i) => i.strength)
    .join(', ') || ''
  const route = product.route?.[0] || ''
  const dosageForm = product.dosage_form || ''
  return {
    name,
    dosage: strength,
    instructions: [dosageForm, route].filter(Boolean).join(' — '),
    warnings: product.pharm_class?.join(', ') || '',
  }
}

// ── Action handlers ───────────────────────────────────────────────────────────

async function handleLookupRxCUI(params: Record<string, unknown>): Promise<Response> {
  const name = params.name
  if (typeof name !== 'string' || !name.trim()) {
    return new Response(JSON.stringify(null), { status: 200 })
  }
  const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name.trim())}&search=1`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return new Response(JSON.stringify(null), { status: 200 })
    }
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ _error: 'upstream_failed' }), { status: 502 })
  }
}

async function handleGetDrugInteractions(params: Record<string, unknown>): Promise<Response> {
  const rxcuis = params.rxcuis
  if (!Array.isArray(rxcuis) || rxcuis.length < 2) {
    return new Response(JSON.stringify({ fullInteractionTypeGroup: [] }), { status: 200 })
  }
  const joined = (rxcuis as string[]).filter(Boolean).join('+')
  const url = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${joined}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return new Response(JSON.stringify({ fullInteractionTypeGroup: [] }), { status: 200 })
    }
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ _error: 'upstream_failed' }), { status: 502 })
  }
}

async function handleGetIngredients(params: Record<string, unknown>): Promise<Response> {
  const rxcui = params.rxcui
  if (typeof rxcui !== 'string' || !rxcui) {
    return new Response(JSON.stringify({}), { status: 200 })
  }
  const url = `https://rxnav.nlm.nih.gov/REST/rxcui/${encodeURIComponent(rxcui)}/related.json?rela=has_ingredient`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return new Response(JSON.stringify({}), { status: 200 })
    }
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ _error: 'upstream_failed' }), { status: 502 })
  }
}

async function handleGetCatchUpGuidance(params: Record<string, unknown>): Promise<Response> {
  const rxcui = params.rxcui
  if (typeof rxcui !== 'string' || !rxcui) {
    return new Response(JSON.stringify(null), { status: 200 })
  }
  const url = `https://api.fda.gov/drug/label.json?search=openfda.rxcui:"${encodeURIComponent(rxcui)}"&limit=1`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return new Response(JSON.stringify(null), { status: 200 })
    }
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ _error: 'upstream_failed' }), { status: 502 })
  }
}

async function handleGetOpenFDALabel(params: Record<string, unknown>): Promise<Response> {
  const rxcui = params.rxcui
  if (typeof rxcui !== 'string' || !rxcui) {
    return new Response(JSON.stringify(null), { status: 200 })
  }
  const url = `https://api.fda.gov/drug/label.json?search=openfda.rxcui:"${encodeURIComponent(rxcui)}"&limit=1`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return new Response(JSON.stringify(null), { status: 200 })
    }
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ _error: 'upstream_failed' }), { status: 502 })
  }
}

async function handleLookupByBarcode(params: Record<string, unknown>): Promise<Response> {
  const barcode = params.barcode
  if (typeof barcode !== 'string' || !barcode) {
    return new Response(JSON.stringify(null), { status: 200 })
  }

  const digits = barcode.replace(/\D/g, '')

  // Strategy 1: Search by UPC directly
  if (digits.length >= 11) {
    try {
      const upcRes = await fetch(
        `https://api.fda.gov/drug/ndc.json?search=openfda.upc:"${digits}"&limit=1`
      )
      if (upcRes.ok) {
        const data = await upcRes.json()
        const product = data.results?.[0] as NdcProduct | undefined
        if (product) {
          return new Response(JSON.stringify(extractFromNdcResult(product)), { status: 200 })
        }
      }
    } catch {
      // continue to next strategy
    }
  }

  const ndcVariants = upcToNdcVariants(barcode)
  if (ndcVariants.length === 0) {
    return new Response(JSON.stringify(null), { status: 200 })
  }

  // Strategy 2: packaging.package_ndc
  for (const ndc of ndcVariants) {
    try {
      const ndcRes = await fetch(
        `https://api.fda.gov/drug/ndc.json?search=packaging.package_ndc:"${ndc}"&limit=1`
      )
      if (ndcRes.ok) {
        const data = await ndcRes.json()
        const product = data.results?.[0] as NdcProduct | undefined
        if (product) {
          return new Response(JSON.stringify(extractFromNdcResult(product)), { status: 200 })
        }
      }
    } catch {
      // try next
    }
  }

  // Strategy 3: product_ndc (without package segment)
  for (const ndc of ndcVariants) {
    const productNdc = ndc.split('-').slice(0, 2).join('-')
    try {
      const res = await fetch(
        `https://api.fda.gov/drug/ndc.json?search=product_ndc:"${productNdc}"&limit=1`
      )
      if (res.ok) {
        const data = await res.json()
        const product = data.results?.[0] as NdcProduct | undefined
        if (product) {
          return new Response(JSON.stringify(extractFromNdcResult(product)), { status: 200 })
        }
      }
    } catch {
      // try next
    }
  }

  // Strategy 4: drug/label endpoint for richer data
  for (const ndc of ndcVariants) {
    try {
      const labelRes = await fetch(
        `https://api.fda.gov/drug/label.json?search=openfda.package_ndc:"${ndc}"&limit=1`
      )
      if (labelRes.ok) {
        const data = await labelRes.json()
        const label = data.results?.[0]
        if (label) {
          const result: MedLookupResult = {
            name: cleanText(label.openfda?.brand_name?.[0] || label.openfda?.generic_name?.[0]),
            dosage: cleanText(label.dosage_and_administration?.[0]),
            instructions: cleanText(label.indications_and_usage?.[0]),
            warnings: cleanText(label.warnings?.[0] || label.warnings_and_cautions?.[0]),
          }
          return new Response(JSON.stringify(result), { status: 200 })
        }
      }
    } catch {
      // try next
    }
  }

  return new Response(JSON.stringify(null), { status: 200 })
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Fail-closed when ALLOWED_ORIGINS is unset
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

    let body: { action: string; params: Record<string, unknown> }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: corsHeaders },
      )
    }

    const { action, params } = body
    if (!action || typeof action !== 'string') {
      return new Response(
        JSON.stringify({ error: 'action is required' }),
        { status: 400, headers: corsHeaders },
      )
    }

    const safeParams: Record<string, unknown> = params && typeof params === 'object' ? params : {}

    let actionResponse: Response
    switch (action) {
      case 'lookupRxCUI':
        actionResponse = await handleLookupRxCUI(safeParams)
        break
      case 'getDrugInteractions':
        actionResponse = await handleGetDrugInteractions(safeParams)
        break
      case 'getIngredients':
        actionResponse = await handleGetIngredients(safeParams)
        break
      case 'getCatchUpGuidance':
        actionResponse = await handleGetCatchUpGuidance(safeParams)
        break
      case 'getOpenFDALabel':
        actionResponse = await handleGetOpenFDALabel(safeParams)
        break
      case 'lookupByBarcode':
        actionResponse = await handleLookupByBarcode(safeParams)
        break
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: corsHeaders },
        )
    }

    // Propagate 502 from action handlers
    if (actionResponse.status === 502) {
      return new Response(
        JSON.stringify({ error: 'Upstream request failed' }),
        { status: 502, headers: corsHeaders },
      )
    }

    const data = await actionResponse.json()
    return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...getCorsHeaders(origin ?? null), 'Content-Type': 'application/json' } },
    )
  }
})
