import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'

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
            console.log('[Push] Service worker registered:', reg.scope)
            return reg
        } catch (err) {
            console.error('[Push] Service worker registration failed:', err)
            return null
        }
    },

    async getExistingSubscription(): Promise<PushSubscription | null> {
        const reg = await navigator.serviceWorker.ready
        return reg.pushManager.getSubscription()
    },

    async subscribe(): Promise<boolean> {
        if (!this.isSupported()) {
            console.warn('[Push] Push not supported in this browser')
            return false
        }

        console.log('[Push] Starting subscription flow...')

        await this.registerSW()
        const reg = await navigator.serviceWorker.ready
        console.log('[Push] Service worker ready')

        const permission = await Notification.requestPermission()
        console.log('[Push] Permission result:', permission)
        if (permission !== 'granted') return false

        const vapidKey = env.vapidPublicKey
        if (!vapidKey) {
            console.error('[Push] ❌ VAPID public key not configured! Check VITE_VAPID_PUBLIC_KEY env var.')
            return false
        }
        console.log('[Push] VAPID key present:', vapidKey.slice(0, 10) + '...')

        const existing = await reg.pushManager.getSubscription()
        if (existing) {
            console.log('[Push] Unsubscribing existing subscription')
            await existing.unsubscribe()
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            console.error('[Push] ❌ No authenticated user')
            return false
        }

        let subscription: PushSubscription
        try {
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
            })
            console.log('[Push] Browser subscription created:', subscription.endpoint.slice(0, 50) + '...')
        } catch (subErr) {
            console.error('[Push] ❌ Browser subscription failed:', subErr)
            return false
        }

        const json = subscription.toJSON()
        console.log('[Push] Saving subscription to Supabase...')

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
            console.error('[Push] ❌ Failed to save subscription to DB:', error)
            await subscription.unsubscribe()
            return false
        }

        console.log('[Push] ✅ Subscription saved successfully!')
        return true
    },

    async unsubscribe(): Promise<boolean> {
        const subscription = await this.getExistingSubscription()
        if (!subscription) return true

        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        console.log('[Push] Browser unsubscribed')

        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint)

        if (error) console.error('[Push] Failed to delete subscription from DB:', error)
        else console.log('[Push] ✅ Subscription removed from DB')
        return true
    },

    /** Test: send a push notification to yourself right now */
    async testPush(): Promise<{ success: boolean; sent: number; details: unknown }> {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return { success: false, sent: 0, details: 'Not authenticated' }

            console.log('[Push] Sending test push to user:', user.id)
            const { data, error } = await supabase.functions.invoke('send-push', {
                body: {
                    user_id: user.id,
                    title: '🧪 MedFlow Test',
                    body: `Test notification at ${new Date().toLocaleTimeString()}`,
                    url: '/meds',
                    tag: 'test-push',
                },
            })

            if (error) {
                console.error('[Push] Test push failed:', error)
                return { success: false, sent: 0, details: error }
            }

            const sent = typeof data?.sent === 'number' ? data.sent : 0
            console.log('[Push] Test push response:', data)
            return { success: sent > 0, sent, details: data }
        } catch (err) {
            console.error('[Push] Test push exception:', err)
            return { success: false, sent: 0, details: (err as Error).message }
        }
    },
}
