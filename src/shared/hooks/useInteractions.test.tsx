import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useInteractions } from '@/shared/hooks/useInteractions'
import * as rxnorm from '@/shared/services/rxnorm'
import type { DrugInteraction } from '@/shared/services/rxnorm'

vi.mock('@/shared/services/rxnorm', () => ({
  lookupRxCUI: vi.fn(),
  getDrugInteractions: vi.fn(),
}))

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const warfarinMed = { id: 'med-w', name: 'Warfarin', rxcui: '11289' }
const aspirinMed = { id: 'med-a', name: 'Aspirin', rxcui: '1191' }

const bleedingInteraction: DrugInteraction = {
  severity: 'high',
  description: 'Concurrent use increases risk of bleeding.',
  drug1: 'warfarin',
  drug2: 'aspirin',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(rxnorm.lookupRxCUI).mockResolvedValue(null)
  vi.mocked(rxnorm.getDrugInteractions).mockResolvedValue([])
})

describe('useInteractions()', () => {
  it('returns empty interactions and isLoading=false for an empty medication list', async () => {
    const { result } = renderHook(() => useInteractions([]), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.interactions).toEqual([])
    expect(rxnorm.getDrugInteractions).not.toHaveBeenCalled()
  })

  it('returns empty interactions for a single medication', async () => {
    const { result } = renderHook(() => useInteractions([warfarinMed]), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.interactions).toEqual([])
    expect(rxnorm.getDrugInteractions).not.toHaveBeenCalled()
  })

  it('uses stored rxcui values directly without calling lookupRxCUI', async () => {
    vi.mocked(rxnorm.getDrugInteractions).mockResolvedValueOnce([bleedingInteraction])

    const { result } = renderHook(
      () => useInteractions([warfarinMed, aspirinMed]),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(rxnorm.lookupRxCUI).not.toHaveBeenCalled()
    expect(rxnorm.getDrugInteractions).toHaveBeenCalledWith(
      expect.arrayContaining(['11289', '1191']),
    )
    expect(result.current.interactions).toHaveLength(1)
    expect(result.current.interactions[0].severity).toBe('high')
  })

  it('resolves RxCUI by name when rxcui is not stored on the medication', async () => {
    const medWithoutRxcui = { id: 'med-m', name: 'Metformin', rxcui: null }
    vi.mocked(rxnorm.lookupRxCUI).mockResolvedValueOnce('6809')
    vi.mocked(rxnorm.getDrugInteractions).mockResolvedValueOnce([])

    const { result } = renderHook(
      () => useInteractions([warfarinMed, medWithoutRxcui]),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(rxnorm.lookupRxCUI).toHaveBeenCalledWith('Metformin')
  })

  it('includes the newMedName in the interaction check when provided', async () => {
    vi.mocked(rxnorm.lookupRxCUI).mockResolvedValueOnce('6809')
    vi.mocked(rxnorm.getDrugInteractions).mockResolvedValueOnce([])

    const { result } = renderHook(
      () => useInteractions([warfarinMed], 'Metformin'),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(rxnorm.lookupRxCUI).toHaveBeenCalledWith('Metformin')
  })

  it('does not include newMedName shorter than 3 chars — avoids premature lookups during typing', async () => {
    const { result } = renderHook(
      () => useInteractions([warfarinMed, aspirinMed], 'Me'),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(rxnorm.lookupRxCUI).not.toHaveBeenCalled()
  })

  it('returns empty array and does not throw when getDrugInteractions fails', async () => {
    vi.mocked(rxnorm.getDrugInteractions).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(
      () => useInteractions([warfarinMed, aspirinMed]),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.interactions).toEqual([])
  })

  it('returns interactions array with correct shape when an interaction is found', async () => {
    vi.mocked(rxnorm.getDrugInteractions).mockResolvedValueOnce([bleedingInteraction])

    const { result } = renderHook(
      () => useInteractions([warfarinMed, aspirinMed]),
      { wrapper: wrapper() },
    )

    await waitFor(() => {
      expect(result.current.interactions).toHaveLength(1)
    })

    const interaction = result.current.interactions[0]
    expect(interaction).toMatchObject({
      severity: 'high',
      description: expect.any(String),
      drug1: expect.any(String),
      drug2: expect.any(String),
    })
  })
})
