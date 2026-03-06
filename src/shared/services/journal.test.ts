import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  single: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: mockSupabase }))

import { JournalService, type JournalEntry } from '@/shared/services/journal'

const mockEntry: JournalEntry = {
  id: 'j-1',
  user_id: 'u-1',
  title: 'Feeling better',
  content: 'Had a good day today.',
  mood: 4,
  tags: ['health', 'positive'],
  linked_medication_id: null,
  linked_appointment_id: null,
  entry_date: '2026-03-06',
  created_at: '2026-03-06T09:00:00Z',
  updated_at: '2026-03-06T09:00:00Z',
}

const mockEntry2: JournalEntry = {
  id: 'j-2',
  user_id: 'u-1',
  title: 'Tired',
  content: 'Did not sleep well.',
  mood: 2,
  tags: ['sleep'],
  linked_medication_id: null,
  linked_appointment_id: null,
  entry_date: '2026-03-05',
  created_at: '2026-03-05T22:00:00Z',
  updated_at: '2026-03-05T22:00:00Z',
}

describe('JournalService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default chaining behaviour for all methods.
    mockSupabase.from.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.insert.mockReturnThis()
    mockSupabase.update.mockReturnThis()
    mockSupabase.delete.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.order.mockReturnThis()
    mockSupabase.limit.mockReturnThis()
    mockSupabase.gte.mockReturnThis()
    mockSupabase.lte.mockReturnThis()
    mockSupabase.ilike.mockReturnThis()
  })

  describe('getAll()', () => {
    it('returns sorted journal entries', async () => {
      // getAll() chains .order() twice — the second call is the terminal awaitable.
      const mockItems = [mockEntry, mockEntry2]
      mockSupabase.order
        .mockReturnValueOnce(mockSupabase) // first .order('entry_date', ...) — keep chaining
        .mockResolvedValueOnce({ data: mockItems, error: null }) // second .order('created_at', ...) — terminal

      const result = await JournalService.getAll()

      expect(mockSupabase.from).toHaveBeenCalledWith('journal_entries')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.order).toHaveBeenNthCalledWith(1, 'entry_date', { ascending: false })
      expect(mockSupabase.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false })
      expect(result).toEqual(mockItems)
    })

    it('throws when Supabase returns an error', async () => {
      const dbError = new Error('DB error')
      mockSupabase.order
        .mockReturnValueOnce(mockSupabase)
        .mockResolvedValueOnce({ data: null, error: dbError })

      await expect(JournalService.getAll()).rejects.toThrow('DB error')
    })
  })

  describe('create()', () => {
    it('creates and returns a new journal entry', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockEntry, error: null })

      const input = {
        title: 'Feeling better',
        content: 'Had a good day today.',
        mood: 4 as number | null,
        tags: ['health', 'positive'],
        linked_medication_id: null,
        linked_appointment_id: null,
        entry_date: '2026-03-06',
      }

      const result = await JournalService.create(input)

      expect(mockSupabase.from).toHaveBeenCalledWith('journal_entries')
      expect(mockSupabase.insert).toHaveBeenCalledWith(input)
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.single).toHaveBeenCalled()
      expect(result).toEqual(mockEntry)
    })

    it('throws when Supabase returns an error', async () => {
      const dbError = new Error('Insert failed')
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(
        JournalService.create({
          title: 'Test',
          content: 'Content',
          mood: null,
          tags: [],
          linked_medication_id: null,
          linked_appointment_id: null,
          entry_date: '2026-03-06',
        }),
      ).rejects.toThrow('Insert failed')
    })
  })

  describe('getByMood()', () => {
    it('calls eq with the given mood value and returns matching entries', async () => {
      const moodEntries = [mockEntry]
      // getByMood() chains .eq() then .order() — order() is the terminal call.
      mockSupabase.order.mockResolvedValueOnce({ data: moodEntries, error: null })

      const result = await JournalService.getByMood(4)

      expect(mockSupabase.from).toHaveBeenCalledWith('journal_entries')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.eq).toHaveBeenCalledWith('mood', 4)
      expect(mockSupabase.order).toHaveBeenCalledWith('entry_date', { ascending: false })
      expect(result).toEqual(moodEntries)
    })
  })
})
