// marinloop — Push Notification Service Worker

const DEBUG = self.location && self.location.hostname === 'localhost'

/** Returns a same-origin path only. Rejects external URLs (open-redirect protection). */
function toSameOriginPath(value, origin) {
    const v = value || '/'
    if (typeof v !== 'string') return '/'
    if (!v.startsWith('http')) return v.startsWith('/') ? v : '/' + v
    try {
        const u = new URL(v)
        return u.origin === origin ? (u.pathname || '/') : '/'
    } catch {
        return '/'
    }
}

self.addEventListener('push', (event) => {
    if (DEBUG) console.log('[marinloop SW] Push event received!', event)

    if (!event.data) {
        if (DEBUG) console.warn('[marinloop SW] Push event has no data')
        return
    }

    let payload
    try {
        payload = event.data.json()
        if (DEBUG) console.log('[marinloop SW] Push payload:', JSON.stringify(payload))
    } catch {
        payload = { title: 'marinloop', body: event.data.text() }
        if (DEBUG) console.log('[marinloop SW] Push payload (text fallback):', payload.body)
    }

    const { title = 'marinloop', body = '', icon, badge, url, tag } = payload
    const safeUrl = toSameOriginPath(url, self.location.origin)

    if (DEBUG) console.log('[marinloop SW] Showing notification:', { title, body, tag, url: safeUrl })

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: icon || '/marinloop-icon.svg',
            badge: badge || '/marinloop-icon.svg',
            tag: tag || 'marinloop-default',
            data: { url: safeUrl },
            vibrate: [200, 100, 200],
            requireInteraction: true,
        })
    )
})

// On notification click: focus existing app window and navigate to payload url, or open new window.
self.addEventListener('notificationclick', (event) => {
    if (DEBUG) console.log('[marinloop SW] Notification clicked:', event.notification.tag)
    event.notification.close()

    const base = self.location.origin
    const raw = event.notification.data?.url || '/'
    const path = typeof raw === 'string' && !raw.startsWith('http') ? raw : '/'
    const url = base + (path.startsWith('/') ? path : '/' + path)

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const existing = clients.find((c) => c.url && c.url.startsWith(base))
            if (existing) {
                existing.focus()
                return existing.navigate(url)
            }
            return self.clients.openWindow(url)
        })
    )
})

self.addEventListener('activate', (event) => {
    if (DEBUG) console.log('[marinloop SW] Activated')
    event.waitUntil(self.clients.claim())
})

self.addEventListener('install', (event) => {
    if (DEBUG) console.log('[marinloop SW] Installed')
    self.skipWaiting()
})

// Allow the app to tell this worker to activate immediately
self.addEventListener('message', (event) => {
    if (DEBUG) console.log('[marinloop SW] Message received:', event.data)
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting()
    }
})
