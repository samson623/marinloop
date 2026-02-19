import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'
import type { DoseLogCreateInput } from '@/shared/types/contracts'
import { toLocalDateString, isoToLocalDate, todayLocal } from '@/shared/lib/dates'

type DoseLog = Database['public']['Tables']['dose_logs']['Row']
type Schedule = Database['public']['Tables']['schedules']['Row']

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export const DoseLogsService = {
  async getAdherenceByDay(
    daysBack: number
  ): Promise<Record<string, { t: number; d: number }>> {
    const dates: string[] = []
    for (let i = 0; i < daysBack; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dates.push(toLocalDateString(d))
    }

    const earliestDate = new Date()
    earliestDate.setDate(earliestDate.getDate() - (daysBack - 1))
    earliestDate.setHours(0, 0, 0, 0)
    const startISO = earliestDate.toISOString()

    const latestDate = new Date()
    latestDate.setHours(23, 59, 59, 999)
    const endISO = latestDate.toISOString()

    const [logsResult, schedulesResult] = await Promise.all([
      supabase
        .from('dose_logs')
        .select('taken_at, status')
        .gte('taken_at', startISO)
        .lte('taken_at', endISO),
      supabase.from('schedules').select('days').eq('active', true),
    ])

    if (logsResult.error) throw logsResult.error
    if (schedulesResult.error) throw schedulesResult.error

    const logs = logsResult.data as Pick<DoseLog, 'taken_at' | 'status'>[]
    const schedules = schedulesResult.data as Pick<Schedule, 'days'>[]

    const result: Record<string, { t: number; d: number }> = {}
    for (const date of dates) {
      result[date] = { t: 0, d: 0 }
    }

    for (const date of dates) {
      const dow = getDayOfWeek(date)
      result[date].t = schedules.filter((s) => s.days?.includes(dow)).length
    }

    for (const log of logs) {
      const date = isoToLocalDate(log.taken_at)
      if (date in result && (log.status === 'taken' || log.status === 'late')) {
        result[date].d += 1
      }
    }

    return result
  },

  async getToday(): Promise<DoseLog[]> {
    const today = todayLocal()
    const start = new Date(`${today}T00:00:00`)
    const end = new Date(`${today}T23:59:59.999`)

    const { data, error } = await supabase
      .from('dose_logs')
      .select('*')
      .gte('taken_at', start.toISOString())
      .lte('taken_at', end.toISOString())
      .order('taken_at')

    if (error) throw error
    return data
  },

  async logDose(log: DoseLogCreateInput): Promise<DoseLog> {
    const { data, error } = await supabase
      .from('dose_logs')
      .insert(log)
      .select('*')
      .single()

    if (error) throw error
    return data
  },
}