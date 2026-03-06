import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'
import type { MedicationBundleCreateInput, MedicationCreateInput, MedicationUpdateInput } from '@/shared/types/contracts'

type Medication = Database['public']['Tables']['medications']['Row']

const RPC_TIMEOUT_MS = 30_000 // 30s max for RPC calls

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out. Please check your connection and try again.`)), ms)
    ),
  ])
}

export const MedsService = {
  async getAll(): Promise<Medication[]> {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .order('name')

    if (error) throw error
    return data
  },

  async create(med: MedicationCreateInput): Promise<Medication> {
    const { data, error } = await supabase
      .from('medications')
      .insert(med)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async createBundle(input: MedicationBundleCreateInput): Promise<string> {
    const scheduleTimes = input.schedules.map((s) => s.time)
    const scheduleDays = input.schedules[0]?.days ?? [0, 1, 2, 3, 4, 5, 6]

    const rpcPromise = Promise.resolve(supabase.rpc('create_medication_bundle', {
      medication_name: input.medication.name,
      medication_dosage: input.medication.dosage ?? null,
      medication_instructions: input.medication.instructions ?? null,
      medication_warnings: input.medication.warnings ?? null,
      medication_freq: input.medication.freq ?? 1,
      medication_color: input.medication.color ?? 'sky',
      medication_icon: input.medication.icon ?? null,
      medication_rxcui: input.medication.rxcui ?? null,
      schedule_times: scheduleTimes,
      schedule_days: scheduleDays,
      refill_current_quantity: input.refill.current_quantity ?? 0,
      refill_total_quantity: input.refill.total_quantity ?? 30,
      refill_date: input.refill.refill_date ?? null,
      refill_pharmacy: input.refill.pharmacy ?? null,
    }))

    const { data, error } = await withTimeout(rpcPromise, RPC_TIMEOUT_MS, 'Adding medication')

    if (error) throw error
    return data
  },

  async update(id: string, updates: MedicationUpdateInput): Promise<Medication> {
    const { data, error } = await supabase
      .from('medications')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}