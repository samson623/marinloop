import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { todayLocal, toLocalDateString, toLocalTimeString, isoToLocalDate, dateOffset } from '@/shared/lib/dates'

describe('dates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-02-19T14:30:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('todayLocal', () => {
    it('returns YYYY-MM-DD in local timezone', () => {
      expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const [y, m, d] = todayLocal().split('-').map(Number)
      expect(y).toBeGreaterThanOrEqual(2024)
      expect(m).toBeGreaterThanOrEqual(1)
      expect(m).toBeLessThanOrEqual(12)
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(31)
    })
  })

  describe('toLocalDateString', () => {
    it('formats Date to YYYY-MM-DD', () => {
      expect(toLocalDateString(new Date('2025-02-19T00:00:00'))).toBe('2025-02-19')
      expect(toLocalDateString(new Date('2025-12-01T23:59:59'))).toBe('2025-12-01')
    })
  })

  describe('toLocalTimeString', () => {
    it('extracts HH:MM from ISO timestamp', () => {
      expect(toLocalTimeString('2025-02-19T09:05:00.000Z')).toMatch(/^\d{1,2}:\d{2}$/)
      expect(toLocalTimeString('2025-02-19T14:30:00.000Z').split(':').map(Number)).toHaveLength(2)
    })
  })

  describe('isoToLocalDate', () => {
    it('returns local date string from ISO', () => {
      const out = isoToLocalDate('2025-02-19T12:00:00.000Z')
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('dateOffset', () => {
    it('returns date n days from today as YYYY-MM-DD', () => {
      const today = todayLocal()
      expect(dateOffset(0)).toBe(today)
      const tomorrow = dateOffset(1)
      expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const yesterday = dateOffset(-1)
      expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})
