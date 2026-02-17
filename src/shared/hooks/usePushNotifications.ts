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

    useEffect(() => {
        if (!isSupported || isDemo) return

        PushService.getExistingSubscription().then((sub) => {
            setIsSubscribed(!!sub)
        }).catch(() => { })
    }, [isSupported, isDemo])

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
            }
        } catch {
            toast('Failed to enable push notifications', 'te')
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
