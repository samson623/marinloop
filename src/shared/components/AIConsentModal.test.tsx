import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAIConsent } from '@/shared/hooks/useAIConsent'

const CONSENT_KEY = 'marinloop_ai_consent_given'
const DECLINED_KEY = 'marinloop_ai_consent_declined'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('useAIConsent', () => {
  describe('initial state', () => {
    it('returns consented: false when localStorage is empty', () => {
      const { result } = renderHook(() => useAIConsent())
      expect(result.current.consented).toBe(false)
    })

    it('returns consented: true when localStorage has the consent key set to "1"', () => {
      localStorage.setItem(CONSENT_KEY, '1')
      const { result } = renderHook(() => useAIConsent())
      expect(result.current.consented).toBe(true)
    })

    it('returns consented: false when localStorage has the consent key set to something other than "1"', () => {
      localStorage.setItem(CONSENT_KEY, 'true')
      const { result } = renderHook(() => useAIConsent())
      expect(result.current.consented).toBe(false)
    })

    it('returns declined: false when localStorage is empty', () => {
      const { result } = renderHook(() => useAIConsent())
      expect(result.current.declined).toBe(false)
    })

    it('returns declined: true when localStorage has the declined key set to "1"', () => {
      localStorage.setItem(DECLINED_KEY, '1')
      const { result } = renderHook(() => useAIConsent())
      expect(result.current.declined).toBe(true)
    })
  })

  describe('consent()', () => {
    it('sets consented to true after calling consent()', () => {
      const { result } = renderHook(() => useAIConsent())
      expect(result.current.consented).toBe(false)

      act(() => {
        result.current.consent()
      })

      expect(result.current.consented).toBe(true)
    })

    it('writes the consent key to localStorage when consent() is called', () => {
      const { result } = renderHook(() => useAIConsent())

      act(() => {
        result.current.consent()
      })

      expect(localStorage.getItem(CONSENT_KEY)).toBe('1')
    })

    it('removes the declined key from localStorage when consent() is called', () => {
      localStorage.setItem(DECLINED_KEY, '1')
      const { result } = renderHook(() => useAIConsent())

      act(() => {
        result.current.consent()
      })

      expect(localStorage.getItem(DECLINED_KEY)).toBeNull()
    })

    it('sets declined to false after calling consent() when it was previously true', () => {
      localStorage.setItem(DECLINED_KEY, '1')
      const { result } = renderHook(() => useAIConsent())
      expect(result.current.declined).toBe(true)

      act(() => {
        result.current.consent()
      })

      expect(result.current.declined).toBe(false)
    })
  })

  describe('revoke()', () => {
    it('sets consented to false after calling revoke()', () => {
      localStorage.setItem(CONSENT_KEY, '1')
      const { result } = renderHook(() => useAIConsent())
      expect(result.current.consented).toBe(true)

      act(() => {
        result.current.revoke()
      })

      expect(result.current.consented).toBe(false)
    })

    it('removes the consent key from localStorage when revoke() is called', () => {
      localStorage.setItem(CONSENT_KEY, '1')
      const { result } = renderHook(() => useAIConsent())

      act(() => {
        result.current.revoke()
      })

      expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    })
  })

  describe('setDeclined()', () => {
    it('sets declined to true and writes to localStorage', () => {
      const { result } = renderHook(() => useAIConsent())

      act(() => {
        result.current.setDeclined(true)
      })

      expect(result.current.declined).toBe(true)
      expect(localStorage.getItem(DECLINED_KEY)).toBe('1')
    })

    it('sets declined to false and writes "0" to localStorage', () => {
      localStorage.setItem(DECLINED_KEY, '1')
      const { result } = renderHook(() => useAIConsent())

      act(() => {
        result.current.setDeclined(false)
      })

      expect(result.current.declined).toBe(false)
      expect(localStorage.getItem(DECLINED_KEY)).toBe('0')
    })
  })

  describe('consent() → revoke() round-trip', () => {
    it('correctly toggles consented state across consent then revoke', () => {
      const { result } = renderHook(() => useAIConsent())

      act(() => { result.current.consent() })
      expect(result.current.consented).toBe(true)
      expect(localStorage.getItem(CONSENT_KEY)).toBe('1')

      act(() => { result.current.revoke() })
      expect(result.current.consented).toBe(false)
      expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    })
  })
})
