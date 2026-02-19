import { describe, it, expect } from 'vitest'
import { timeToMinutes, nowMinutes, sortAndMarkNext, type TimelineItemLike } from '@/shared/lib/timeline-utils'

describe('timeline-utils', () => {
  describe('timeToMinutes', () => {
    it('parses HH:MM to minutes since midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0)
      expect(timeToMinutes('08:00')).toBe(8 * 60)
      expect(timeToMinutes('08:30')).toBe(8 * 60 + 30)
      expect(timeToMinutes('23:59')).toBe(23 * 60 + 59)
      expect(timeToMinutes('12:00')).toBe(12 * 60)
    })
    it('handles HH:MM:SS by using only H and M', () => {
      expect(timeToMinutes('08:15:00')).toBe(8 * 60 + 15)
    })
  })

  describe('nowMinutes', () => {
    it('returns minutes since midnight for a given date', () => {
      expect(nowMinutes(new Date('2025-01-01T00:00:00'))).toBe(0)
      expect(nowMinutes(new Date('2025-01-01T14:30:00'))).toBe(14 * 60 + 30)
    })
  })

  describe('sortAndMarkNext', () => {
    const item = (id: string, tm: number, tp: string, st: string): TimelineItemLike => ({
      id,
      tp,
      tm,
      st,
    })

    it('sorts items by tm ascending', () => {
      const items = [
        item('c', 14 * 60, 'med', 'pending'),
        item('a', 8 * 60, 'med', 'pending'),
        item('b', 12 * 60, 'med', 'done'),
      ]
      sortAndMarkNext(items, 10 * 60)
      expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    })

    it('marks first pending med at or after (now - 60) as next', () => {
      const items = [
        item('past', 8 * 60, 'med', 'pending'),
        item('soon', 10 * 60, 'med', 'pending'),
        item('later', 14 * 60, 'med', 'pending'),
      ]
      const now = 10 * 60 + 30
      sortAndMarkNext(items, now)
      expect(items.find((i) => i.id === 'past')?.nx).toBeUndefined()
      expect((items.find((i) => i.id === 'soon') as TimelineItemLike & { nx?: boolean }).nx).toBe(true)
      expect(items.find((i) => i.id === 'later')?.nx).toBeUndefined()
    })

    it('does not mark appt or done items as next', () => {
      const items = [
        item('med-pending', 10 * 60, 'med', 'pending'),
        item('appt', 10 * 60, 'appt', 'appt'),
      ]
      sortAndMarkNext(items, 10 * 60)
      expect((items[0] as TimelineItemLike & { nx?: boolean }).nx).toBe(true)
      expect((items[1] as TimelineItemLike & { nx?: boolean }).nx).toBeUndefined()
    })

    it('marks only one item as next', () => {
      const items = [
        item('a', 9 * 60, 'med', 'pending'),
        item('b', 10 * 60, 'med', 'pending'),
        item('c', 11 * 60, 'med', 'pending'),
      ]
      sortAndMarkNext(items, 10 * 60)
      const nextCount = items.filter((i) => (i as TimelineItemLike & { nx?: boolean }).nx).length
      expect(nextCount).toBe(1)
    })
  })
})
