import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePushNotifications } from '@/shared/hooks/usePushNotifications'

vi.mock('@/shared/services/push', () => ({
  PushService: {
    isSupported: vi.fn(),
    getPermission: vi.fn(),
    getExistingSubscription: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    testPush: vi.fn(),
  },
}))
vi.mock('@/shared/stores/app-store', () => ({
  useAppStore: () => ({ toast: vi.fn() }),
}))
vi.mock('@/shared/lib/device', () => ({
  needsAddToHomeScreenForPush: vi.fn(() => false),
}))

import { PushService } from '@/shared/services/push'

const mockPushService = vi.mocked(PushService)

// Helper to define (or redefine) window.PushManager
function definePushManager(value: unknown) {
  Object.defineProperty(window, 'PushManager', { value, configurable: true, writable: true })
}

// Helper to set Notification.permission
function setNotificationPermission(perm: NotificationPermission) {
  Object.defineProperty(window.Notification, 'permission', {
    get: () => perm,
    configurable: true,
  })
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: PushManager present, permission default
    definePushManager({})
    // Ensure Notification is defined in jsdom with a configurable permission
    if (typeof window.Notification === 'undefined') {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'default' },
        configurable: true,
        writable: true,
      })
    }
    setNotificationPermission('default')
    mockPushService.isSupported.mockReturnValue(true)
    mockPushService.getExistingSubscription.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns isSupported: false when window.PushManager is undefined', () => {
    definePushManager(undefined)
    mockPushService.isSupported.mockReturnValue(false)

    const { result } = renderHook(() => usePushNotifications())

    expect(result.current.isSupported).toBe(false)
  })

  it('returns isSupported: true when PushManager is available', () => {
    definePushManager({})
    mockPushService.isSupported.mockReturnValue(true)

    const { result } = renderHook(() => usePushNotifications())

    expect(result.current.isSupported).toBe(true)
  })

  it('returns permission: "default" when Notification.permission is "default"', () => {
    setNotificationPermission('default')

    const { result } = renderHook(() => usePushNotifications())

    expect(result.current.permission).toBe('default')
  })

  it('returns permission: "granted" when Notification.permission is "granted"', () => {
    setNotificationPermission('granted')

    const { result } = renderHook(() => usePushNotifications())

    expect(result.current.permission).toBe('granted')
  })

  it('returns permission: "denied" when Notification.permission is "denied"', () => {
    setNotificationPermission('denied')

    const { result } = renderHook(() => usePushNotifications())

    expect(result.current.permission).toBe('denied')
  })

  it('subscribe() handles a missing service worker gracefully (returns false without throwing)', async () => {
    mockPushService.isSupported.mockReturnValue(true)
    // subscribe returns false to simulate missing SW / permission denied
    mockPushService.subscribe.mockResolvedValue(false)
    mockPushService.getExistingSubscription.mockResolvedValue(null)

    const { result } = renderHook(() => usePushNotifications())

    // Should not throw
    await expect(result.current.subscribe()).resolves.toBeUndefined()
    expect(mockPushService.subscribe).toHaveBeenCalledOnce()
  })

  it('isSubscribed starts as false when no existing subscription is found', async () => {
    mockPushService.getExistingSubscription.mockResolvedValue(null)

    const { result } = renderHook(() => usePushNotifications())

    // Initially false; after async refresh it remains false
    expect(result.current.isSubscribed).toBe(false)
  })
})
