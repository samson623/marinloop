// Supabase Edge Function: send-push
// Sends Web Push notifications to a user's subscribed devices.
// Usage: invoke with { user_id, title, body, url?, tag? }
// Requires Supabase secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// ALLOWED_ORIGINS: comma-separated browser origins (fail-closed for browser requests).
// Server-to-server calls (pg_cron, no Origin header) bypass CORS and rely on auth.

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
        'Vary': 'Origin',
    }
}

interface PushPayload {
    user_id: string
    title: string
    body: string
    url?: string
    tag?: string
}

serve(async (req) => {
    const origin = req.headers.get('Origin')

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsHeaders(origin) })
    }

    const corsHeaders = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
    const log = (msg: string) => console.log(`[send-push] ${msg}`)

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, Allow: 'POST, OPTIONS' } }
        )
    }

    // CORS check: null origin = server-to-server call (pg_cron), always pass through.
    // Non-null origin must be in ALLOWED_ORIGINS (fail-closed).
    const allowed = getAllowedOrigins()
    const originAllowed =
        origin == null ||
        allowed.includes('*') ||
        (origin !== 'null' && allowed.includes(origin))
    if (!originAllowed) {
        return new Response(
            JSON.stringify({ error: 'CORS not allowed' }),
            { status: 403, headers: corsHeaders },
        )
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')?.replace(/[\s\n\r]|\\n/g, '')
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')?.replace(/[\s\n\r]|\\n/g, '')
        const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@marinloop.com'

        log(`ENV: URL=${supabaseUrl ? 'SET' : '❌'}, SRK=${serviceRoleKey ? 'SET' : '❌'}, VAPID_PUB=${vapidPublicKey ? 'SET' : '❌'}, VAPID_PRIV=${vapidPrivateKey ? 'SET' : '❌'}`)

        if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
            log('ABORT: Missing environment variables')
            return new Response(
                JSON.stringify({ error: 'Server misconfigured: missing env vars' }),
                { status: 500, headers: corsHeaders }
            )
        }

        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            log('ABORT: No Authorization header')
            return new Response(
                JSON.stringify({ error: 'Missing or invalid Authorization header' }),
                { status: 401, headers: corsHeaders }
            )
        }

        const token = authHeader.replace('Bearer ', '').trim()
        // MARINLOOP_SERVICE_ROLE_KEY is the same JWT as the project service role key,
        // stored as a custom secret to avoid the SUPABASE_ prefix restriction.
        // This is what pg_cron sends from the vault and what we compare against.
        // TODO(name-unification): Rename to MARINLOOP_SERVICE_ROLE_KEY after provisioning new Vault secret and redeploying.
        const medflowSrk = Deno.env.get('MEDFLOW_SERVICE_ROLE_KEY')?.trim()
        let authenticatedUserId: string | null = null

        if (medflowSrk && token === medflowSrk) {
            log('AUTH: Service role key matched ✅')
        } else if (token === serviceRoleKey) {
            log('AUTH: Auto-injected service role key matched ✅')
        } else {
            const userClient = createClient(
                supabaseUrl,
                Deno.env.get('SUPABASE_ANON_KEY')!,
                { global: { headers: { Authorization: authHeader } } },
            )

            const { data: { user }, error: authError } = await userClient.auth.getUser()
            if (authError || !user) {
                log(`AUTH FAILED: ${authError?.message || 'no user'}`)
                return new Response(
                    JSON.stringify({ error: 'Unauthorized' }),
                    { status: 401, headers: corsHeaders }
                )
            }
            authenticatedUserId = user.id
            log(`AUTH: User JWT validated, user=${user.id} ✅`)
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey)

        const { user_id, title, body, url, tag } = (await req.json()) as PushPayload
        log(`PAYLOAD: user_id=${user_id}, title="${title}", body="${body?.slice(0, 50)}"`)

        if (!user_id || !title || !body) {
            log('ABORT: Missing required fields')
            return new Response(
                JSON.stringify({ error: 'user_id, title, and body are required' }),
                { status: 400, headers: corsHeaders }
            )
        }

        // If authenticated as a user (not service role), enforce ownership
        if (authenticatedUserId && authenticatedUserId !== user_id) {
            log(`FORBIDDEN: authenticated user ${authenticatedUserId} tried to push to ${user_id}`)
            return new Response(
                JSON.stringify({ error: 'Forbidden: cannot send push notifications for another user' }),
                { status: 403, headers: corsHeaders }
            )
        }

        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', user_id)

        if (error) {
            log(`DB ERROR: ${error.message}`)
            throw error
        }

        if (!subscriptions || subscriptions.length === 0) {
            log(`NO SUBSCRIPTIONS for user=${user_id}`)
            return new Response(
                JSON.stringify({ sent: 0, total: 0, message: 'No subscriptions found' }),
                { headers: corsHeaders }
            )
        }

        log(`Found ${subscriptions.length} subscription(s)`)

        const payload = JSON.stringify({ title, body, url: url || '/', tag: tag || 'marinloop' })

        let sent = 0
        const staleEndpoints: string[] = []
        const pushResults: Array<{ endpoint: string; status: number | string; ok: boolean }> = []

        for (const sub of subscriptions) {
            const shortEndpoint = sub.endpoint.slice(0, 60) + '...'
            try {
                log(`PUSHING to ${shortEndpoint}`)
                const response = await sendWebPush(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload,
                    vapidPublicKey,
                    vapidPrivateKey,
                    vapidSubject,
                )

                log(`PUSH RESULT: HTTP ${response.status}`)

                if (response.status === 201 || response.status === 200) {
                    sent++
                    pushResults.push({ endpoint: shortEndpoint, status: response.status, ok: true })
                } else if (response.status === 404 || response.status === 410) {
                    staleEndpoints.push(sub.endpoint)
                    pushResults.push({ endpoint: shortEndpoint, status: response.status, ok: false })
                    log(`STALE subscription removed: HTTP ${response.status}`)
                } else {
                    let responseBody = ''
                    try { responseBody = await response.text() } catch { /* ignore */ }
                    log(`PUSH FAILED: HTTP ${response.status}: ${responseBody.slice(0, 200)}`)
                    pushResults.push({ endpoint: shortEndpoint, status: `${response.status}: ${responseBody.slice(0, 100)}`, ok: false })
                }
            } catch (pushErr) {
                const errMsg = (pushErr as Error).message
                log(`PUSH EXCEPTION: ${errMsg}`)
                pushResults.push({ endpoint: shortEndpoint, status: `error: ${errMsg}`, ok: false })
            }
        }

        if (staleEndpoints.length > 0) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .in('endpoint', staleEndpoints)
            log(`Cleaned ${staleEndpoints.length} stale subscription(s)`)
        }

        log(`DONE: sent=${sent}/${subscriptions.length}`)

        return new Response(
            JSON.stringify({ sent, total: subscriptions.length, cleaned: staleEndpoints.length, pushResults }),
            { headers: corsHeaders }
        )
    } catch (err) {
        const errMsg = (err as Error).message
        console.log(`[send-push] FATAL: ${errMsg}`)
        return new Response(
            JSON.stringify({ error: errMsg }),
            { status: 500, headers: corsHeaders }
        )
    }
})

// ---- Web Push Implementation using Deno crypto ----

async function sendWebPush(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    vapidPublicKey: string,
    vapidPrivateKey: string,
    vapidSubject: string,
): Promise<Response> {
    const endpoint = new URL(subscription.endpoint)
    const audience = `${endpoint.protocol}//${endpoint.host}`

    const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey)
    const encrypted = await encryptPayload(payload, subscription.keys.p256dh, subscription.keys.auth)

    return fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
            TTL: '86400',
            Urgency: 'high',
        },
        body: encrypted,
    })
}

/** Parse a VAPID private key that may be hex-encoded or base64url-encoded */
function parsePrivateKey(key: string): Uint8Array {
    if (/^[0-9a-f]{64}$/i.test(key)) {
        const bytes = new Uint8Array(32)
        for (let i = 0; i < 32; i++) {
            bytes[i] = parseInt(key.slice(i * 2, i * 2 + 2), 16)
        }
        return bytes
    }
    return base64urlDecode(key)
}

async function createVapidJwt(
    audience: string,
    subject: string,
    privateKeyRaw: string,
    publicKeyRaw: string,
): Promise<string> {
    const header = { typ: 'JWT', alg: 'ES256' }
    const now = Math.floor(Date.now() / 1000)
    const claims = { aud: audience, exp: now + 86400, sub: subject }

    const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)))
    const claimsB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(claims)))
    const unsignedToken = `${headerB64}.${claimsB64}`

    // JWK import: Deno's ring engine accepts JWK at sign time.
    // PKCS8 passes importKey but throws InvalidEncoding during sign — use JWK only.
    const privateKeyBytes = parsePrivateKey(privateKeyRaw)
    const publicKeyBytes = base64urlDecode(publicKeyRaw)
    // Uncompressed P-256 public key: 0x04 || x(32 bytes) || y(32 bytes)
    const d = base64urlEncode(privateKeyBytes)
    const x = base64urlEncode(publicKeyBytes.slice(1, 33))
    const y = base64urlEncode(publicKeyBytes.slice(33, 65))

    const key = await crypto.subtle.importKey(
        'jwk',
        { kty: 'EC', crv: 'P-256', d, x, y },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
    )

    const tokenBytes = new TextEncoder().encode(unsignedToken)
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        key,
        tokenBytes.buffer as ArrayBuffer,
    )

    const sigBytes = new Uint8Array(signature)
    const rawSig = derToRaw(sigBytes)
    return `${unsignedToken}.${base64urlEncode(rawSig)}`
}

async function encryptPayload(
    payload: string,
    p256dhBase64: string,
    authBase64: string,
): Promise<Uint8Array> {
    const payloadBytes = new TextEncoder().encode(payload)

    const localKeys = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
    )

    const localPublicRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', localKeys.publicKey),
    )

    const clientPublicKey = await crypto.subtle.importKey(
        'raw', base64urlDecode(p256dhBase64),
        { name: 'ECDH', namedCurve: 'P-256' }, false, [],
    )

    const sharedSecret = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'ECDH', public: clientPublicKey }, localKeys.privateKey, 256,
        ),
    )

    const authSecret = base64urlDecode(authBase64)

    const prkInfo = concatBuffers(
        new TextEncoder().encode('WebPush: info\0'),
        base64urlDecode(p256dhBase64),
        localPublicRaw,
    )
    const prk = await hkdfExtract(authSecret, sharedSecret)
    const ikm = await hkdfExpand(prk, prkInfo, 32)

    const salt = crypto.getRandomValues(new Uint8Array(16))

    const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0')
    const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0')

    const prkFinal = await hkdfExtract(salt, ikm)
    const cek = await hkdfExpand(prkFinal, cekInfo, 16)
    const nonce = await hkdfExpand(prkFinal, nonceInfo, 12)

    const aesKey = await crypto.subtle.importKey(
        'raw', cek, { name: 'AES-GCM' }, false, ['encrypt'],
    )

    const paddedPayload = concatBuffers(payloadBytes, new Uint8Array([2]))

    const encrypted = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload),
    )

    const rs = new Uint8Array(4)
    new DataView(rs.buffer).setUint32(0, 4096, false)

    return concatBuffers(salt, rs, new Uint8Array([localPublicRaw.length]), localPublicRaw, encrypted)
}

// ---- Utility Functions ----

function base64urlEncode(data: Uint8Array): string {
    let binary = ''
    for (const byte of data) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string): Uint8Array {
    const pad = '='.repeat((4 - (str.length % 4)) % 4)
    const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
    const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const buf of buffers) { result.set(buf, offset); offset += buf.length }
    return result
}

function derToRaw(der: Uint8Array): Uint8Array {
    // WebCrypto ECDSA sign returns IEEE P1363 (r || s, 64 bytes) — return as-is.
    if (der.length === 64) return der
    const raw = new Uint8Array(64)
    let offset = 2
    const rLen = der[offset + 1]
    const rStart = offset + 2 + (rLen - 32)
    raw.set(der.slice(rStart, rStart + 32), 0)
    offset = offset + 2 + rLen
    const sLen = der[offset + 1]
    const sStart = offset + 2 + (sLen - 32)
    raw.set(der.slice(sStart, sStart + 32), 32)
    return raw
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm))
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const input = concatBuffers(info, new Uint8Array([1]))
    const output = new Uint8Array(await crypto.subtle.sign('HMAC', key, input))
    return output.slice(0, length)
}
