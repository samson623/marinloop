import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'

type Note = Database['public']['Tables']['notes']['Row']
type NoteInsert = Database['public']['Tables']['notes']['Insert']

export const NotesService = {
  async getAll(profileId?: string | null): Promise<Note[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

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

  async create(note: Pick<NoteInsert, 'content' | 'medication_id' | 'appointment_id'>): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .insert(note)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, content: string): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .update({ content })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}