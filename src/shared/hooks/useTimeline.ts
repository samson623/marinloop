import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { type SchedItem } from '@/shared/stores/app-store'
import { todayLocal, isoToLocalDate, toLocalTimeString } from '@/shared/lib/dates'
import { timeToMinutes, nowMinutes, sortAndMarkNext } from '@/shared/lib/timeline-utils'

export function useTimeline() {
  const queryClient = useQueryClient()
  const { meds, isLoading: medsLoading, error: medsError } = useMedications()
  const { scheds, isLoading: schedsLoading } = useSchedules()
  const { todayLogs, isLoading: logsLoading } = useDoseLogs()
  const { appts, isLoading: apptsLoading, error: apptsError } = useAppointments()

  const isLoading = medsLoading || schedsLoading || logsLoading || apptsLoading
  const error = medsError ?? apptsError ?? null

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['medications'] })
    void queryClient.invalidateQueries({ queryKey: ['schedules'] })
    void queryClient.invalidateQueries({ queryKey: ['dose_logs'] })
    void queryClient.invalidateQueries({ queryKey: ['appointments'] })
  }, [queryClient])

  const timelineItems = useMemo(() => {
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
  }, [meds, scheds, todayLogs, appts])

  return {
    timeline: timelineItems,
    isLoading,
    error,
    refetch,
  }
}
