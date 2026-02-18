import { useEffect, useState } from 'react'

/**
 * Detects when a new service worker has been installed and is waiting to activate.
 * Returns { updateAvailable, reloadToUpdate } so the app can show an "Update available" banner
 * and reload when the user taps to get the new version.
 */
export function useServiceWorkerUpdate(): { updateAvailable: boolean; reloadToUpdate: () => void } {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | null = null

    const onWaiting = () => setUpdateAvailable(true)

    const setupRegistration = (reg: ServiceWorkerRegistration) => {
      registration = reg
      if (reg.waiting) onWaiting()
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            onWaiting()
          }
        })
      })
    }

    navigator.serviceWorker.register('/sw.js').then(setupRegistration).catch(() => {})

    // When user brings app back to foreground, check for a new version
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && registration) {
        registration.update()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)

  }, [])

  const reloadToUpdate = () => {
    if (!('serviceWorker' in navigator)) {
      window.location.reload()
      return
    }
    const reloadWhenActive = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', reloadWhenActive)
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', reloadWhenActive)
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        reg.waiting.postMessage('SKIP_WAITING')
      } else {
        window.location.reload()
      }
    })
  }

  return { updateAvailable, reloadToUpdate }
}
