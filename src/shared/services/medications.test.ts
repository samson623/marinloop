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
  single: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: mockSupabase }))

import { MedsService } from '@/shared/services/medications'
import type { MedicationBundleCreateInput } from '@/shared/types/contracts'

const makeMed = (overrides: Record<string, unknown> = {}) => ({
  id: 'med-1',
  user_id: 'user-1',
  name: 'Metformin',
  dosage: '500 mg',
  instructions: 'Take with food',
  warnings: 'Monitor kidneys',
  freq: 2,
  color: 'sky',
  icon: null,
  barcode: null,
  rxcui: '6809',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const bundleInput: MedicationBundleCreateInput = {
  medication: {
    name: 'Metformin',
    dosage: '500 mg',
    instructions: 'Take with food',
    warnings: null,
    freq: 2,
    color: 'sky',
    icon: null,
    rxcui: '6809',
  },
  schedules: [
    { time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], food_context_minutes: undefined, active: true },
    { time: '20:00', days: [0, 1, 2, 3, 4, 5, 6], food_context_minutes: undefined, active: true },
  ],
  refill: {
    current_quantity: 60,
    total_quantity: 90,
    refill_date: '2026-04-01',
    pharmacy: 'CVS',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.from.mockReturnThis()
  mockSupabase.select.mockReturnThis()
  mockSupabase.insert.mockReturnThis()
  mockSupabase.update.mockReturnThis()
  mockSupabase.delete.mockReturnThis()
  mockSupabase.eq.mockReturnThis()
  mockSupabase.is.mockReturnThis()
  mockSupabase.order.mockReturnThis()
})

describe('MedsService', () => {
  describe('getAll()', () => {
    it('queries medications table ordered by name', async () => {
      const meds = [makeMed(), makeMed({ id: 'med-2', name: 'Aspirin' })]
      mockSupabase.order.mockResolvedValueOnce({ data: meds, error: null })

      const result = await MedsService.getAll()

      expect(mockSupabase.from).toHaveBeenCalledWith('medications')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.order).toHaveBeenCalledWith('name')
      expect(result).toEqual(meds)
    })

    it('propagates DB errors', async () => {
      const dbError = new Error('permission denied for table medications')
      mockSupabase.order.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(MedsService.getAll()).rejects.toThrow('permission denied')
    })
  })

  describe('create()', () => {
    it('inserts a medication row and returns the created record', async () => {
      const med = makeMed()
      mockSupabase.single.mockResolvedValueOnce({ data: med, error: null })

      const result = await MedsService.create({
        name: 'Metformin',
        dosage: '500 mg',
        instructions: 'Take with food',
        warnings: null,
        freq: 2,
        color: 'sky',
        icon: null,
        rxcui: '6809',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('medications')
      expect(mockSupabase.insert).toHaveBeenCalled()
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.single).toHaveBeenCalled()
      expect(result).toEqual(med)
    })

    it('throws when insert returns a DB error', async () => {
      const dbError = new Error('unique constraint violation')
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(
        MedsService.create({
          name: 'Metformin',
          dosage: null,
          instructions: null,
          warnings: null,
          freq: 1,
          color: 'sky',
          icon: null,
          rxcui: null,
        }),
      ).rejects.toThrow('unique constraint violation')
    })
  })

  describe('createBundle()', () => {
    it('calls create_medication_bundle RPC with all required fields', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: 'new-med-id', error: null })

      const result = await MedsService.createBundle(bundleInput)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'create_medication_bundle',
        expect.objectContaining({
          medication_name: 'Metformin',
          medication_dosage: '500 mg',
          medication_freq: 2,
          medication_color: 'sky',
          medication_rxcui: '6809',
          schedule_times: ['08:00', '20:00'],
          schedule_days: [0, 1, 2, 3, 4, 5, 6],
          refill_current_quantity: 60,
          refill_total_quantity: 90,
          refill_date: '2026-04-01',
          refill_pharmacy: 'CVS',
        }),
      )
      expect(result).toBe('new-med-id')
    })

    it('defaults null refill quantities to 0 and 30 when omitted', async () => {
      const minimalInput: MedicationBundleCreateInput = {
        medication: {
          name: 'Aspirin',
          dosage: null,
          instructions: null,
          warnings: null,
          freq: 1,
          color: 'sky',
          icon: null,
          rxcui: null,
        },
        schedules: [{ time: '09:00', days: [1, 2, 3, 4, 5], food_context_minutes: undefined, active: true }],
        refill: { current_quantity: undefined, total_quantity: undefined, refill_date: null, pharmacy: null },
      }
      mockSupabase.rpc.mockResolvedValueOnce({ data: 'new-id', error: null })

      await MedsService.createBundle(minimalInput)

      const callArgs = mockSupabase.rpc.mock.calls[0][1] as Record<string, unknown>
      expect(callArgs.refill_current_quantity).toBe(0)
      expect(callArgs.refill_total_quantity).toBe(30)
    })

    it('falls back to all-days [0-6] when schedules[0].days is absent', async () => {
      const inputNoDays = {
        medication: {
          name: 'Drug',
          dosage: null,
          instructions: null,
          warnings: null,
          freq: 1,
          color: 'sky',
          icon: null,
          rxcui: null,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schedules: [{ time: '08:00', food_context_minutes: null, active: true } as any],
        refill: { current_quantity: 10, total_quantity: 30, refill_date: null, pharmacy: null },
      }
      mockSupabase.rpc.mockResolvedValueOnce({ data: 'id', error: null })

      await MedsService.createBundle(inputNoDays)

      const callArgs = mockSupabase.rpc.mock.calls[0][1] as Record<string, unknown>
      expect(callArgs.schedule_days).toEqual([0, 1, 2, 3, 4, 5, 6])
    })

    it('throws an RPC error so the add-med modal can surface it', async () => {
      const rpcError = new Error('DB constraint violated')
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: rpcError })

      await expect(MedsService.createBundle(bundleInput)).rejects.toThrow('DB constraint violated')
    })
  })

  describe('update()', () => {
    it('updates the correct row by id and returns the updated medication', async () => {
      const updated = makeMed({ dosage: '1000 mg' })
      mockSupabase.single.mockResolvedValueOnce({ data: updated, error: null })

      const result = await MedsService.update('med-1', { dosage: '1000 mg' })

      expect(mockSupabase.from).toHaveBeenCalledWith('medications')
      expect(mockSupabase.update).toHaveBeenCalledWith({ dosage: '1000 mg' })
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'med-1')
      expect(result.dosage).toBe('1000 mg')
    })

    it('throws when update fails', async () => {
      const dbError = new Error('row not found')
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(MedsService.update('med-999', { dosage: '500 mg' })).rejects.toThrow('row not found')
    })
  })

  describe('delete()', () => {
    it('deletes the correct medication row by id', async () => {
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: null })

      await expect(MedsService.delete('med-1')).resolves.toBeUndefined()

      expect(mockSupabase.from).toHaveBeenCalledWith('medications')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'med-1')
    })

    it('throws on DB error', async () => {
      const dbError = new Error('foreign key constraint violation')
      mockSupabase.eq.mockResolvedValueOnce({ data: null, error: dbError })

      await expect(MedsService.delete('med-1')).rejects.toThrow('foreign key constraint')
    })
  })
})
