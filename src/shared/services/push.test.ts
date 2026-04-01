import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/shared/lib/env', () => ({
  env: {
    vapidPublicKey: 'BEl6gQv7Q2g0m4N2uL9x4L8K7wR5b2J1mP0nY6tV3cX8qA1sD4fG7hJ9kL2mN5pQ8rT1uV4wX7yZ0aB3cD6eF9gH',
  },
}))

const mocks = vi.hoisted(() => {
  const getUser = vi.fn(async () => ({ data: { user: { id: 'user-123' } } }))
  const upsert = vi.fn(async () => ({ error: null }))
  const from = vi.fn(() => ({ upsert }))
  return { getUser, upsert, from }
})

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}))

import { PushService } from '@/shared/services/push'

function setNotificationMock(permission: NotificationPermission, requestPermission?: () => Promise<NotificationPermission>) {
  let currentPermission = permission
  vi.stubGlobal('Notification', {
    get permission() {
      return currentPermission
    },
    requestPermission: vi.fn(async () => {
      const next = requestPermission ? await requestPermission() : currentPermission
      currentPermission = next
      return next
    }),
  })
}

function setPushSupport() {
  Object.defineProperty(window, 'PushManager', {
    value: function PushManager() { },
    configurable: true,
    writable: true,
  })
}

describe('PushService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    mocks.upsert.mockResolvedValue({ error: null })
    mocks.from.mockImplementation(() => ({ upsert: mocks.upsert }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('isSupported', () => {
    it('returns false when push APIs are not fully available', () => {
      // jsdom provides a Notification stub and serviceWorker but not PushManager.
      // This documents the contract: all three must be present for push to work.
      expect(PushService.isSupported()).toBe(false)
    })
  })

  describe('getPermission', () => {
    beforeEach(() => {
      setNotificationMock('default')
    })

    it('returns the current Notification.permission', () => {
      expect(PushService.getPermission()).toBe('default')
    })

    it('reflects a granted permission state', () => {
      setNotificationMock('granted')
      expect(PushService.getPermission()).toBe('granted')
    })

    it('reflects a denied permission state', () => {
      setNotificationMock('denied')
      expect(PushService.getPermission()).toBe('denied')
    })
  })

  describe('subscribe', () => {
    it('requests notification permission before awaiting service worker registration', async () => {
      setPushSupport()

      const events: string[] = []
      setNotificationMock('default', async () => {
        events.push('permission')
        return 'granted'
      })

      const subscription = {
        endpoint: 'https://example.com/push/subscription',
        toJSON: () => ({
          endpoint: 'https://example.com/push/subscription',
          keys: {
            p256dh: 'p256dh-key',
            auth: 'auth-key',
          },
        }),
      }

      const pushManager = {
        getSubscription: vi.fn(async () => null),
        subscribe: vi.fn(async () => subscription),
      }

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({ pushManager }),
        },
        configurable: true,
      })

      const registerSpy = vi.spyOn(PushService, 'registerSW').mockImplementation(async () => {
        events.push('register')
        return { scope: '/' } as ServiceWorkerRegistration
      })

      const result = await PushService.subscribe()

      expect(result).toEqual({ ok: true })
      expect(events).toEqual(['permission', 'register'])
      expect(registerSpy).toHaveBeenCalledOnce()
      expect(pushManager.subscribe).toHaveBeenCalledOnce()
      expect(mocks.getUser).toHaveBeenCalledOnce()
      expect(mocks.from).toHaveBeenCalledWith('push_subscriptions')
      expect(mocks.upsert).toHaveBeenCalledOnce()
    })

    it('returns an error when service worker registration fails after permission is granted', async () => {
      setPushSupport()
      setNotificationMock('granted')

      const registerSpy = vi.spyOn(PushService, 'registerSW').mockResolvedValue(null)

      const result = await PushService.subscribe()

      expect(result).toEqual({ ok: false, error: 'Could not register notifications on this device' })
      expect(registerSpy).toHaveBeenCalledOnce()
      expect(mocks.getUser).not.toHaveBeenCalled()
    })
  })
})
