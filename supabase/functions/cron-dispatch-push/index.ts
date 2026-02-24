// Supabase Edge Function: cron-dispatch-push
// Called by pg_cron via pg_net with SERVICE_ROLE_KEY auth (no user JWT).
// Receives { schedule_id, user_id, medication_name, medication_dosage, schedule_time }
// and delivers Web Push notifications to all of the user's devices.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
}

interface CronPayload {
    schedule_id: string
    user_id: string
    medication_name: string
    medication_dosage: string
    schedule_time: string
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Collect diagnostic logs for the response
    const logs: string[] = []
    const log = (msg: string) => { logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(`[cron-dispatch-push] ${msg}`) }

    // GET = health check
    if (req.method === 'GET') {
        const envCheck = {
            SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
            SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
            SUPABASE_ANON_KEY: !!Deno.env.get('SUPABASE_ANON_KEY'),
            VAPID_PUBLIC_KEY: !!Deno.env.get('VAPID_PUBLIC_KEY'),
            VAPID_PRIVATE_KEY: !!Deno.env.get('VAPID_PRIVATE_KEY'),
            VAPID_SUBJECT: !!Deno.env.get('VAPID_SUBJECT'),
        }
        return new Response(
            JSON.stringify({ status: 'ok', env: envCheck, timestamp: new Date().toISOString() }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        // ── Step 1: Check environment variables ──
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')?.replace(/[\s\n\r]|\\n/g, '')
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')?.replace(/[\s\n\r]|\\n/g, '')
        const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@medflowcare.app'

        log(`ENV CHECK: SUPABASE_URL=${supabaseUrl ? 'SET' : '❌ MISSING'}, SERVICE_ROLE_KEY=${serviceRoleKey ? 'SET' : '❌ MISSING'}, VAPID_PUBLIC=${vapidPublicKey ? 'SET' : '❌ MISSING'}, VAPID_PRIVATE=${vapidPrivateKey ? 'SET' : '❌ MISSING'}`)

        if (!supabaseUrl || !serviceRoleKey) {
            log('ABORT: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
            return new Response(
                JSON.stringify({ error: 'Server misconfigured: missing Supabase env vars', logs }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!vapidPublicKey || !vapidPrivateKey) {
            log('ABORT: Missing VAPID keys')
            return new Response(
                JSON.stringify({ error: 'Server misconfigured: missing VAPID keys', logs }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── Step 2: Auth — validate service-role key or user JWT ──
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            log('ABORT: No Authorization header')
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header', logs }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
        const token = authHeader.replace('Bearer ', '')

        let isServiceRole = false
        if (token === serviceRoleKey) {
            isServiceRole = true
            log('AUTH: Service role key matched ✅')
        }

        if (!isServiceRole) {
            log('AUTH: Token is not service role key, trying user JWT...')
            const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
            const userClient = createClient(supabaseUrl, anonKey, {
                global: { headers: { Authorization: authHeader } },
            })
            const { data: { user }, error: authError } = await userClient.auth.getUser()
            if (authError || !user) {
                log(`AUTH FAILED: ${authError?.message || 'no user returned'}`)
                return new Response(
                    JSON.stringify({ error: 'Unauthorized', details: authError?.message, logs }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
            log(`AUTH: User JWT validated for user=${user.id} ✅`)
        }

        // ── Step 3: Parse payload ──
        let payload: CronPayload
        try {
            payload = await req.json()
        } catch (e) {
            log(`ABORT: Failed to parse request body: ${(e as Error).message}`)
            return new Response(
                JSON.stringify({ error: 'Invalid JSON body', logs }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { user_id, medication_name, medication_dosage, schedule_time } = payload
        log(`PAYLOAD: user_id=${user_id}, med=${medication_name}, dosage=${medication_dosage || '(none)'}, time=${schedule_time}`)

        if (!user_id || !medication_name) {
            log('ABORT: Missing required fields (user_id or medication_name)')
            return new Response(
                JSON.stringify({ error: 'user_id and medication_name are required', logs }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── Step 4: Build notification content ──
        const dosageStr = medication_dosage ? ` (${medication_dosage})` : ''
        const title = `💊 Time for ${medication_name}`
        const body = `Take ${medication_name}${dosageStr} — scheduled at ${formatTime12h(schedule_time)}`
        log(`NOTIFICATION: title="${title}", body="${body}"`)

        // ── Step 5: Fetch push subscriptions ──
        const supabase = createClient(supabaseUrl, serviceRoleKey)
        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', user_id)

        if (error) {
            log(`DB ERROR fetching subscriptions: ${error.message}`)
            throw error
        }

        if (!subscriptions || subscriptions.length === 0) {
            log(`NO SUBSCRIPTIONS found for user=${user_id}. Push cannot be delivered.`)
            return new Response(
                JSON.stringify({ sent: 0, message: 'No subscriptions for this user', logs }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        log(`SUBSCRIPTIONS: Found ${subscriptions.length} device(s) for user=${user_id}`)

        const pushPayload = JSON.stringify({
            title,
            body,
            url: '/meds',
            tag: `med-reminder-${schedule_time}`,
        })

        // ── Step 6: Send to each device ──
        let sent = 0
        const staleEndpoints: string[] = []
        const pushResults: Array<{ endpoint: string; status: number | string; ok: boolean }> = []

        for (const sub of subscriptions) {
            const shortEndpoint = sub.endpoint.slice(0, 60) + '...'
            try {
                log(`PUSHING to ${shortEndpoint}`)
                const response = await sendWebPush(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    pushPayload,
                    vapidPublicKey,
                    vapidPrivateKey,
                    vapidSubject,
                )

                const statusCode = response.status
                log(`PUSH RESULT: ${shortEndpoint} → HTTP ${statusCode}`)

                if (statusCode === 201 || statusCode === 200) {
                    sent++
                    pushResults.push({ endpoint: shortEndpoint, status: statusCode, ok: true })
                } else if (statusCode === 404 || statusCode === 410) {
                    staleEndpoints.push(sub.endpoint)
                    pushResults.push({ endpoint: shortEndpoint, status: statusCode, ok: false })
                    log(`STALE: ${shortEndpoint} returned ${statusCode} — will remove`)
                } else {
                    let responseBody = ''
                    try { responseBody = await response.text() } catch { /* ignore */ }
                    log(`PUSH FAILED: ${shortEndpoint} HTTP ${statusCode}: ${responseBody.slice(0, 200)}`)
                    pushResults.push({ endpoint: shortEndpoint, status: `${statusCode}: ${responseBody.slice(0, 100)}`, ok: false })
                }
            } catch (pushErr) {
                const errMsg = (pushErr as Error).message
                log(`PUSH EXCEPTION for ${shortEndpoint}: ${errMsg}`)
                pushResults.push({ endpoint: shortEndpoint, status: `error: ${errMsg}`, ok: false })
            }
        }

        // ── Step 7: Create in-app notification record ──
        const { error: notifError } = await supabase.from('notifications').insert({
            user_id,
            title,
            message: body,
            type: 'info',
        })
        if (notifError) {
            log(`WARNING: Failed to create in-app notification: ${notifError.message}`)
        } else {
            log('IN-APP notification created ✅')
        }

        // ── Step 8: Cleanup stale subscriptions ──
        if (staleEndpoints.length > 0) {
            const { error: cleanupError } = await supabase
                .from('push_subscriptions')
                .delete()
                .in('endpoint', staleEndpoints)
            if (cleanupError) {
                log(`WARNING: Failed to cleanup stale subscriptions: ${cleanupError.message}`)
            } else {
                log(`CLEANUP: Removed ${staleEndpoints.length} stale subscription(s)`)
            }
        }

        log(`DONE: sent=${sent}/${subscriptions.length}, cleaned=${staleEndpoints.length}`)

        return new Response(
            JSON.stringify({
                sent,
                total: subscriptions.length,
                cleaned: staleEndpoints.length,
                pushResults,
                logs,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        const errMsg = (err as Error).message
        log(`FATAL ERROR: ${errMsg}`)
        return new Response(
            JSON.stringify({ error: errMsg, logs }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// ── Helpers ──

function formatTime12h(time24: string): string {
    if (!time24 || !time24.includes(':')) return time24 || ''
    const [h, m] = time24.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

// ---- Web Push Implementation ----

async function sendWebPush(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    vapidPublicKey: string,
    vapidPrivateKey: string,
    vapidSubject: string,
): Promise<Response> {
    const endpoint = new URL(subscription.endpoint)
    const audience = `${endpoint.protocol}//${endpoint.host}`

    const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey)
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
    // Hex: exactly 64 hex chars = 32 bytes
    if (/^[0-9a-f]{64}$/i.test(key)) {
        const bytes = new Uint8Array(32)
        for (let i = 0; i < 32; i++) {
            bytes[i] = parseInt(key.slice(i * 2, i * 2 + 2), 16)
        }
        return bytes
    }
    // Otherwise assume base64url
    return base64urlDecode(key)
}

async function createVapidJwt(
    audience: string,
    subject: string,
    privateKeyRaw: string,
): Promise<string> {
    const header = { typ: 'JWT', alg: 'ES256' }
    const now = Math.floor(Date.now() / 1000)
    const claims = { aud: audience, exp: now + 86400, sub: subject }

    const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)))
    const claimsB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(claims)))
    const unsignedToken = `${headerB64}.${claimsB64}`

    const keyData = parsePrivateKey(privateKeyRaw)
    const key = await crypto.subtle.importKey(
        'pkcs8', buildPkcs8(keyData),
        { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
    )

    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' }, key,
        new TextEncoder().encode(unsignedToken),
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

function buildPkcs8(rawPrivateKey: Uint8Array): Uint8Array {
    const prefix = new Uint8Array([
        0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
        0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25,
        0x02, 0x01, 0x01, 0x04, 0x20,
    ])
    return concatBuffers(prefix, rawPrivateKey)
}

function derToRaw(der: Uint8Array): Uint8Array {
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
