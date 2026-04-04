import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'

type ReminderRow = Database['public']['Tables']['reminders']['Row']

export interface Reminder extends ReminderRow {
  appointment_id?: string | null
  profile_id?: string | null
}

export interface ReminderCreateInput {
  user_id: string
  title: string
  body: string
  fire_at: string // ISO UTC timestamp
  appointment_id?: string | null
  profile_id?: string | null
}

export const RemindersService = {
  async getAll(userId: string): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .order('fire_at', { ascending: true })

    if (error) throw error
    return data as Reminder[]
  },

  async getByAppointment(appointmentId: string): Promise<Reminder | null> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle()

    if (error) throw error
    return data as Reminder | null
  },

  async create(input: ReminderCreateInput): Promise<Reminder> {
    const { data, error } = await supabase
      .from('reminders')
      .insert(input as never)
      .select('*')
      .single()

    if (error) throw error
    return data as Reminder
  },

  async update(id: string, updates: Partial<Pick<Reminder, 'title' | 'body' | 'fire_at'>>): Promise<Reminder> {
    const { data, error } = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as Reminder
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async snooze(id: string, minutes = 10): Promise<string> {
    const { data, error } = await supabase
      .rpc('snooze_reminder', { p_reminder_id: id, p_snooze_minutes: minutes })

    if (error) throw error
    return data as string
  },
}
