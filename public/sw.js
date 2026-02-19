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
    if (!event.data) return

    let payload
    try {
        payload = event.data.json()
    } catch {
        payload = { title: 'MedFlow Care', body: event.data.text() }
    }

    const { title = 'MedFlow Care', body = '', icon, badge, url, tag } = payload
    // Store only same-origin paths; reject external URLs to prevent open-redirect on click.
    const safeUrl = toSameOriginPath(url, self.location.origin)

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
// Only same-origin paths are used; external URLs are ignored (open-redirect protection).
self.addEventListener('notificationclick', (event) => {
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
    event.waitUntil(self.clients.claim())
})

// Allow the app to tell this worker to activate immediately (so user gets the new version after refresh)
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting()
    }
})
