import { supabase } from '@/shared/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Vital {
  id: string
  user_id: string
  recorded_at: string
  bp_systolic: number | null
  bp_diastolic: number | null
  heart_rate: number | null
  glucose: number | null
  weight: number | null
  temperature: number | null
  o2_saturation: number | null
  notes: string | null
  created_at: string
}

export type VitalCreateInput = Omit<Vital, 'id' | 'user_id' | 'created_at'>
export type VitalUpdateInput = Partial<VitalCreateInput>

// ---------------------------------------------------------------------------
// VitalsService
// ---------------------------------------------------------------------------

export const VitalsService = {
  async getAll(): Promise<Vital[]> {
    const { data, error } = await supabase
      .from('vitals')
      .select('*')
      .order('recorded_at', { ascending: false })

    if (error) throw error
    return data as Vital[]
  },

  async getRecent(limit = 30): Promise<Vital[]> {
    const { data, error } = await supabase
      .from('vitals')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data as Vital[]
  },

  async getByDateRange(from: string, to: string): Promise<Vital[]> {
    const { data, error } = await supabase
      .from('vitals')
      .select('*')
      .gte('recorded_at', from)
      .lte('recorded_at', to)
      .order('recorded_at', { ascending: false })

    if (error) throw error
    return data as Vital[]
  },

  async create(input: VitalCreateInput): Promise<Vital> {
    const { data, error } = await supabase
      .from('vitals')
      .insert(input)
      .select('*')
      .single()

    if (error) throw error
    return data as Vital
  },

  async update(id: string, updates: VitalUpdateInput): Promise<Vital> {
    const { data, error } = await supabase
      .from('vitals')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as Vital
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('vitals')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
