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
    update: vi.fn(),
    delete: vi.fn(),
  },
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
    expect(typeof result.current.updateNote).toBe('function')
    expect(typeof result.current.deleteNote).toBe('function')
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

  it('updateNote calls NotesService.update with id and content', async () => {
    const updated = { id: 'n1', content: 'updated text', medication_id: null, created_at: '', updated_at: '' } as never
    vi.mocked(NotesService.update).mockResolvedValue(updated)

    const { result } = renderHook(() => useNotes(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    result.current.updateNote({ id: 'n1', content: 'updated text' })

    await waitFor(() => {
      expect(NotesService.update).toHaveBeenCalledWith('n1', 'updated text')
    })
  })

  it('deleteNote calls NotesService.delete with correct id', async () => {
    vi.mocked(NotesService.delete).mockResolvedValue(undefined)

    const w = wrapper()
    const { result } = renderHook(() => useNotes(), { wrapper: w })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Trigger delete mutation
    await waitFor(() => {
      result.current.deleteNote('n1')
    })

    // Wait for mutation to complete
    await waitFor(() => {
      expect(vi.mocked(NotesService.delete)).toHaveBeenCalledWith('n1')
    })
  })
})

