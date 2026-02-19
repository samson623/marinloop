import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useNotes } from '@/shared/hooks/useNotes'
import { NotesService } from '@/shared/services/notes'

vi.mock('@/shared/services/notes', () => ({
  NotesService: {
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

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(NotesService.getAll).mockResolvedValue([])
  })

  it('exposes notes, addNote, and loading state', async () => {
    const { result } = renderHook(() => useNotes(), {
      wrapper: wrapper(),
    })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.notes).toEqual([])
    expect(typeof result.current.addNote).toBe('function')
  })

  it('addNote calls NotesService.create with content and medication_id', async () => {
    const created = { id: 'n1', content: 'test', medication_id: null, created_at: '' } as never
    vi.mocked(NotesService.create).mockResolvedValue(created)

    const { result } = renderHook(() => useNotes(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    result.current.addNote({ content: 'felt fine', medication_id: null })

    await waitFor(() => {
      expect(NotesService.create).toHaveBeenCalled()
      expect(vi.mocked(NotesService.create).mock.calls[0][0]).toEqual({ content: 'felt fine', medication_id: null })
    })
  })
})
