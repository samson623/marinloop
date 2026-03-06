import { supabase } from '@/shared/lib/supabase'
import type { DrugInteraction } from '@/shared/services/rxnorm'

export interface TimingPattern {
  scheduleId: string
  scheduledTime: string   // HH:MM
  avgActualTime: string   // HH:MM
  offsetMinutes: number   // positive = runs late, negative = runs early
  sampleSize: number
}

export interface MissPattern {
  dayOfWeek: number       // 0=Sun, 6=Sat
  dayLabel: string        // 'Sunday', etc.
  scheduledTime: string   // HH:MM
  medName: string
  medId: string
  scheduleId: string
  missRate: number        // 0-1
  totalSamples: number
}

export interface ConflictWarning {
  med1Name: string
  med2Name: string
  med1Time: string
  med2Time: string
  interactionDescription: string
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Convert an HH:MM string to minutes since midnight. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Convert minutes since midnight to HH:MM string. */
function minutesToTime(minutes: number): string {
  const totalMins = ((minutes % 1440) + 1440) % 1440 // wrap to [0, 1440)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Extract HH:MM from an ISO timestamp string, interpreting it as local time. */
function extractLocalHHMM(isoString: string): string {
  const date = new Date(isoString)
  const h = date.getHours()
  const m = date.getMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Analyse timing drift for a medication: how many minutes early/late does the
 * user typically take each scheduled dose?
 * Only returns patterns where sampleSize >= 7 AND |offsetMinutes| > 30.
 */
export async function getTimingPatterns(medicationId: string): Promise<TimingPattern[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [logsRes, schedulesRes] = await Promise.all([
    supabase
      .from('dose_logs')
      .select('taken_at, schedule_id, status')
      .eq('medication_id', medicationId)
      .gte('taken_at', thirtyDaysAgo)
      .in('status', ['taken', 'late']),
    supabase
      .from('schedules')
      .select('id, time')
      .eq('medication_id', medicationId),
  ])

  if (logsRes.error) throw logsRes.error
  if (schedulesRes.error) throw schedulesRes.error

  const logs = logsRes.data ?? []
  const schedules = schedulesRes.data ?? []

  // Build a lookup: scheduleId -> scheduled HH:MM
  const scheduleTimeMap = new Map<string, string>()
  for (const s of schedules) {
    scheduleTimeMap.set(s.id, s.time)
  }

  // Group logs by schedule_id
  const logsBySchedule = new Map<string, string[]>()
  for (const log of logs) {
    if (!log.schedule_id) continue
    const existing = logsBySchedule.get(log.schedule_id) ?? []
    existing.push(log.taken_at)
    logsBySchedule.set(log.schedule_id, existing)
  }

  const patterns: TimingPattern[] = []

  for (const [scheduleId, takenAts] of logsBySchedule) {
    const scheduledTime = scheduleTimeMap.get(scheduleId)
    if (!scheduledTime) continue

    const scheduledMins = timeToMinutes(scheduledTime)
    const offsets: number[] = []

    for (const takenAt of takenAts) {
      const actualMins = timeToMinutes(extractLocalHHMM(takenAt))
      // Compute signed offset in [-720, 720] to handle midnight wrap
      let offset = actualMins - scheduledMins
      if (offset > 720) offset -= 1440
      if (offset < -720) offset += 1440
      offsets.push(offset)
    }

    if (offsets.length < 7) continue

    const avgOffset = Math.round(offsets.reduce((a, b) => a + b, 0) / offsets.length)
    if (Math.abs(avgOffset) <= 30) continue

    const avgActualMins = scheduledMins + avgOffset
    patterns.push({
      scheduleId,
      scheduledTime,
      avgActualTime: minutesToTime(avgActualMins),
      offsetMinutes: avgOffset,
      sampleSize: offsets.length,
    })
  }

  return patterns
}

/**
 * Find (schedule, day-of-week) combinations where the user misses doses more
 * than 50% of the time, requiring at least 4 samples.
 */
export async function getMissPatterns(daysBack = 28): Promise<MissPattern[]> {
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

  const [logsRes, schedulesRes] = await Promise.all([
    supabase
      .from('dose_logs')
      .select('taken_at, schedule_id, status, medication_id')
      .gte('taken_at', cutoff),
    supabase
      .from('schedules')
      .select('id, medication_id, time, days, active')
      .eq('active', true),
  ])

  if (logsRes.error) throw logsRes.error
  if (schedulesRes.error) throw schedulesRes.error

  const logs = logsRes.data ?? []
  const schedules = schedulesRes.data ?? []

  // Fetch medication names for all relevant medication IDs
  const medIds = [...new Set(schedules.map((s) => s.medication_id))]
  const medsRes = await supabase
    .from('medications')
    .select('id, name')
    .in('id', medIds)

  if (medsRes.error) throw medsRes.error

  const medNameMap = new Map<string, string>()
  for (const med of medsRes.data ?? []) {
    medNameMap.set(med.id, med.name)
  }

  // Build schedule lookup
  const scheduleMap = new Map<string, { medicationId: string; time: string; days: number[] }>()
  for (const s of schedules) {
    scheduleMap.set(s.id, { medicationId: s.medication_id, time: s.time, days: s.days })
  }

  // Count logs per (schedule_id, day_of_week): { total, missed }
  type DayKey = `${string}:${number}`
  const counts = new Map<DayKey, { total: number; missed: number }>()

  for (const log of logs) {
    if (!log.schedule_id) continue
    const schedule = scheduleMap.get(log.schedule_id)
    if (!schedule) continue

    const dow = new Date(log.taken_at).getDay() as number
    const key: DayKey = `${log.schedule_id}:${dow}`
    const existing = counts.get(key) ?? { total: 0, missed: 0 }
    existing.total += 1
    if (log.status === 'missed') existing.missed += 1
    counts.set(key, existing)
  }

  const patterns: MissPattern[] = []

  for (const [key, { total, missed }] of counts) {
    if (total < 4) continue
    const missRate = missed / total
    if (missRate <= 0.5) continue

    const colonIdx = key.indexOf(':')
    const scheduleId = key.slice(0, colonIdx)
    const dayOfWeek = parseInt(key.slice(colonIdx + 1), 10)

    const schedule = scheduleMap.get(scheduleId)
    if (!schedule) continue

    // Only report on days that are actually scheduled
    if (!schedule.days.includes(dayOfWeek)) continue

    const medName = medNameMap.get(schedule.medicationId) ?? 'Unknown'

    patterns.push({
      dayOfWeek,
      dayLabel: DAY_LABELS[dayOfWeek] ?? 'Unknown',
      scheduledTime: schedule.time,
      medName,
      medId: schedule.medicationId,
      scheduleId,
      missRate,
      totalSamples: total,
    })
  }

  return patterns
}

/**
 * Given a list of medication schedules and known drug-drug interactions, find
 * cases where two interacting drugs are scheduled within 2 hours of each other.
 */
export function detectScheduleConflicts(
  meds: Array<{ name: string; times: string[] }>,
  interactions: DrugInteraction[],
): ConflictWarning[] {
  const warnings: ConflictWarning[] = []

  for (const interaction of interactions) {
    // Find the two meds involved in this interaction (case-insensitive partial match)
    const med1 = meds.find((m) =>
      m.name.toLowerCase().includes(interaction.drug1.toLowerCase()) ||
      interaction.drug1.toLowerCase().includes(m.name.toLowerCase()),
    )
    const med2 = meds.find((m) =>
      m.name.toLowerCase().includes(interaction.drug2.toLowerCase()) ||
      interaction.drug2.toLowerCase().includes(m.name.toLowerCase()),
    )

    if (!med1 || !med2 || med1 === med2) continue

    for (const time1 of med1.times) {
      for (const time2 of med2.times) {
        const diff = Math.abs(timeToMinutes(time1) - timeToMinutes(time2))
        // Handle midnight wrap: also check 1440 - diff
        const adjustedDiff = Math.min(diff, 1440 - diff)
        if (adjustedDiff < 120) {
          warnings.push({
            med1Name: med1.name,
            med2Name: med2.name,
            med1Time: time1,
            med2Time: time2,
            interactionDescription: interaction.description,
          })
        }
      }
    }
  }

  return warnings
}
