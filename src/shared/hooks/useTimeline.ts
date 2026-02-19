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
      const st = log ? (log.status === 'taken' ? 'done' : log.status) : 'pending'
      const at = log ? toLocalTimeString(log.taken_at) : null

      items.push({
        id: schedule.id,
        tp: 'med',
        mid: schedule.medication_id,
        name: med.name,
        dose: med.dosage ?? '',
        time,
        tm: timeToMinutes(time),
        inst: med.instructions ?? '',
        warn: med.warnings ?? '',
        st,
        at,
      })
    }

    for (const appt of appts) {
      const date = isoToLocalDate(appt.start_time)
      if (date !== todayStr) continue

      const time = toLocalTimeString(appt.start_time)
      items.push({
        id: `appt_${appt.id}`,
        tp: 'appt',
        name: appt.title,
        time,
        tm: timeToMinutes(time),
        inst: appt.notes ?? '',
        loc: appt.location ?? '',
        st: 'appt',
      })
    }

    return sortAndMarkNext(items, nowMinutes())
  }, [isDemo, demoSched, meds, scheds, todayLogs, appts])

  return {
    timeline: timelineItems,
    isLoading: false,
  }
}
