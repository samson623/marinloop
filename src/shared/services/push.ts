import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'
import { needsAddToHomeScreenForPush } from '@/shared/lib/device'

const DEBUG = import.meta.env.DEV

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const cleanStr = base64String.replace(/[\s\n\r]|\\n/g, '')
    const padding = '='.repeat((4 - (cleanStr.length % 4)) % 4)
    const base64 = (cleanStr + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    const arr = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
    return arr
}

export const PushService = {
    isSupported(): boolean {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    },

    getPermission(): NotificationPermission {
        return Notification.permission
    },

    async registerSW(): Promise<{ reg: ServiceWorkerRegistration | null; swError?: string }> {
        if (!('serviceWorker' in navigator)) return { reg: null, swError: 'Service workers not supported in this browser' }
        try {
            const existing = await navigator.serviceWorker.getRegistration('/')
            if (existing) {
                if (DEBUG) console.log('[Push] Reusing existing service worker registration:', existing.scope)
                return { reg: existing }
            }
            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
            if (DEBUG) console.log('[Push] Service worker registered:', reg.scope)
            return { reg }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error('[Push] ❌ Service worker registration failed:', msg)
            try {
                const existing = await navigator.serviceWorker.getRegistration('/')
                if (existing) {
                    if (DEBUG) console.log('[Push] Recovered existing SW after failure:', existing.scope)
                    return { reg: existing }
                }
            } catch {
                // no-op
            }
            return { reg: null, swError: msg }
        }
    },

    async getExistingSubscription(): Promise<PushSubscription | null> {
        const reg = await navigator.serviceWorker.ready
        return reg.pushManager.getSubscription()
    },

    async subscribe(): Promise<{ ok: boolean; error?: string }> {
        if (!this.isSupported()) {
            if (DEBUG) console.warn('[Push] Push not supported in this browser')
            return { ok: false, error: 'Push notifications are not supported in this browser' }
        }

        if (needsAddToHomeScreenForPush()) {
            if (DEBUG) console.warn('[Push] iOS push attempted before Add to Home Screen')
            return { ok: false, error: 'On iOS, add MarinLoop to your home screen to enable push notifications' }
        }

        if (DEBUG) console.log('[Push] Starting subscription flow...')

        // Request permission while we're still inside the original click gesture.
        const permission = Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission()
        if (DEBUG) console.log('[Push] Permission result:', permission)
        if (permission !== 'granted') return { ok: false }

        const { reg: registration, swError } = await this.registerSW()
        if (!registration) {
            return { ok: false, error: swError ?? 'Could not register notifications on this device' }
        }

        const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Service worker timed out — try refreshing the page')), 10000)
            ),
        ])
        if (DEBUG) console.log('[Push] Service worker ready')

        const vapidKey = env.vapidPublicKey
        if (!vapidKey) {
            console.error('[Push] ❌ VAPID public key not configured!')
            return { ok: false, error: 'Push not configured — missing VAPID key' }
        }
        if (DEBUG) console.log('[Push] VAPID key present:', vapidKey.slice(0, 10) + '...')

        const existing = await reg.pushManager.getSubscription()
        if (existing) {
            if (DEBUG) console.log('[Push] Unsubscribing existing subscription')
            await existing.unsubscribe()
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            console.error('[Push] ❌ No authenticated user')
            return { ok: false, error: 'Not signed in' }
        }

        let subscription: PushSubscription
        try {
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
            })
            if (DEBUG) console.log('[Push] Browser subscription created:', subscription.endpoint.slice(0, 50) + '...')
        } catch (subErr) {
            const msg = subErr instanceof Error ? subErr.message : String(subErr)
            console.error('[Push] ❌ Browser subscription failed:', msg)
            return { ok: false, error: `Subscription failed: ${msg}` }
        }

        const json = subscription.toJSON()
        if (DEBUG) console.log('[Push] Saving subscription to Supabase...')

        const { error } = await supabase.from('push_subscriptions').upsert(
            {
                user_id: user.id,
                endpoint: json.endpoint!,
                p256dh: json.keys!.p256dh!,
                auth: json.keys!.auth!,
                device_info: navigator.userAgent.slice(0, 200),
            },
            { onConflict: 'user_id,endpoint' }
        )

        if (error) {
            console.error('[Push] ❌ Failed to save subscription to DB:', error.message)
            await subscription.unsubscribe()
            return { ok: false, error: `Could not save subscription: ${error.message}` }
        }

        if (DEBUG) console.log('[Push] ✅ Subscription saved successfully!')
        return { ok: true }
    },

    async unsubscribe(): Promise<boolean> {
        const subscription = await this.getExistingSubscription()
        if (!subscription) return true

        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        if (DEBUG) console.log('[Push] Browser unsubscribed')

        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint)

        if (error) { if (DEBUG) console.error('[Push] Failed to delete subscription from DB:', error) }
        else { if (DEBUG) console.log('[Push] ✅ Subscription removed from DB') }
        return true
    },

    /** Sync the browser's current push subscription back into the DB without creating a new one.
     *  Use this to recover when the browser has an active subscription but the DB record is missing. */
    async syncSubscription(): Promise<boolean> {
        if (!this.isSupported()) return false
        try {
            const reg = await navigator.serviceWorker.ready
            const existing = await reg.pushManager.getSubscription()
            if (!existing) return false

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return false

            const json = existing.toJSON()
            const { error } = await supabase.from('push_subscriptions').upsert(
                {
                    user_id: user.id,
                    endpoint: json.endpoint!,
                    p256dh: json.keys!.p256dh!,
                    auth: json.keys!.auth!,
                    device_info: navigator.userAgent.slice(0, 200),
                },
                { onConflict: 'user_id,endpoint' }
            )
            if (error) {
                if (DEBUG) console.error('[Push] ❌ Sync failed:', error)
                return false
            }
            if (DEBUG) console.log('[Push] ✅ Subscription re-synced to DB')
            return true
        } catch (err) {
            if (DEBUG) console.error('[Push] Sync exception:', err)
            return false
        }
    },

    /** Test: send a push notification to yourself right now */
    async testPush(): Promise<{ success: boolean; sent: number; total: number; details: unknown }> {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return { success: false, sent: 0, total: 0, details: 'Not authenticated' }

            if (DEBUG) console.log('[Push] Sending test push to user:', user.id)
            const { data, error } = await supabase.functions.invoke('send-push', {
                body: {
                    user_id: user.id,
                    title: 'MarinLoop Test',
                    body: `Test notification at ${new Date().toLocaleTimeString()}`,
                    url: '/meds',
                    tag: 'test-push',
                },
            })

            if (error) {
                if (DEBUG) console.error('[Push] Test push failed:', error)
                return { success: false, sent: 0, total: 0, details: error }
            }

            const sent = typeof data?.sent === 'number' ? data.sent : 0
            const total = typeof data?.total === 'number' ? data.total : 0
            if (DEBUG) console.log('[Push] Test push response:', data)
            return { success: sent > 0, sent, total, details: data }
        } catch (err) {
            if (DEBUG) console.error('[Push] Test push exception:', err)
            return { success: false, sent: 0, total: 0, details: (err as Error).message }
        }
    },
}
