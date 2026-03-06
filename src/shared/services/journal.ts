import { supabase } from '@/shared/lib/supabase'

export interface JournalEntry {
  id: string
  user_id: string
  title: string
  content: string
  mood: number | null    // 1-5
  tags: string[]
  linked_medication_id: string | null
  linked_appointment_id: string | null
  entry_date: string     // YYYY-MM-DD
  created_at: string
  updated_at: string
}

export type JournalEntryCreateInput = Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type JournalEntryUpdateInput = Partial<JournalEntryCreateInput>

export const JournalService = {
  async getAll(): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as JournalEntry[]
  },

  async getRecent(limit = 30): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data as JournalEntry[]
  },

  async getByDateRange(from: string, to: string): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as JournalEntry[]
  },

  async search(query: string): Promise<JournalEntry[]> {
    const [contentResult, titleResult] = await Promise.all([
      supabase
        .from('journal_entries')
        .select('*')
        .ilike('content', `%${query}%`),
      supabase
        .from('journal_entries')
        .select('*')
        .ilike('title', `%${query}%`),
    ])

    if (contentResult.error) throw contentResult.error
    if (titleResult.error) throw titleResult.error

    const seen = new Set<string>()
    const merged: JournalEntry[] = []

    for (const entry of [...(contentResult.data as JournalEntry[]), ...(titleResult.data as JournalEntry[])]) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id)
        merged.push(entry)
      }
    }

    return merged
  },

  async getByMood(mood: number): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('mood', mood)
      .order('entry_date', { ascending: false })

    if (error) throw error
    return data as JournalEntry[]
  },

  async create(input: JournalEntryCreateInput): Promise<JournalEntry> {
    const { data, error } = await supabase
      .from('journal_entries')
      .insert(input)
      .select('*')
      .single()

    if (error) throw error
    return data as JournalEntry
  },

  async update(id: string, updates: JournalEntryUpdateInput): Promise<JournalEntry> {
    const { data, error } = await supabase
      .from('journal_entries')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as JournalEntry
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
