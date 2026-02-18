import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
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
            return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        } catch {
            return null
        }
    },

    async getExistingSubscription(): Promise<PushSubscription | null> {
        const reg = await navigator.serviceWorker.ready
        return reg.pushManager.getSubscription()
    },

    async subscribe(): Promise<boolean> {
        if (!this.isSupported()) return false

        await this.registerSW()
        const reg = await navigator.serviceWorker.ready

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return false

        const vapidKey = env.vapidPublicKey
        if (!vapidKey) {
            console.error('[Push] VAPID public key not configured')
            return false
        }

        const existing = await reg.pushManager.getSubscription()
        if (existing) await existing.unsubscribe()

        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        })

        const json = subscription.toJSON()
        const { error } = await supabase.from('push_subscriptions').upsert(
            {
                endpoint: json.endpoint!,
                p256dh: json.keys!.p256dh!,
                auth: json.keys!.auth!,
                device_info: navigator.userAgent.slice(0, 200),
            },
            { onConflict: 'user_id,endpoint' }
        )

        if (error) {
            console.error('[Push] Failed to save subscription:', error)
            await subscription.unsubscribe()
            return false
        }

        return true
    },

    async unsubscribe(): Promise<boolean> {
        const subscription = await this.getExistingSubscription()
        if (!subscription) return true

        const endpoint = subscription.endpoint
        await subscription.unsubscribe()

        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint)

        if (error) console.error('[Push] Failed to delete subscription:', error)
        return true
    },
}
