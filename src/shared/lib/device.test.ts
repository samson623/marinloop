import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isIOS,
  isStandalone,
  needsAddToHomeScreenForPush,
  getPlatformLabel,
} from '@/shared/lib/device'

function setUserAgent(ua: string): void {
  Object.defineProperty(globalThis.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  })
}

describe('device', () => {
  const originalUA = navigator.userAgent

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    setUserAgent(originalUA)
  })

  describe('isIOS', () => {
    it('returns true for iPhone UA', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')
      expect(isIOS()).toBe(true)
    })

    it('returns true for iPad UA', () => {
      setUserAgent('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')
      expect(isIOS()).toBe(true)
    })

    it('returns false for Android UA', () => {
      setUserAgent('Mozilla/5.0 (Linux; Android 13)')
      expect(isIOS()).toBe(false)
    })

    it('returns false for Desktop UA', () => {
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      expect(isIOS()).toBe(false)
    })
  })

  describe('getPlatformLabel', () => {
    it('returns iOS for iPhone UA', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')
      expect(getPlatformLabel()).toBe('iOS')
    })

    it('returns Android for Android UA', () => {
      setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S918B)')
      expect(getPlatformLabel()).toBe('Android')
    })

    it('returns Desktop for non-mobile UA', () => {
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      expect(getPlatformLabel()).toBe('Desktop')
    })
  })

  describe('needsAddToHomeScreenForPush', () => {
    it('returns true when iOS and not standalone', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')
      expect(needsAddToHomeScreenForPush()).toBe(true)
    })
  })

  describe('isStandalone', () => {
    it('returns boolean', () => {
      expect(typeof isStandalone()).toBe('boolean')
    })
  })
})
