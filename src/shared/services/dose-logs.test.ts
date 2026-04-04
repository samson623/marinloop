import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: mockSupabase }))

import { DoseLogsService } from '@/shared/services/dose-logs'
import type { DoseLogCreateInput } from '@/shared/types/contracts'

const makeDoseLog = (overrides: Record<string, unknown> = {}) => ({
  id: 'dose-1',
  user_id: 'user-1',
  medication_id: 'med-1',
  schedule_id: 'sched-1',
  taken_at: '2026-04-04T12:00:00.000Z',
  status: 'taken',
  notes: null,
  profile_id: null,
  ...overrides,
})

const makeRefill = (overrides: Record<string, unknown> = {}) => ({
  id: 'refill-1',
  user_id: 'user-1',
  medication_id: 'med-1',
  current_quantity: 12,
  total_quantity: 30,
  refill_date: null,
  pharmacy: null,
  profile_id: null,
  ...overrides,
})

function createInsertChain(result: unknown) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
}

function createRefillSelectChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
}

function createRefillUpdateChain(result: unknown) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
  }
}

describe('DoseLogsService.logDose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('decrements refill supply when a dose is taken', async () => {
    const doseLog = makeDoseLog()
    const refill = makeRefill({ current_quantity: 12 })
    const insertChain = createInsertChain({ data: doseLog, error: null })
    const refillSelectChain = createRefillSelectChain({ data: refill, error: null })
    const refillUpdateChain = createRefillUpdateChain({ data: null, error: null })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'dose_logs') return insertChain
      if (table === 'refills' && refillSelectChain.select.mock.calls.length === 0) return refillSelectChain
      if (table === 'refills') return refillUpdateChain
      throw new Error(`Unexpected table ${table}`)
    })

    const input: DoseLogCreateInput = {
      medication_id: 'med-1',
      schedule_id: 'sched-1',
      taken_at: '2026-04-04T12:00:00.000Z',
      status: 'taken',
      notes: null,
    }

    const result = await DoseLogsService.logDose(input)

    expect(result).toEqual(doseLog)
    expect(refillSelectChain.eq).toHaveBeenCalledWith('medication_id', 'med-1')
    expect(refillUpdateChain.update).toHaveBeenCalledWith({ current_quantity: 11 })
    expect(refillUpdateChain.eq).toHaveBeenCalledWith('id', 'refill-1')
  })

  it('does not touch refill supply for missed doses', async () => {
    const insertChain = createInsertChain({ data: makeDoseLog({ status: 'missed' }), error: null })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'dose_logs') return insertChain
      throw new Error(`Unexpected table ${table}`)
    })

    await DoseLogsService.logDose({
      medication_id: 'med-1',
      schedule_id: 'sched-1',
      taken_at: '2026-04-04T12:00:00.000Z',
      status: 'missed',
      notes: null,
    })

    expect(mockSupabase.from).toHaveBeenCalledTimes(1)
    expect(mockSupabase.from).toHaveBeenCalledWith('dose_logs')
  })

  it('does not decrement below zero', async () => {
    const doseLog = makeDoseLog()
    const refill = makeRefill({ current_quantity: 0 })
    const insertChain = createInsertChain({ data: doseLog, error: null })
    const refillSelectChain = createRefillSelectChain({ data: refill, error: null })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'dose_logs') return insertChain
      if (table === 'refills') return refillSelectChain
      throw new Error(`Unexpected table ${table}`)
    })

    await DoseLogsService.logDose({
      medication_id: 'med-1',
      schedule_id: 'sched-1',
      taken_at: '2026-04-04T12:00:00.000Z',
      status: 'taken',
      notes: null,
    })

    expect(refillSelectChain.eq).toHaveBeenCalledWith('medication_id', 'med-1')
    expect(mockSupabase.from).toHaveBeenCalledTimes(2)
  })
})
