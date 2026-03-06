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
  single: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: mockSupabase }))

import { VitalsService, type Vital } from '@/shared/services/vitals'

const mockVital: Vital = {
  id: 'v-1',
  user_id: 'u-1',
  recorded_at: '2026-03-06T10:00:00Z',
  bp_systolic: 120,
  bp_diastolic: 80,
  heart_rate: 72,
  glucose: null,
  weight: null,
  temperature: null,
  o2_saturation: 98,
  notes: null,
  created_at: '2026-03-06T10:00:00Z',
}

const mockVital2: Vital = {
  id: 'v-2',
  user_id: 'u-1',
  recorded_at: '2026-03-05T10:00:00Z',
  bp_systolic: 118,
  bp_diastolic: 78,
  heart_rate: 70,
  glucose: null,
  weight: null,
  temperature: null,
  o2_saturation: 97,
  notes: 'After exercise',
  created_at: '2026-03-05T10:00:00Z',
}

describe('VitalsService', () => {
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
  })

  describe('getAll()', () => {
    it('returns a sorted vitals array', async () => {
      const mockItems = [mockVital, mockVital2]
      mockSupabase.order.mockResolvedValueOnce({ data: mockItems, error: null })

      const result = await VitalsService.getAll()

      expect(mockSupabase.from).toHaveBeenCalledWith('vitals')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.order).toHaveBeenCalledWith('recorded_at', { ascending: false })
      expect(result).toEqual(mockItems)
    })

    it('throws when Supabase returns an error', async () => {
      const dbError = new Error('DB error')
      mockSupabase.order.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(VitalsService.getAll()).rejects.toThrow('DB error')
    })
  })

  describe('getRecent()', () => {
    it('passes the provided limit to the query', async () => {
      const mockItems = [mockVital]
      mockSupabase.limit.mockResolvedValueOnce({ data: mockItems, error: null })

      const result = await VitalsService.getRecent(5)

      expect(mockSupabase.from).toHaveBeenCalledWith('vitals')
      expect(mockSupabase.order).toHaveBeenCalledWith('recorded_at', { ascending: false })
      expect(mockSupabase.limit).toHaveBeenCalledWith(5)
      expect(result).toEqual(mockItems)
    })
  })

  describe('create()', () => {
    it('calls insert+select+single and returns the created vital', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockVital, error: null })

      const input = {
        recorded_at: '2026-03-06T10:00:00Z',
        bp_systolic: 120,
        bp_diastolic: 80,
        heart_rate: 72,
        glucose: null,
        weight: null,
        temperature: null,
        o2_saturation: 98,
        notes: null,
      }

      const result = await VitalsService.create(input)

      expect(mockSupabase.from).toHaveBeenCalledWith('vitals')
      expect(mockSupabase.insert).toHaveBeenCalledWith(input)
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.single).toHaveBeenCalled()
      expect(result).toEqual(mockVital)
    })

    it('throws when Supabase returns an error', async () => {
      const dbError = new Error('Insert failed')
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(
        VitalsService.create({
          recorded_at: '2026-03-06T10:00:00Z',
          bp_systolic: 120,
          bp_diastolic: 80,
          heart_rate: 72,
          glucose: null,
          weight: null,
          temperature: null,
          o2_saturation: 98,
          notes: null,
        }),
      ).rejects.toThrow('Insert failed')
    })
  })

  describe('delete()', () => {
    it('calls delete+eq and resolves without a value on success', async () => {
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null })

      await expect(VitalsService.delete('v-1')).resolves.toBeUndefined()

      expect(mockSupabase.from).toHaveBeenCalledWith('vitals')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'v-1')
    })

    it('throws when Supabase returns an error', async () => {
      const dbError = new Error('Delete failed')
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(VitalsService.delete('v-1')).rejects.toThrow('Delete failed')
    })
  })
})
