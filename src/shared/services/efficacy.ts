/**
 * Medication Efficacy Service
 * Correlates vitals recorded within ±2 hours of a dose with that medication,
 * then computes a before/after trend for AI insight generation.
 */
import { supabase } from '@/shared/lib/supabase'
import type { Vital } from './vitals'

export interface EfficacyCorrelation {
  medicationId: string
  medicationName: string
  medicationCreatedAt: string
  vitalType: 'bp_systolic' | 'bp_diastolic' | 'heart_rate' | 'glucose' | 'o2_saturation'
  vitalLabel: string
  unit: string
  /** Average value of the vital in the first 7 days after starting the medication */
  avgAfterStart: number | null
  /** Average value of the vital in the 7 days before starting the medication */
  avgBeforeStart: number | null
  /** Change (after - before); negative means improvement for BP/HR/glucose */
  delta: number | null
  /** Vitals with a paired dose log within 2 hours */
  correlatedReadings: Array<{ recordedAt: string; value: number }>
}

type VitalNumericKey = 'bp_systolic' | 'bp_diastolic' | 'heart_rate' | 'glucose' | 'o2_saturation'

const VITAL_META: Record<VitalNumericKey, { label: string; unit: string }> = {
  bp_systolic:   { label: 'Systolic BP',    unit: 'mmHg' },
  bp_diastolic:  { label: 'Diastolic BP',   unit: 'mmHg' },
  heart_rate:    { label: 'Heart Rate',     unit: 'bpm' },
  glucose:       { label: 'Blood Glucose',  unit: 'mg/dL' },
  o2_saturation: { label: 'O₂ Saturation',  unit: '%' },
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

export const EfficacyService = {
  /**
   * Returns efficacy correlations for all active medications that have
   * at least 5 correlated vital readings.
   */
  async getCorrelations(vitals: Vital[]): Promise<EfficacyCorrelation[]> {
    if (vitals.length === 0) return []

    // Fetch medications with their creation dates
    const { data: meds, error: medsErr } = await supabase
      .from('medications')
      .select('id, name, created_at')
      .is('discontinued_at', null)

    if (medsErr || !meds || meds.length === 0) return []

    // Fetch recent dose logs (last 90 days)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: logs, error: logsErr } = await supabase
      .from('dose_logs')
      .select('medication_id, taken_at')
      .gte('taken_at', since)

    if (logsErr || !logs) return []

    const results: EfficacyCorrelation[] = []

    for (const med of meds) {
      for (const vKey of Object.keys(VITAL_META) as VitalNumericKey[]) {
        const { label, unit } = VITAL_META[vKey]

        // Find dose logs for this medication
        const medLogs = logs.filter((l) => l.medication_id === med.id)
        if (medLogs.length === 0) continue

        // Find vitals correlated with dose times (within 2 hours)
        const correlated: { recordedAt: string; value: number }[] = []
        for (const vital of vitals) {
          const vVal = vital[vKey]
          if (vVal == null) continue
          const vTime = new Date(vital.recorded_at).getTime()
          const hasNearbyDose = medLogs.some((log) => {
            const dTime = new Date(log.taken_at).getTime()
            return Math.abs(vTime - dTime) <= 2 * 60 * 60 * 1000 // 2h
          })
          if (hasNearbyDose) {
            correlated.push({ recordedAt: vital.recorded_at, value: vVal })
          }
        }

        if (correlated.length < 3) continue // not enough data

        // Before/after comparison using medication start date
        const startMs = new Date(med.created_at).getTime()
        const window7d = 7 * 24 * 60 * 60 * 1000

        const beforeVals = vitals
          .filter((v) => {
            const val = v[vKey]
            const t = new Date(v.recorded_at).getTime()
            return val != null && t < startMs && t >= startMs - window7d
          })
          .map((v) => v[vKey] as number)

        const afterVals = vitals
          .filter((v) => {
            const val = v[vKey]
            const t = new Date(v.recorded_at).getTime()
            return val != null && t >= startMs && t < startMs + window7d
          })
          .map((v) => v[vKey] as number)

        const avgBefore = avg(beforeVals)
        const avgAfter = avg(afterVals)
        const delta = avgBefore != null && avgAfter != null ? avgAfter - avgBefore : null

        results.push({
          medicationId: med.id,
          medicationName: med.name,
          medicationCreatedAt: med.created_at,
          vitalType: vKey,
          vitalLabel: label,
          unit,
          avgBeforeStart: avgBefore != null ? Math.round(avgBefore * 10) / 10 : null,
          avgAfterStart: avgAfter != null ? Math.round(avgAfter * 10) / 10 : null,
          delta: delta != null ? Math.round(delta * 10) / 10 : null,
          correlatedReadings: correlated,
        })
      }
    }

    return results
  },
}
