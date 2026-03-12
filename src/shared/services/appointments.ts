import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'
import type { AppointmentCreateInput } from '@/shared/types/contracts'

type Appointment = Database['public']['Tables']['appointments']['Row']

export const AppointmentsService = {
  async getAll(profileId?: string | null): Promise<Appointment[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('appointments')
      .select('*')
      .order('start_time')

    if (profileId === undefined) {
      // no filter
    } else if (profileId === null) {
      query = query.is('profile_id', null)
    } else {
      query = query.eq('profile_id', profileId)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async create(appt: AppointmentCreateInput): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appt)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}