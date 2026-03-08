import { supabase } from '@/shared/lib/supabase'

export interface MedLookupResult {
  name: string
  dosage: string
  instructions: string
  warnings: string
}

export interface OpenFDALabelData {
  foodInteractions?: string
  contraindications?: string
}

export async function lookupByBarcode(barcode: string): Promise<MedLookupResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('drug-reference', {
      body: { action: 'lookupByBarcode', params: { barcode } },
    })
    if (error || !data) return null
    return data as MedLookupResult
  } catch {
    return null
  }
}
