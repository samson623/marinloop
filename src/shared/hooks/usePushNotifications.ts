import { useState, useEffect, useCallback } from 'react'
import { PushService } from '@/shared/services/push'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { needsAddToHomeScreenForPush } from '@/shared/lib/device'

export function usePushNotifications() {
    const { isDemo } = useAuthStore()
    const { toast } = useAppStore()

    const [isSupported] = useState(() => PushService.isSupported())
    const [permission, setPermission] = useState<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    )
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [showAddToHomeScreenHelp, setShowAddToHomeScreenHelp] = useState(false)

    const refreshState = useCallback(() => {
        if (!isSupported || isDemo) return
        setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default')
        PushService.getExistingSubscription()
            .then((sub) => setIsSubscribed(!!sub))
            .catch(() => setIsSubscribed(false))
    }, [isSupported, isDemo])

    useEffect(() => {
        refreshState()
    }, [refreshState])

    useEffect(() => {
        if (!isSupported || isDemo) return
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') refreshState()
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => document.removeEventListener('visibilitychange', onVisibilityChange)
    }, [isSupported, isDemo, refreshState])

    const subscribe = useCallback(async () => {
        if (isDemo || isLoading) return
        setIsLoading(true)

        try {
            const ok = await PushService.subscribe()
            if (ok) {
                setIsSubscribed(true)
                setPermission(Notification.permission)
                toast('Push notifications enabled', 'ts')
            } else {
                setPermission(Notification.permission)
                if (Notification.permission === 'denied') {
                    toast('Notifications blocked — check browser settings', 'tw')
                } else if (needsAddToHomeScreenForPush()) {
                    setShowAddToHomeScreenHelp(true)
                    toast('Add MedFlow to your home screen first', 'tw')
                } else {
                    toast('Failed to enable push notifications', 'te')
                }
                // Re-check subscription so UI matches reality (e.g. partial failure)
                const sub = await PushService.getExistingSubscription().catch(() => null)
                setIsSubscribed(!!sub)
            }
        } catch {
            toast('Failed to enable push notifications', 'te')
            const sub = await PushService.getExistingSubscription().catch(() => null)
            setIsSubscribed(!!sub)
            setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default')
        } finally {
            setIsLoading(false)
        }
    }, [isDemo, isLoading, toast])

    const unsubscribe = useCallback(async () => {
        if (isDemo || isLoading) return
        setIsLoading(true)

        try {
            await PushService.unsubscribe()
            setIsSubscribed(false)
            toast('Push notifications disabled', 'ts')
        } catch {
            toast('Failed to disable push notifications', 'te')
        } finally {
            setIsLoading(false)
        }
    }, [isDemo, isLoading, toast])

    return {
        isSupported,
        permission,
        isSubscribed,
        isLoading,
        subscribe,
        unsubscribe,
        showAddToHomeScreenHelp,
        setShowAddToHomeScreenHelp,
    }
}
