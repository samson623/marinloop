// MedFlow Care — Push Notification Service Worker

self.addEventListener('push', (event) => {
    if (!event.data) return

    let payload
    try {
        payload = event.data.json()
    } catch {
        payload = { title: 'MedFlow Care', body: event.data.text() }
    }

    const { title = 'MedFlow Care', body = '', icon, badge, url, tag } = payload

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: icon || '/medflow-icon.svg',
            badge: badge || '/medflow-icon.svg',
            tag: tag || 'medflow-default',
            data: { url: url || '/' },
            vibrate: [200, 100, 200],
            requireInteraction: true,
        })
    )
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const url = event.notification.data?.url || '/'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const existing = clients.find((c) => c.url.includes(self.location.origin))
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
