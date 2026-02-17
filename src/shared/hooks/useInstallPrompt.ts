import { useState, useEffect, useCallback } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Captures the browser's beforeinstallprompt event (Chrome/Android PWA install).
 * Exposes canInstall and promptInstall() so the app can show a one-tap "Add to Home Screen" button.
 */
export function useInstallPrompt(): {
  canInstall: boolean
  promptInstall: () => Promise<boolean>
} {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!installEvent) return false
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setInstallEvent(null)
    return outcome === 'accepted'
  }, [installEvent])

  return {
    canInstall: !!installEvent,
    promptInstall,
  }
}
