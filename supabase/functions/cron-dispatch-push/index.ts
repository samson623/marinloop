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

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
        const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@medflowcare.app'

        // ── Auth: validate service-role key ──
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
        const token = authHeader.replace('Bearer ', '')

        // Accept EITHER the service-role key (from pg_cron) or a valid user JWT
        let isServiceRole = false
        if (token === serviceRoleKey) {
            isServiceRole = true
        }

        if (!isServiceRole) {
            // Try user JWT validation as fallback
            const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
            const userClient = createClient(supabaseUrl, anonKey, {
                global: { headers: { Authorization: authHeader } },
            })
            const { data: { user }, error: authError } = await userClient.auth.getUser()
            if (authError || !user) {
                return new Response(
                    JSON.stringify({ error: 'Unauthorized' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        const { user_id, medication_name, medication_dosage, schedule_time } = (await req.json()) as CronPayload

        if (!user_id || !medication_name) {
            return new Response(
                JSON.stringify({ error: 'user_id and medication_name are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── Build notification content ──
        const dosageStr = medication_dosage ? ` (${medication_dosage})` : ''
        const title = `💊 Time for ${medication_name}`
        const body = `Take ${medication_name}${dosageStr} — scheduled at ${formatTime12h(schedule_time)}`

        // ── Fetch all push subscriptions for this user ──
        const supabase = createClient(supabaseUrl, serviceRoleKey)
        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', user_id)

        if (error) throw error
        if (!subscriptions || subscriptions.length === 0) {
            return new Response(
                JSON.stringify({ sent: 0, message: 'No subscriptions' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const payload = JSON.stringify({
            title,
            body,
            url: '/meds',
            tag: `med-reminder-${schedule_time}`,
        })

        let sent = 0
        const staleEndpoints: string[] = []

        for (const sub of subscriptions) {
            try {
                const response = await sendWebPush(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload,
                    vapidPublicKey,
                    vapidPrivateKey,
                    vapidSubject,
                )

                if (response.status === 201 || response.status === 200) {
                    sent++
                } else if (response.status === 404 || response.status === 410) {
                    staleEndpoints.push(sub.endpoint)
                }
            } catch {
                // Individual push failure — continue with next device
            }
        }

        // Also create an in-app notification record
        await supabase.from('notifications').insert({
            user_id,
            title,
            message: body,
            type: 'info',
        })

        // Cleanup stale subscriptions
        if (staleEndpoints.length > 0) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .in('endpoint', staleEndpoints)
        }

        return new Response(
            JSON.stringify({ sent, total: subscriptions.length, cleaned: staleEndpoints.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// ── Helpers ──

function formatTime12h(time24: string): string {
    const [h, m] = time24.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

// ---- Web Push Implementation (same crypto as send-push) ----

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

async function createVapidJwt(
    audience: string,
    subject: string,
    privateKeyBase64: string,
): Promise<string> {
    const header = { typ: 'JWT', alg: 'ES256' }
    const now = Math.floor(Date.now() / 1000)
    const claims = { aud: audience, exp: now + 86400, sub: subject }

    const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)))
    const claimsB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(claims)))
    const unsignedToken = `${headerB64}.${claimsB64}`

    const keyData = base64urlDecode(privateKeyBase64)
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
