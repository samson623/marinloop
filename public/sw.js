// MarinLoop — Push Notification Service Worker
// Handles: push notifications, notification clicks, action buttons,
//          offline caching (app shell), and SW lifecycle.

const DEBUG = self.location && self.location.hostname === 'localhost'

// ─── Offline cache ────────────────────────────────────────────────────────────
// Bump CACHE_NAME whenever the app shell changes (forces old cache eviction).
const CACHE_NAME = 'marinloop-v1'
const APP_SHELL_URLS = ['/', '/index.html', '/manifest.json']

// ─── Security helper ─────────────────────────────────────────────────────────
/**
 * Returns a same-origin path only.
 * Rejects external / cross-origin URLs to prevent open-redirect attacks.
 */
function toSameOriginPath(value, origin) {
    const v = value || '/'
    if (typeof v !== 'string') return '/'
    if (!v.startsWith('http')) return v.startsWith('/') ? v : '/' + v
    try {
        const u = new URL(v)
        return u.origin === origin ? (u.pathname + (u.search || '') + (u.hash || '') || '/') : '/'
    } catch {
        return '/'
    }
}

// ─── Install ──────────────────────────────────────────────────────────────────
// Pre-cache the app shell so the app loads offline immediately.
self.addEventListener('install', (event) => {
    if (DEBUG) console.log('[MarinLoop SW] Installing — caching app shell')
    // Do NOT call self.skipWaiting() here — let the new SW wait in the
    // "waiting" state so the app can show an "Update available" banner.
    // The user triggers activation via the SKIP_WAITING message handler.
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL_URLS))
            .catch((err) => {
                // Non-fatal: app still works, just won't load offline on first install.
                if (DEBUG) console.warn('[MarinLoop SW] App shell pre-cache failed:', err)
            })
    )
})

// ─── Activate ─────────────────────────────────────────────────────────────────
// Take control of all open tabs immediately and evict stale caches.
self.addEventListener('activate', (event) => {
    if (DEBUG) console.log('[MarinLoop SW] Activated')
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== CACHE_NAME)
                        .map((k) => {
                            if (DEBUG) console.log('[MarinLoop SW] Deleting old cache:', k)
                            return caches.delete(k)
                        })
                )
            )
            .then(() => self.clients.claim())
            .catch((err) => {
                if (DEBUG) console.warn('[MarinLoop SW] Activate cleanup error:', err)
                return self.clients.claim()
            })
    )
})

// ─── Fetch — offline strategy ─────────────────────────────────────────────────
// Three tiers:
//   1. Supabase API requests → network-only (never cache auth/data calls)
//   2. HTML navigation requests → network-first, fallback to cached '/'
//   3. Everything else (JS/CSS/images) → cache-first, update cache in background
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = request.url

    // Ignore non-http(s) schemes (chrome-extension://, etc.)
    if (!url.startsWith('http')) return

    // 1. Supabase API — always go to network, never cache
    if (url.includes('supabase.co')) {
        // Let the browser handle it; no respondWith means default network fetch.
        return
    }

    // 2. HTML navigation requests — network-first, fall back to cached index
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache a fresh copy of the page if it succeeded
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME)
                            .then((cache) => cache.put(request, clone))
                            .catch(() => {})
                    }
                    return response
                })
                .catch(() => {
                    if (DEBUG) console.log('[MarinLoop SW] Navigation offline — serving cached /')
                    // Serve the cached root shell so React Router can take over
                    return caches.match('/').then((cached) => cached || Response.error())
                })
        )
        return
    }

    // 3. Static assets — cache-first, refresh in background
    event.respondWith(
        caches.match(request).then((cached) => {
            // Kick off a background network fetch to keep the cache fresh
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response.ok) {
                        caches.open(CACHE_NAME)
                            .then((cache) => cache.put(request, response.clone()))
                            .catch(() => {})
                    }
                    return response
                })
                .catch(() => {
                    if (DEBUG) console.log('[MarinLoop SW] Static asset offline and not cached:', url)
                    return Response.error()
                })

            // Return cached version immediately if available; otherwise wait for network
            return cached || networkFetch
        })
    )
})

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    if (DEBUG) console.log('[MarinLoop SW] Push event received!', event)

    if (!event.data) {
        if (DEBUG) console.warn('[MarinLoop SW] Push event has no data')
        return
    }

    let payload
    try {
        payload = event.data.json()
        if (DEBUG) console.log('[MarinLoop SW] Push payload:', JSON.stringify(payload))
    } catch {
        payload = { title: 'MarinLoop', body: event.data.text() }
        if (DEBUG) console.log('[MarinLoop SW] Push payload (text fallback):', payload.body)
    }

    const {
        title = 'MarinLoop',
        body = '',
        icon,
        badge,
        url,
        tag,
        notificationType,  // 'dose' | 'reminder' | undefined
        scheduleId,        // for dose action buttons
        reminderId,        // for reminder action buttons
    } = payload

    const safeUrl = toSameOriginPath(url, self.location.origin)

    // Build action buttons based on notification type.
    // Note: iOS Safari ignores action buttons entirely (renders as plain notification),
    // so this degrades gracefully — the notificationclick body-tap handler still works.
    const actions = []
    if (notificationType === 'dose') {
        actions.push({ action: 'taken', title: '✓ Mark Taken' })
        actions.push({ action: 'snooze', title: '⏰ Snooze 10 min' })
    } else if (notificationType === 'reminder') {
        actions.push({ action: 'snooze', title: '⏰ Snooze 10 min' })
    }

    if (DEBUG) console.log('[MarinLoop SW] Showing notification:', { title, body, tag, url: safeUrl, notificationType, actions })

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: icon || '/marinloop-icon.svg',
            badge: badge || '/marinloop-icon.svg',
            tag: tag || 'marinloop-default',
            data: {
                url: safeUrl,
                scheduleId: scheduleId || null,
                reminderId: reminderId || null,
            },
            actions,
            vibrate: [200, 100, 200],
            requireInteraction: true,
        })
    )
})

// ─── Notification click ───────────────────────────────────────────────────────
// iOS Safari: client.navigate() is NOT supported — use postMessage only.
// Chrome/Android: postMessage works fine as well (React app listens for SW_NAVIGATE).
// We no longer call client.navigate() at all; postMessage + focus is universal.
self.addEventListener('notificationclick', (event) => {
    if (DEBUG) console.log('[MarinLoop SW] Notification clicked — action:', event.action, 'tag:', event.notification.tag)

    event.notification.close()

    const notification = event.notification
    const notificationData = notification.data || {}

    // ── Action button: Mark Taken ─────────────────────────────────────────────
    if (event.action === 'taken') {
        event.waitUntil(
            self.clients
                .matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    // Broadcast to ALL matching clients (not navigating, just signalling)
                    const origin = self.location.origin
                    clientList
                        .filter((c) => c.url && c.url.startsWith(origin))
                        .forEach((c) => {
                            c.postMessage({
                                type: 'DOSE_TAKEN',
                                scheduleId: notificationData.scheduleId,
                            })
                        })
                    if (DEBUG) console.log('[MarinLoop SW] Sent DOSE_TAKEN to', clientList.length, 'client(s)')
                })
                .catch((err) => {
                    if (DEBUG) console.warn('[MarinLoop SW] DOSE_TAKEN postMessage failed:', err)
                })
        )
        return
    }

    // ── Action button: Snooze ─────────────────────────────────────────────────
    if (event.action === 'snooze') {
        event.waitUntil(
            self.clients
                .matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    // Broadcast to ALL matching clients
                    const origin = self.location.origin
                    clientList
                        .filter((c) => c.url && c.url.startsWith(origin))
                        .forEach((c) => {
                            c.postMessage({
                                type: 'SNOOZE_REMINDER',
                                reminderId: notificationData.reminderId,
                                minutes: 10,
                            })
                        })
                    if (DEBUG) console.log('[MarinLoop SW] Sent SNOOZE_REMINDER to', clientList.length, 'client(s)')
                })
                .catch((err) => {
                    if (DEBUG) console.warn('[MarinLoop SW] SNOOZE_REMINDER postMessage failed:', err)
                })
        )
        return
    }

    // ── Body tap (default action) ─────────────────────────────────────────────
    // Resolve the destination URL from notification data.
    const base = self.location.origin
    const rawPath = notificationData.url || '/'
    const safeUrl = base + toSameOriginPath(rawPath, base)

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Find an existing same-origin window to reuse
                const existing = clientList.find((c) => c.url && c.url.startsWith(base))

                if (existing) {
                    // Focus the window first so it comes to the foreground
                    return existing.focus().then(() => {
                        // postMessage is the universal navigation mechanism.
                        // iOS Safari: navigate() is unsupported — postMessage is the ONLY way.
                        // Chrome/Android: postMessage works identically.
                        // The React app listens for SW_NAVIGATE and calls useNavigate().
                        existing.postMessage({ type: 'SW_NAVIGATE', url: safeUrl })
                        if (DEBUG) console.log('[MarinLoop SW] Sent SW_NAVIGATE to existing client:', safeUrl)
                    })
                }

                // No existing window — open a new one at the target URL
                if (DEBUG) console.log('[MarinLoop SW] Opening new window:', safeUrl)
                return self.clients.openWindow(safeUrl)
            })
            .catch((err) => {
                if (DEBUG) console.warn('[MarinLoop SW] notificationclick navigation failed:', err)
                // Last-resort fallback: open a new window
                return self.clients.openWindow(safeUrl).catch(() => {})
            })
    )
})

// ─── Background Sync ─────────────────────────────────────────────────────────
// When the browser regains connectivity and a sync is registered, relay
// SYNC_QUEUE to all open tabs so useOfflineQueue can replay the mutation queue.
self.addEventListener('sync', (event) => {
    if (event.tag === 'marinloop-queue') {
        if (DEBUG) console.log('[MarinLoop SW] Background sync triggered — relaying SYNC_QUEUE')
        event.waitUntil(
            self.clients
                .matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    const origin = self.location.origin
                    clientList
                        .filter((c) => c.url && c.url.startsWith(origin))
                        .forEach((c) => c.postMessage({ type: 'SYNC_QUEUE' }))
                })
                .catch((err) => {
                    if (DEBUG) console.warn('[MarinLoop SW] SYNC_QUEUE relay failed:', err)
                })
        )
    }
})

// ─── Message handler ──────────────────────────────────────────────────────────
// Allows the React app to trigger SW updates without waiting for tab close.
self.addEventListener('message', (event) => {
    if (DEBUG) console.log('[MarinLoop SW] Message received:', event.data)
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting()
    }
})
