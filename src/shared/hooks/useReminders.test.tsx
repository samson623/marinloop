import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useReminders } from '@/shared/hooks/useReminders'
import { RemindersService, type ReminderCreateInput, type Reminder } from '@/shared/services/reminders'

vi.mock('@/shared/services/reminders', () => ({
  RemindersService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    snooze: vi.fn(),
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

const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
  id: 'rem-1',
  user_id: 'user-1',
  title: 'Take Aspirin',
  body: 'Time to take your medication',
  fire_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  fired: false,
  fired_at: null,
  created_at: new Date().toISOString(),
  ...overrides,
})

describe('useReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(RemindersService.getAll).mockResolvedValue([])
  })

  it('fetches and returns reminders array', async () => {
    const reminders = [makeReminder(), makeReminder({ id: 'rem-2', title: 'Take Metformin' })]
    vi.mocked(RemindersService.getAll).mockResolvedValue(reminders)

    const { result } = renderHook(() => useReminders(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(RemindersService.getAll).toHaveBeenCalledOnce()
    expect(result.current.reminders).toHaveLength(2)
    expect(result.current.reminders[0].title).toBe('Take Aspirin')
    expect(result.current.reminders[1].title).toBe('Take Metformin')
  })

  it('returns an empty array while data is loading', () => {
    // Never resolves during this check
    vi.mocked(RemindersService.getAll).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useReminders(), { wrapper: wrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.reminders).toEqual([])
  })

  it('addReminder mutation calls RemindersService.create and exposes the mutate function', async () => {
    const created = makeReminder()
    vi.mocked(RemindersService.create).mockResolvedValue(created)

    const { result } = renderHook(() => useReminders(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const input: ReminderCreateInput = {
      user_id: 'user-1',
      title: 'Take Aspirin',
      body: 'Time for your dose',
      fire_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    }

    act(() => {
      result.current.addReminder(input)
    })

    await waitFor(() => {
      expect(RemindersService.create).toHaveBeenCalledWith(input)
    })
  })

  it('deleteReminder mutation calls RemindersService.delete with the correct id', async () => {
    vi.mocked(RemindersService.delete).mockResolvedValue(undefined)

    const { result } = renderHook(() => useReminders(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.deleteReminder('rem-42')
    })

    await waitFor(() => {
      expect(RemindersService.delete).toHaveBeenCalledWith('rem-42', expect.anything())
    })
  })

  it('snoozeReminder mutation calls RemindersService.snooze with id and minutes', async () => {
    vi.mocked(RemindersService.snooze).mockResolvedValue('new-rem-id')

    const { result } = renderHook(() => useReminders(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.snoozeReminder({ id: 'rem-1', minutes: 15 })
    })

    await waitFor(() => {
      expect(RemindersService.snooze).toHaveBeenCalledWith('rem-1', 15)
    })
  })

  it('exposes addReminder, deleteReminder, snoozeReminder as functions', async () => {
    const { result } = renderHook(() => useReminders(), { wrapper: wrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(typeof result.current.addReminder).toBe('function')
    expect(typeof result.current.deleteReminder).toBe('function')
    expect(typeof result.current.snoozeReminder).toBe('function')
    expect(typeof result.current.updateReminder).toBe('function')
  })
})
