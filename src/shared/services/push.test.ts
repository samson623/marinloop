import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PushService } from '@/shared/services/push'

describe('PushService', () => {
  afterEach(() => vi.unstubAllGlobals())

  describe('isSupported', () => {
    it('returns false when push APIs are not fully available', () => {
      // jsdom provides a Notification stub and serviceWorker but not PushManager.
      // This documents the contract: all three must be present for push to work.
      expect(PushService.isSupported()).toBe(false)
    })
  })

  describe('getPermission', () => {
    beforeEach(() => {
      vi.stubGlobal('Notification', { permission: 'default' })
    })

    it('returns the current Notification.permission', () => {
      expect(PushService.getPermission()).toBe('default')
    })

    it('reflects a granted permission state', () => {
      vi.stubGlobal('Notification', { permission: 'granted' })
      expect(PushService.getPermission()).toBe('granted')
    })

    it('reflects a denied permission state', () => {
      vi.stubGlobal('Notification', { permission: 'denied' })
      expect(PushService.getPermission()).toBe('denied')
    })
  })
})
