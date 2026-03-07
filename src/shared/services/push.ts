import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'

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

    async registerSW(): Promise<ServiceWorkerRegistration | null> {
        if (!('serviceWorker' in navigator)) return null
        try {
            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
            if (DEBUG) console.log('[Push] Service worker registered:', reg.scope)
            return reg
        } catch (err) {
            if (DEBUG) console.error('[Push] Service worker registration failed:', err)
            return null
        }
    },

    async getExistingSubscription(): Promise<PushSubscription | null> {
        const reg = await navigator.serviceWorker.ready
        return reg.pushManager.getSubscription()
    },

    async subscribe(): Promise<boolean> {
        if (!this.isSupported()) {
            if (DEBUG) console.warn('[Push] Push not supported in this browser')
            return false
        }

        if (DEBUG) console.log('[Push] Starting subscription flow...')

        await this.registerSW()
        const reg = await navigator.serviceWorker.ready
        if (DEBUG) console.log('[Push] Service worker ready')

        const permission = await Notification.requestPermission()
        if (DEBUG) console.log('[Push] Permission result:', permission)
        if (permission !== 'granted') return false

        const vapidKey = env.vapidPublicKey
        if (!vapidKey) {
            if (DEBUG) console.error('[Push] ❌ VAPID public key not configured! Check VITE_VAPID_PUBLIC_KEY env var.')
            return false
        }
        if (DEBUG) console.log('[Push] VAPID key present:', vapidKey.slice(0, 10) + '...')

        const existing = await reg.pushManager.getSubscription()
        if (existing) {
            if (DEBUG) console.log('[Push] Unsubscribing existing subscription')
            await existing.unsubscribe()
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            if (DEBUG) console.error('[Push] ❌ No authenticated user')
            return false
        }

        let subscription: PushSubscription
        try {
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
            })
            if (DEBUG) console.log('[Push] Browser subscription created:', subscription.endpoint.slice(0, 50) + '...')
        } catch (subErr) {
            if (DEBUG) console.error('[Push] ❌ Browser subscription failed:', subErr)
            return false
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
            if (DEBUG) console.error('[Push] ❌ Failed to save subscription to DB:', error)
            await subscription.unsubscribe()
            return false
        }

        if (DEBUG) console.log('[Push] ✅ Subscription saved successfully!')
        return true
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
