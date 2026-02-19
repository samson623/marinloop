import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn, formatTime, formatDate, getGreeting } from '@/shared/lib/utils'

describe('utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('a', 'b')).toBe('a b')
      expect(cn('a', false, 'b')).toBe('a b')
      expect(cn('px-2', 'px-4')).toBe('px-4')
    })
  })

  describe('formatTime', () => {
    it('formats date with hour and minute in 12h format', () => {
      expect(formatTime(new Date('2025-02-19T09:05:00'))).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/)
      expect(formatTime(new Date('2025-02-19T14:30:00'))).toMatch(/2:30\s*PM/)
    })
  })

  describe('formatDate', () => {
    it('formats date as weekday, month, day', () => {
      const out = formatDate(new Date('2025-02-19'))
      expect(out).toMatch(/February/)
      expect(out).toMatch(/\d{1,2}/) // day of month
    })
  })

  describe('getGreeting', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('returns Good morning before noon', () => {
      vi.setSystemTime(new Date('2025-02-19T09:00:00'))
      expect(getGreeting()).toBe('Good morning')
    })

    it('returns Good afternoon from 12 to 16:59', () => {
      vi.setSystemTime(new Date('2025-02-19T14:00:00'))
      expect(getGreeting()).toBe('Good afternoon')
    })

    it('returns Good evening from 17:00', () => {
      vi.setSystemTime(new Date('2025-02-19T18:00:00'))
      expect(getGreeting()).toBe('Good evening')
    })
  })
})
