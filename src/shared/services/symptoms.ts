import { supabase } from '@/shared/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Symptom {
  id: string
  user_id: string
  name: string
  severity: number    // 1-10
  onset_at: string    // ISO timestamp
  resolved_at: string | null
  linked_medication_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type SymptomCreateInput = Omit<Symptom, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type SymptomUpdateInput = Partial<SymptomCreateInput>

// ---------------------------------------------------------------------------
// SymptomsService
// ---------------------------------------------------------------------------

export const SymptomsService = {
  async getAll(): Promise<Symptom[]> {
    const { data, error } = await supabase
      .from('symptoms')
      .select('*')
      .order('onset_at', { ascending: false })

    if (error) throw error
    return data as Symptom[]
  },

  async getActive(): Promise<Symptom[]> {
    const { data, error } = await supabase
      .from('symptoms')
      .select('*')
      .is('resolved_at', null)
      .order('onset_at', { ascending: false })

    if (error) throw error
    return data as Symptom[]
  },

  async getByMedication(medicationId: string): Promise<Symptom[]> {
    const { data, error } = await supabase
      .from('symptoms')
      .select('*')
      .eq('linked_medication_id', medicationId)
      .order('onset_at', { ascending: false })

    if (error) throw error
    return data as Symptom[]
  },

  async getRecent(limit = 30): Promise<Symptom[]> {
    const { data, error } = await supabase
      .from('symptoms')
      .select('*')
      .order('onset_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data as Symptom[]
  },

  async create(input: SymptomCreateInput): Promise<Symptom> {
    const { data, error } = await supabase
      .from('symptoms')
      .insert(input)
      .select('*')
      .single()

    if (error) throw error
    return data as Symptom
  },

  async update(id: string, updates: SymptomUpdateInput): Promise<Symptom> {
    const { data, error } = await supabase
      .from('symptoms')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as Symptom
  },

  async resolve(id: string): Promise<Symptom> {
    const { data, error } = await supabase
      .from('symptoms')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as Symptom
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('symptoms')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
