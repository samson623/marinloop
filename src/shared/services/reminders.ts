import { supabase } from '@/shared/lib/supabase'

export interface Reminder {
  id: string
  user_id: string
  title: string
  body: string
  fire_at: string
  fired: boolean
  fired_at: string | null
  created_at: string
}

export interface ReminderCreateInput {
  user_id: string
  title: string
  body: string
  fire_at: string // ISO UTC timestamp
}

export const RemindersService = {
  async getAll(): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('fire_at', { ascending: true })

    if (error) throw error
    return data as Reminder[]
  },

  async create(input: ReminderCreateInput): Promise<Reminder> {
    const { data, error } = await supabase
      .from('reminders')
      .insert(input)
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
