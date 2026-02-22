import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'
import type { RefillUpsertInput } from '@/shared/types/contracts'

type Refill = Database['public']['Tables']['refills']['Row']

export const RefillsService = {
  async getAll(): Promise<Refill[]> {
    const { data, error } = await supabase
      .from('refills')
      .select('*')

    if (error) throw error
    return data
  },

  async getByMedication(medId: string): Promise<Refill | null> {
    const { data, error } = await supabase
      .from('refills')
      .select('*')
      .eq('medication_id', medId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async upsert(refill: RefillUpsertInput): Promise<Refill> {
    const { data, error } = await supabase
      .from('refills')
      .upsert(refill, { onConflict: 'medication_id,user_id' })
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Refill>): Promise<Refill> {
    const { data, error } = await supabase
      .from('refills')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('refills')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}