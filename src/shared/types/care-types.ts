export type CareConnectionStatus = 'pending' | 'accepted' | 'revoked'
export type ProviderSpecialty =
  | 'primary_care'
  | 'cardiologist'
  | 'pharmacist'
  | 'neurologist'
  | 'specialist'
  | 'other'
export type CareRelationship = 'spouse' | 'parent' | 'child' | 'friend' | 'nurse' | 'other'

export interface CareConnection {
  id: string
  user_id: string
  caregiver_email: string
  caregiver_name: string
  relationship: CareRelationship
  status: CareConnectionStatus
  notify_on_miss: boolean
  invite_token: string
  created_at: string
  updated_at: string
}

export interface CareConnectionCreateInput {
  caregiver_email: string
  caregiver_name: string
  relationship: CareRelationship
  notify_on_miss?: boolean
}

export interface Provider {
  id: string
  user_id: string
  name: string
  specialty: ProviderSpecialty
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProviderCreateInput {
  name: string
  specialty: ProviderSpecialty
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}

export interface EmergencyContact {
  id: string
  name: string
  relationship: string
  phone: string
  notes: string | null
}
