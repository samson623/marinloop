/**
 * Pure helpers for timeline schedule math: time-to-minutes, sorting, next-dose selection.
 * Used by useTimeline; kept separate for testability without React/Supabase.
 */

export interface TimelineItemLike {
  id: string
  type: string
  timeMinutes: number
  status?: string
  isNext?: boolean
  medicationId?: string
}

/** Parse "HH:MM" or "HH:MM:SS" to minutes since midnight */
export function timeToMinutes(t: string): number {
  const parts = t.split(':').map(Number)
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  return h * 60 + m
}

/** Current time as minutes since midnight (for deterministic tests, pass a date or mock) */
export function nowMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * Sort items by tm (ascending) and mark the first pending med item at or after (now - 60) as "next".
 * Mutates items in place; returns the same array.
 */
export function sortAndMarkNext<T extends TimelineItemLike>(
  items: T[],
  nowMin: number = nowMinutes()
): T[] {
  items.sort((a, b) => a.timeMinutes - b.timeMinutes)
  const slack = 60
  let found = false
  for (const item of items) {
    if (!found && item.type === 'med' && item.status === 'pending' && item.timeMinutes >= nowMin - slack) {
      item.isNext = true
      found = true
    }
  }
  return items
}
