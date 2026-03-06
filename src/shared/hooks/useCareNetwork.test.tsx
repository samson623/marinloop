import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useCareNetwork } from '@/shared/hooks/useCareNetwork'
import { CareConnectionsService } from '@/shared/services/care-network'
import type { CareConnection } from '@/shared/types/care-types'

vi.mock('@/shared/services/care-network', () => ({
  CareConnectionsService: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({
      id: '1',
      caregiver_email: 'test@example.com',
      caregiver_name: 'Jane',
      relationship: 'spouse',
      status: 'pending',
      notify_on_miss: true,
      invite_token: 'tok',
      user_id: 'u1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    }),
    update: vi.fn().mockResolvedValue({}),
    revoke: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  // Also export other services as stubs so the module resolves correctly
  ProvidersService: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  EmergencyContactsService: {
    getAll: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/shared/stores/app-store', () => ({
  useAppStore: () => ({ toast: vi.fn() }),
}))

vi.mock('@/shared/lib/errors', () => ({
  handleMutationError: vi.fn(),
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

const makeConnection = (overrides: Partial<CareConnection> = {}): CareConnection => ({
  id: 'conn-1',
  user_id: 'user-1',
  caregiver_email: 'caregiver@example.com',
  caregiver_name: 'Jane Doe',
  relationship: 'spouse',
  status: 'pending',
  notify_on_miss: true,
  invite_token: 'token-abc',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

describe('useCareNetwork', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(CareConnectionsService.getAll).mockResolvedValue([])
  })

  it('returns empty connections initially', async () => {
    const { result } = renderHook(() => useCareNetwork(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.connections).toEqual([])
  })

  it('fetches connections on mount', async () => {
    const connections = [makeConnection(), makeConnection({ id: 'conn-2', caregiver_name: 'Bob' })]
    vi.mocked(CareConnectionsService.getAll).mockResolvedValue(connections)

    const { result } = renderHook(() => useCareNetwork(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(CareConnectionsService.getAll).toHaveBeenCalledOnce()
    expect(result.current.connections).toHaveLength(2)
    expect(result.current.connections[0].caregiver_name).toBe('Jane Doe')
    expect(result.current.connections[1].caregiver_name).toBe('Bob')
  })

  it('addConnection calls service', async () => {
    const created = makeConnection()
    vi.mocked(CareConnectionsService.create).mockResolvedValue(created)

    const { result } = renderHook(() => useCareNetwork(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addConnection({
        caregiver_email: 'caregiver@example.com',
        caregiver_name: 'Jane Doe',
        relationship: 'spouse',
        notify_on_miss: true,
      })
    })

    await waitFor(() => {
      expect(CareConnectionsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ caregiver_email: 'caregiver@example.com' }),
      )
    })
  })

  it('revokeConnection calls service', async () => {
    vi.mocked(CareConnectionsService.revoke).mockResolvedValue(undefined)

    const { result } = renderHook(() => useCareNetwork(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.revokeConnection('conn-42')
    })

    await waitFor(() => {
      expect(CareConnectionsService.revoke).toHaveBeenCalledWith('conn-42')
    })
  })

  it('deleteConnection calls service', async () => {
    vi.mocked(CareConnectionsService.delete).mockResolvedValue(undefined)

    const { result } = renderHook(() => useCareNetwork(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.deleteConnection('conn-99')
    })

    await waitFor(() => {
      expect(CareConnectionsService.delete).toHaveBeenCalledWith('conn-99')
    })
  })
})
