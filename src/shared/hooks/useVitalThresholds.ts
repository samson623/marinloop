/**
 * useVitalThresholds — per-user vital threshold management.
 *
 * Thresholds are stored as JSONB on profiles.vital_thresholds.
 * A null min/max means no threshold on that side.
 *
 * Alert logic:
 *  - If a reading is outside [min, max] for any configured vital → alert
 *  - 7-day trend flagging: if the last 7 readings are all trending toward a boundary
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/auth-store'
import { AuditService } from '@/shared/services/audit'
import type { Vital } from '@/shared/services/vitals'

export type ThresholdKey = 'bp_systolic' | 'bp_diastolic' | 'heart_rate' | 'glucose' | 'o2_saturation' | 'weight'

export interface ThresholdRange {
  min: number | null
  max: number | null
}

export type VitalThresholds = Partial<Record<ThresholdKey, ThresholdRange>>

export interface VitalAlert {
  key: ThresholdKey
  label: string
  value: number
  limit: 'min' | 'max'
  threshold: number
  severity: 'warning' | 'critical'
}

const KEY_LABELS: Record<ThresholdKey, string> = {
  bp_systolic:   'Systolic BP',
  bp_diastolic:  'Diastolic BP',
  heart_rate:    'Heart Rate',
  glucose:       'Blood Glucose',
  o2_saturation: 'O₂ Saturation',
  weight:        'Weight',
}

// Default safe ranges — used as guidance defaults, not auto-applied
export const DEFAULT_THRESHOLDS: VitalThresholds = {
  bp_systolic:   { min: 90,  max: 180 },
  bp_diastolic:  { min: 60,  max: 120 },
  heart_rate:    { min: 40,  max: 130 },
  glucose:       { min: 70,  max: 250 },
  o2_saturation: { min: 92,  max: null },
}

export function checkVitalAlerts(vital: Vital, thresholds: VitalThresholds): VitalAlert[] {
  const alerts: VitalAlert[] = []
  const check = (key: ThresholdKey, value: number | null | undefined) => {
    if (value == null) return
    const t = thresholds[key]
    if (!t) return
    if (t.min != null && value < t.min) {
      const gap = t.min - value
      alerts.push({ key, label: KEY_LABELS[key], value, limit: 'min', threshold: t.min, severity: gap > t.min * 0.1 ? 'critical' : 'warning' })
    }
    if (t.max != null && value > t.max) {
      const gap = value - t.max
      alerts.push({ key, label: KEY_LABELS[key], value, limit: 'max', threshold: t.max, severity: gap > t.max * 0.15 ? 'critical' : 'warning' })
    }
  }
  check('bp_systolic',   vital.bp_systolic)
  check('bp_diastolic',  vital.bp_diastolic)
  check('heart_rate',    vital.heart_rate)
  check('glucose',       vital.glucose)
  check('o2_saturation', vital.o2_saturation)
  check('weight',        vital.weight)
  return alerts
}

/** Returns a 7-day trend label if all recent readings are consistently high/low */
export function detectTrend(vitals: Vital[], key: ThresholdKey, thresholds: VitalThresholds): 'rising' | 'falling' | null {
  const t = thresholds[key]
  if (!t) return null
  const recent = vitals
    .filter((v) => v[key] != null)
    .slice(0, 7)
    .map((v) => v[key] as number)
  if (recent.length < 4) return null
  const allRising  = recent.every((v, i) => i === 0 || v >= recent[i - 1])
  const allFalling = recent.every((v, i) => i === 0 || v <= recent[i - 1])
  if (allRising  && t.max != null && recent[0] > t.max * 0.85) return 'rising'
  if (allFalling && t.min != null && recent[0] < t.min * 1.15) return 'falling'
  return null
}

export function useVitalThresholds() {
  const { profile, session } = useAuthStore()
  const queryClient = useQueryClient()

  const thresholds: VitalThresholds = (profile?.vital_thresholds as VitalThresholds) ?? {}

  const updateMutation = useMutation({
    mutationFn: async (newThresholds: VitalThresholds) => {
      const userId = session?.user?.id
      if (!userId) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('profiles')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ vital_thresholds: newThresholds as any })
        .eq('id', userId)
      if (error) throw error
      return newThresholds
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      AuditService.logAsync({ action: 'vital_thresholds.updated', entity_type: 'profile' })
    },
  })

  return {
    thresholds,
    updateThresholds: updateMutation.mutate,
    updateThresholdsAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    checkVitalAlerts: (vital: Vital) => checkVitalAlerts(vital, thresholds),
    detectTrend:      (vitals: Vital[], key: ThresholdKey) => detectTrend(vitals, key, thresholds),
    KEY_LABELS,
  }
}
