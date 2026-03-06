import { useMemo } from 'react'
import { useMedications } from '@/shared/hooks/useMedications'
import { useRefills } from '@/shared/hooks/useRefillsList'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { getSupplyInfo } from '@/shared/lib/medication-utils'

export interface RefillPrediction {
  medId: string
  medName: string
  daysLeft: number
  depletionDate: Date | null
  severity: 'critical' | 'warning' | 'ok'
  supply: number
  total: number
}

const SEVERITY_ORDER: Record<RefillPrediction['severity'], number> = {
  critical: 0,
  warning: 1,
  ok: 2,
}

function getSeverity(daysLeft: number): RefillPrediction['severity'] {
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 7) return 'warning'
  return 'ok'
}

export function useRefillPredictions(): { predictions: RefillPrediction[]; isLoading: boolean } {
  const { meds, isLoading: medsLoading } = useMedications()
  const { refills, isLoading: refillsLoading } = useRefills()
  const { scheds, isLoading: schedsLoading } = useSchedules()

  const predictions = useMemo<RefillPrediction[]>(() => {
    if (!meds.length) return []

    const refillByMedId = new Map(refills.map(r => [r.medication_id, r]))

    // Count active schedules per medication to derive dosesPerDay
    const schedsByMedId = new Map<string, number>()
    for (const sched of scheds) {
      if (!sched.active) continue
      // Each schedule entry = one dose per scheduled day; use the number of
      // days in the schedule to compute average daily doses.
      // days is an array of weekday indices (0-6). A 7-day schedule means
      // the dose fires every day; a 5-day schedule fires 5/7 days per week.
      const avgDailyDoses = sched.days.length / 7
      schedsByMedId.set(
        sched.medication_id,
        (schedsByMedId.get(sched.medication_id) ?? 0) + avgDailyDoses,
      )
    }

    const result: RefillPrediction[] = meds.map(med => {
      const refill = refillByMedId.get(med.id)
      const supply = refill?.current_quantity ?? 0
      const total = refill?.total_quantity ?? 0
      // Fall back to med.freq (doses per day) if no schedule data is available
      const dosesPerDay = schedsByMedId.get(med.id) ?? med.freq ?? 1
      const { days: daysLeft, depletionDate } = getSupplyInfo(supply, total, dosesPerDay)
      const severity = getSeverity(daysLeft)

      return {
        medId: med.id,
        medName: med.name,
        daysLeft,
        depletionDate,
        severity,
        supply,
        total,
      }
    })

    return result.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    )
  }, [meds, refills, scheds])

  return {
    predictions,
    isLoading: medsLoading || refillsLoading || schedsLoading,
  }
}
