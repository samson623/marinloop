import type { Database } from '@/shared/types/database.types'

export type DoseStatus = Database['public']['Enums']['dose_status']
export type NotificationType = Database['public']['Enums']['notification_type']

export type MedicationRow = Database['public']['Tables']['medications']['Row']
export type MedicationCreateInput = Pick<
  Database['public']['Tables']['medications']['Insert'],
  'name' | 'dosage' | 'instructions' | 'warnings' | 'freq' | 'color' | 'icon'
>
export type MedicationUpdateInput = Partial<MedicationCreateInput>

export type ScheduleCreateInput = Pick<
  Database['public']['Tables']['schedules']['Insert'],
  'time' | 'days' | 'food_context_minutes' | 'active'
> & { medication_id: string }

export type MedicationBundleScheduleInput = Pick<
  Database['public']['Tables']['schedules']['Insert'],
  'time' | 'days' | 'food_context_minutes' | 'active'
>

export type DoseLogCreateInput = Pick<
  Database['public']['Tables']['dose_logs']['Insert'],
  'medication_id' | 'schedule_id' | 'taken_at' | 'status' | 'notes'
>

export type AppointmentCreateInput = Pick<
  Database['public']['Tables']['appointments']['Insert'],
  'title' | 'doctor' | 'location' | 'commute_minutes' | 'start_time' | 'notes'
>

export type RefillUpsertInput = Pick<
  Database['public']['Tables']['refills']['Insert'],
  'medication_id' | 'current_quantity' | 'total_quantity' | 'refill_date' | 'pharmacy'
>

export type MedicationBundleRefillInput = Pick<
  Database['public']['Tables']['refills']['Insert'],
  'current_quantity' | 'total_quantity' | 'refill_date' | 'pharmacy'
>

export interface MedicationBundleCreateInput {
  medication: MedicationCreateInput
  schedules: MedicationBundleScheduleInput[]
  refill: MedicationBundleRefillInput
}

export type VoiceIntentType =
  | 'navigate'
  | 'open_add_med'
  | 'open_add_appt'
  | 'create_reminder'
  | 'log_dose'
  | 'query_next_dose'
  | 'add_note'
  | 'unknown'

export type VoiceNavigateTarget = 'timeline' | 'meds' | 'appts' | 'summary'
export type VoiceDoseStatus = 'taken' | 'missed'

export interface VoiceMedicationDraft {
  name?: string
  dosage?: string
  freq?: number
  time?: string
  instructions?: string
  warnings?: string
  supply?: number
}

export interface VoiceAppointmentDraft {
  title?: string
  date?: string
  time?: string
  location?: string
  notes?: string
}

export interface VoiceReminderDraft {
  title?: string
  message?: string
  in_minutes?: number
  at_iso?: string
}

export interface VoiceDoseDraft {
  status?: VoiceDoseStatus
  medication_name?: string
  when?: 'now' | 'morning' | 'afternoon' | 'evening' | 'night'
}

export interface VoiceNoteDraft {
  medication_name?: string
  text: string
}

export interface VoiceIntentEntities {
  navigate?: { target?: VoiceNavigateTarget }
  medication?: VoiceMedicationDraft
  appointment?: VoiceAppointmentDraft
  reminder?: VoiceReminderDraft
  dose?: VoiceDoseDraft
  note?: VoiceNoteDraft
}

export interface VoiceIntentResult {
  intent: VoiceIntentType
  entities: VoiceIntentEntities
  confidence: number
  missing: string[]
  requires_confirmation: boolean
  assistant_message?: string
}
