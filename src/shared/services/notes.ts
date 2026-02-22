import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'

type Note = Database['public']['Tables']['notes']['Row']
type NoteInsert = Database['public']['Tables']['notes']['Insert']

export const NotesService = {
  async getAll(): Promise<Note[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

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