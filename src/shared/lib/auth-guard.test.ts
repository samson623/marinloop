import { describe, it, expect } from 'vitest'
import { getAuthView } from '@/shared/lib/auth-guard'

describe('auth-guard', () => {
  describe('getAuthView', () => {
    it('returns loading when isLoading is true', () => {
      expect(getAuthView(true, null, false)).toBe('loading')
      expect(getAuthView(true, { id: 'x' }, true)).toBe('loading')
    })

    it('returns login when no session and not demo', () => {
      expect(getAuthView(false, null, false)).toBe('login')
      expect(getAuthView(false, undefined, false)).toBe('login')
    })

    it('returns app when session exists', () => {
      expect(getAuthView(false, { user: {} }, false)).toBe('app')
    })

    it('returns app when isDemo is true even without session', () => {
      expect(getAuthView(false, null, true)).toBe('app')
    })
  })
})
