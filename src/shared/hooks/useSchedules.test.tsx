import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { SchedulesService } from '@/shared/services/schedules'
import type { ScheduleCreateInput } from '@/shared/types/contracts'

vi.mock('@/shared/services/schedules', () => ({
  SchedulesService: {
    getAll: vi.fn(),
    create: vi.fn(),
  },
}))
vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: () => ({ isDemo: false }),
}))
vi.mock('@/shared/stores/app-store', () => ({
  useAppStore: () => ({ toast: vi.fn() }),
}))

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(SchedulesService.getAll).mockResolvedValue([])
  })

  it('exposes scheds, addSched, and loading state', async () => {
    const { result } = renderHook(() => useSchedules(), {
      wrapper: wrapper(),
    })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.scheds).toEqual([])
    expect(typeof result.current.addSched).toBe('function')
  })

  it('addSched calls SchedulesService.create with input', async () => {
    const created = { id: 's1', medication_id: 'm1', time: '09:00', day_of_week: 1 } as never
    vi.mocked(SchedulesService.create).mockResolvedValue(created)

    const { result } = renderHook(() => useSchedules(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const input: ScheduleCreateInput = { medication_id: 'm1', time: '09:00', days: [1] }
    result.current.addSched(input)

    await waitFor(() => {
      expect(SchedulesService.create).toHaveBeenCalled()
      expect(vi.mocked(SchedulesService.create).mock.calls[0][0]).toEqual(input)
    })
  })
})
