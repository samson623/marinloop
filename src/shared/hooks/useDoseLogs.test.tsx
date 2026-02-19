import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { DoseLogsService } from '@/shared/services/dose-logs'
import type { DoseLogCreateInput } from '@/shared/types/contracts'

vi.mock('@/shared/services/dose-logs', () => ({
  DoseLogsService: {
    getToday: vi.fn(),
    logDose: vi.fn(),
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

describe('useDoseLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(DoseLogsService.getToday).mockResolvedValue([])
  })

  it('exposes todayLogs and logDose', async () => {
    const { result } = renderHook(() => useDoseLogs(), {
      wrapper: wrapper(),
    })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.todayLogs).toEqual([])
    expect(typeof result.current.logDose).toBe('function')
  })

  it('logDose calls DoseLogsService.logDose with input', async () => {
    const inserted = { id: '1', medication_id: 'm1', schedule_id: 's1', taken_at: new Date().toISOString(), status: 'taken' as const, notes: null }
    vi.mocked(DoseLogsService.logDose).mockResolvedValue(inserted as never)

    const { result } = renderHook(() => useDoseLogs(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const input: DoseLogCreateInput = {
      medication_id: 'm1',
      schedule_id: 's1',
      taken_at: new Date().toISOString(),
      status: 'taken',
      notes: null,
    }
    result.current.logDose(input)

    await waitFor(() => {
      expect(DoseLogsService.logDose).toHaveBeenCalledWith(input)
    })
  })
})
