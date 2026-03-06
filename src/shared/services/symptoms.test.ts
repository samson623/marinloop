import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  single: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: mockSupabase }))

import { SymptomsService, type Symptom } from '@/shared/services/symptoms'

const mockSymptom: Symptom = {
  id: 's-1',
  user_id: 'u-1',
  name: 'Headache',
  severity: 5,
  onset_at: '2026-03-06T08:00:00Z',
  resolved_at: null,
  linked_medication_id: null,
  notes: 'Mild, started in the morning',
  created_at: '2026-03-06T08:00:00Z',
  updated_at: '2026-03-06T08:00:00Z',
}

const mockSymptomResolved: Symptom = {
  ...mockSymptom,
  id: 's-2',
  name: 'Nausea',
  severity: 3,
  resolved_at: '2026-03-05T15:00:00Z',
}

describe('SymptomsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default chaining behaviour for all methods.
    mockSupabase.from.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.insert.mockReturnThis()
    mockSupabase.update.mockReturnThis()
    mockSupabase.delete.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.is.mockReturnThis()
    mockSupabase.order.mockReturnThis()
    mockSupabase.limit.mockReturnThis()
    mockSupabase.gte.mockReturnThis()
    mockSupabase.lte.mockReturnThis()
  })

  describe('getAll()', () => {
    it('returns a sorted symptoms array', async () => {
      const mockItems = [mockSymptom, mockSymptomResolved]
      mockSupabase.order.mockResolvedValueOnce({ data: mockItems, error: null })

      const result = await SymptomsService.getAll()

      expect(mockSupabase.from).toHaveBeenCalledWith('symptoms')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.order).toHaveBeenCalledWith('onset_at', { ascending: false })
      expect(result).toEqual(mockItems)
    })

    it('throws when Supabase returns an error', async () => {
      const dbError = new Error('DB error')
      mockSupabase.order.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(SymptomsService.getAll()).rejects.toThrow('DB error')
    })
  })

  describe('getActive()', () => {
    it('calls .is("resolved_at", null) and returns only unresolved symptoms', async () => {
      const activeItems = [mockSymptom]
      // getActive() chains .is() then .order() — order() is the terminal call.
      mockSupabase.order.mockResolvedValueOnce({ data: activeItems, error: null })

      const result = await SymptomsService.getActive()

      expect(mockSupabase.from).toHaveBeenCalledWith('symptoms')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.is).toHaveBeenCalledWith('resolved_at', null)
      expect(mockSupabase.order).toHaveBeenCalledWith('onset_at', { ascending: false })
      expect(result).toEqual(activeItems)
    })
  })

  describe('resolve()', () => {
    it('calls update with a resolved_at timestamp and returns the updated symptom', async () => {
      const resolvedSymptom: Symptom = { ...mockSymptom, resolved_at: '2026-03-06T12:00:00Z' }
      mockSupabase.single.mockResolvedValueOnce({ data: resolvedSymptom, error: null })

      const result = await SymptomsService.resolve('s-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('symptoms')
      // update() receives an object with a resolved_at string — verify the shape.
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ resolved_at: expect.any(String) }),
      )
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 's-1')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.single).toHaveBeenCalled()
      expect(result).toEqual(resolvedSymptom)
      expect(result.resolved_at).not.toBeNull()
    })

    it('throws when Supabase returns an error', async () => {
      const dbError = new Error('Update failed')
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(SymptomsService.resolve('s-1')).rejects.toThrow('Update failed')
    })
  })

  describe('create()', () => {
    it('creates and returns a new symptom', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockSymptom, error: null })

      const input = {
        name: 'Headache',
        severity: 5,
        onset_at: '2026-03-06T08:00:00Z',
        resolved_at: null,
        linked_medication_id: null,
        notes: 'Mild, started in the morning',
      }

      const result = await SymptomsService.create(input)

      expect(mockSupabase.from).toHaveBeenCalledWith('symptoms')
      expect(mockSupabase.insert).toHaveBeenCalledWith(input)
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.single).toHaveBeenCalled()
      expect(result).toEqual(mockSymptom)
    })

    it('throws when Supabase returns an error', async () => {
      const dbError = new Error('Insert failed')
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(
        SymptomsService.create({
          name: 'Dizziness',
          severity: 3,
          onset_at: '2026-03-06T08:00:00Z',
          resolved_at: null,
          linked_medication_id: null,
          notes: null,
        }),
      ).rejects.toThrow('Insert failed')
    })
  })
})
