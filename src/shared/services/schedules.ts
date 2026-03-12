import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'
import type { ScheduleCreateInput } from '@/shared/types/contracts'

type Schedule = Database['public']['Tables']['schedules']['Row']

export const SchedulesService = {
  async getAll(profileId?: string | null): Promise<Schedule[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('schedules')
      .select('*')
      .order('time')

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

  async create(sched: ScheduleCreateInput): Promise<Schedule> {
    const { data, error } = await supabase
      .from('schedules')
      .insert(sched)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const { data, error } = await supabase
      .from('schedules')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}