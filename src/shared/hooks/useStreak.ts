import { useMemo } from 'react'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { toLocalDateString } from '@/shared/lib/dates'

export interface StreakResult {
  currentStreak: number
  longestStreak: number
  isLoading: boolean
}

export function useStreak(): StreakResult {
  const { adherence, isLoading } = useAdherenceHistory(90)

  const { currentStreak, longestStreak } = useMemo(() => {
    if (!adherence || Object.keys(adherence).length === 0) {
      return { currentStreak: 0, longestStreak: 0 }
    }

    // Build ordered array of dates from 89 days ago to today
    const dates: string[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dates.push(toLocalDateString(d))
    }

    // A day counts as "perfect" if total > 0 and done === total
    const isPerfect = (date: string): boolean => {
      const entry = adherence[date]
      return !!entry && entry.t > 0 && entry.d >= entry.t
    }

    // Calculate longest streak
    let longest = 0
    let run = 0
    for (const date of dates) {
      if (isPerfect(date)) {
        run++
        if (run > longest) longest = run
      } else {
        run = 0
      }
    }

    // Calculate current streak (consecutive perfect days ending today)
    let current = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      if (isPerfect(dates[i])) {
        current++
      } else {
        break
      }
    }

    return { currentStreak: current, longestStreak: longest }
  }, [adherence])

  return { currentStreak, longestStreak, isLoading }
}
