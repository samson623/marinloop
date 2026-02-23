// MedFlow Care — Push Notification Service Worker

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
    console.log('[MedFlow SW] Push event received!', event)

    if (!event.data) {
        console.warn('[MedFlow SW] Push event has no data')
        return
    }

    let payload
    try {
        payload = event.data.json()
        console.log('[MedFlow SW] Push payload:', JSON.stringify(payload))
    } catch {
        payload = { title: 'MedFlow Care', body: event.data.text() }
        console.log('[MedFlow SW] Push payload (text fallback):', payload.body)
    }

    const { title = 'MedFlow Care', body = '', icon, badge, url, tag } = payload
    const safeUrl = toSameOriginPath(url, self.location.origin)

    console.log('[MedFlow SW] Showing notification:', { title, body, tag, url: safeUrl })

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: icon || '/medflow-icon.svg',
            badge: badge || '/medflow-icon.svg',
            tag: tag || 'medflow-default',
            data: { url: safeUrl },
            vibrate: [200, 100, 200],
            requireInteraction: true,
        })
    )
})

// On notification click: focus existing app window and navigate to payload url, or open new window.
self.addEventListener('notificationclick', (event) => {
    console.log('[MedFlow SW] Notification clicked:', event.notification.tag)
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
    console.log('[MedFlow SW] Activated')
    event.waitUntil(self.clients.claim())
})

self.addEventListener('install', (event) => {
    console.log('[MedFlow SW] Installed')
    self.skipWaiting()
})

// Allow the app to tell this worker to activate immediately
self.addEventListener('message', (event) => {
    console.log('[MedFlow SW] Message received:', event.data)
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting()
    }
})
