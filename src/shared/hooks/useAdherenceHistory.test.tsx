import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { DoseLogsService } from '@/shared/services/dose-logs'

vi.mock('@/shared/services/dose-logs', () => ({
  DoseLogsService: {
    getAdherenceByDay: vi.fn(),
    getToday: vi.fn(),
    getForDate: vi.fn(),
    logDose: vi.fn(),
  },
}))

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(DoseLogsService.getAdherenceByDay).mockResolvedValue({})
})

describe('useAdherenceHistory()', () => {
  it('returns empty adherence object and isLoading=false on empty data', async () => {
    const { result } = renderHook(() => useAdherenceHistory(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.adherence).toEqual({})
  })

  it('uses the default 7-day window when no argument is provided', async () => {
    const { result } = renderHook(() => useAdherenceHistory(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(DoseLogsService.getAdherenceByDay).toHaveBeenCalledWith(7, null)
  })

  it('passes the 30-day window parameter to the service', async () => {
    const { result } = renderHook(() => useAdherenceHistory(30), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(DoseLogsService.getAdherenceByDay).toHaveBeenCalledWith(30, null)
  })

  it('returns the adherence record keyed by date string with t and d counts', async () => {
    const adherenceData: Record<string, { t: number; d: number }> = {
      '2026-03-06': { t: 3, d: 3 },
      '2026-03-05': { t: 3, d: 2 },
      '2026-03-04': { t: 3, d: 0 },
    }
    vi.mocked(DoseLogsService.getAdherenceByDay).mockResolvedValueOnce(adherenceData)

    const { result } = renderHook(() => useAdherenceHistory(7), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.adherence).toEqual(adherenceData)
    expect(result.current.adherence['2026-03-06']).toEqual({ t: 3, d: 3 })
    expect(result.current.adherence['2026-03-04']).toEqual({ t: 3, d: 0 })
  })

  it('indicates isLoading=true while the query is in flight', () => {
    vi.mocked(DoseLogsService.getAdherenceByDay).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useAdherenceHistory(), { wrapper: wrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.adherence).toEqual({})
  })

  it('returns empty adherence object and does not throw when the service rejects', async () => {
    vi.mocked(DoseLogsService.getAdherenceByDay).mockRejectedValueOnce(new Error('DB error'))

    const { result } = renderHook(() => useAdherenceHistory(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.adherence).toEqual({})
  })

  it('calls the service exactly once per render — respects React Query caching', async () => {
    const { result, rerender } = renderHook(() => useAdherenceHistory(7), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    rerender()

    expect(DoseLogsService.getAdherenceByDay).toHaveBeenCalledTimes(1)
  })
})
