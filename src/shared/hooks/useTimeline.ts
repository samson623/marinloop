import { useMemo } from 'react'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore, type SchedItem } from '@/shared/stores/app-store'
import { todayLocal, isoToLocalDate, toLocalTimeString } from '@/shared/lib/dates'
import { timeToMinutes, nowMinutes, sortAndMarkNext } from '@/shared/lib/timeline-utils'

export function useTimeline() {
  const { isDemo } = useAuthStore()
  const demoSched = useAppStore((s) => s.sched)

  const { meds } = useMedications()
  const { scheds } = useSchedules()
  const { todayLogs } = useDoseLogs()
  const { appts } = useAppointments()

  const timelineItems = useMemo(() => {
    if (isDemo) return demoSched

    const byMedication = new Map(meds.map((m) => [m.id, m]))
    const items: SchedItem[] = []
    const todayStr = todayLocal()

    for (const schedule of scheds) {
      if (!schedule.active) continue

      const med = byMedication.get(schedule.medication_id)
      if (!med) continue

      const time = schedule.time.slice(0, 5)
      const log = todayLogs.find((l) => l.schedule_id === schedule.id)
      const status = log ? (log.status === 'taken' ? 'done' : log.status) : 'pending'
      const actualTime = log ? toLocalTimeString(log.taken_at) : null

      items.push({
        id: schedule.id,
        type: 'med',
        medicationId: schedule.medication_id,
        name: med.name,
        dose: med.dosage ?? '',
        time,
        timeMinutes: timeToMinutes(time),
        instructions: med.instructions ?? '',
        warnings: med.warnings ?? '',
        status,
        actualTime,
      })
    }

    for (const appt of appts) {
      const date = isoToLocalDate(appt.start_time)
      if (date !== todayStr) continue

      const time = toLocalTimeString(appt.start_time)
      items.push({
        id: `appt_${appt.id}`,
        type: 'appt',
        name: appt.title,
        time,
        timeMinutes: timeToMinutes(time),
        instructions: appt.notes ?? '',
        loc: appt.location ?? '',
        status: 'appt',
      })
    }

    return sortAndMarkNext(items, nowMinutes())
  }, [isDemo, demoSched, meds, scheds, todayLogs, appts])

  return {
    timeline: timelineItems,
    isLoading: false,
  }
}
