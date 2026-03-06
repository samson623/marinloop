import { supabase } from '@/shared/lib/supabase'
import type {
  CareConnection,
  CareConnectionCreateInput,
  EmergencyContact,
  Provider,
  ProviderCreateInput,
} from '@/shared/types/care-types'

// ---------------------------------------------------------------------------
// CareConnectionsService
// ---------------------------------------------------------------------------

export const CareConnectionsService = {
  async getAll(): Promise<CareConnection[]> {
    const { data, error } = await supabase
      .from('care_connections')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as CareConnection[]
  },

  async create(input: CareConnectionCreateInput): Promise<CareConnection> {
    const { data, error } = await supabase
      .from('care_connections')
      .insert(input)
      .select('*')
      .single()

    if (error) throw error
    return data as CareConnection
  },

  async update(
    id: string,
    updates: Partial<
      Pick<CareConnection, 'caregiver_name' | 'relationship' | 'notify_on_miss' | 'status'>
    >,
  ): Promise<CareConnection> {
    const { data, error } = await supabase
      .from('care_connections')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as CareConnection
  },

  async revoke(id: string): Promise<void> {
    const { error } = await supabase
      .from('care_connections')
      .update({ status: 'revoked' })
      .eq('id', id)

    if (error) throw error
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('care_connections')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async getInvitationsForMe(): Promise<CareConnection[]> {
    const { data, error } = await supabase
      .from('care_connections')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as CareConnection[]
  },
}

// ---------------------------------------------------------------------------
// ProvidersService
// ---------------------------------------------------------------------------

export const ProvidersService = {
  async getAll(): Promise<Provider[]> {
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .order('specialty')
      .order('name')

    if (error) throw error
    return data as Provider[]
  },

  async create(input: ProviderCreateInput): Promise<Provider> {
    const { data, error } = await supabase
      .from('providers')
      .insert(input)
      .select('*')
      .single()

    if (error) throw error
    return data as Provider
  },

  async update(id: string, updates: Partial<Provider>): Promise<Provider> {
    const { data, error } = await supabase
      .from('providers')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as Provider
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('providers')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}

// ---------------------------------------------------------------------------
// EmergencyContactsService
// (contacts stored as JSONB on the profiles table, field: emergency_contacts)
// ---------------------------------------------------------------------------

export const EmergencyContactsService = {
  async getAll(): Promise<EmergencyContact[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('emergency_contacts')
      .single()

    if (error) throw error
    return ((data?.emergency_contacts as unknown) as EmergencyContact[]) ?? []
  },

  async upsert(contacts: EmergencyContact[]): Promise<EmergencyContact[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('profiles')
      .update({ emergency_contacts: contacts as unknown as import('../types/database.types').Json })
      .eq('id', user.id)

    if (error) throw error
    return contacts
  },

  async add(contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> {
    const existing = await EmergencyContactsService.getAll()
    const newContact: EmergencyContact = { ...contact, id: crypto.randomUUID() }
    await EmergencyContactsService.upsert([...existing, newContact])
    return newContact
  },
}
