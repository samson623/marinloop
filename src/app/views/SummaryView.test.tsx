import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import React from 'react'
import { SummaryView } from '@/app/views/SummaryView'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { useNotes } from '@/shared/hooks/useNotes'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useMedications } from '@/shared/hooks/useMedications'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useAppStore } from '@/shared/stores/app-store'
import { renderWithProviders } from '@/test/utils'
import type { SchedItem } from '@/shared/stores/app-store'

vi.mock('@/shared/hooks/useAdherenceHistory')
vi.mock('@/shared/hooks/useNotes')
vi.mock('@/shared/hooks/useTimeline')
vi.mock('@/shared/hooks/useMedications')
vi.mock('@/shared/hooks/useAppointments')
vi.mock('@/shared/stores/app-store')

// Stub portal-heavy components
vi.mock('@/shared/components/QuickCaptureModal', () => ({
  QuickCaptureModal: () => null,
}))
vi.mock('@/shared/components/ConfirmDeleteModal', () => ({
  ConfirmDeleteModal: () => null,
}))
// Card component is a simple wrapper — use a pass-through stub so children render
vi.mock('@/shared/components/ui', async () => {
  const actual = await vi.importActual<typeof import('@/shared/components/ui')>('@/shared/components/ui')
  return {
    ...actual,
    Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    Button: ({ children, onClick, type }: { children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit' | 'reset' }) => (
      <button type={type ?? 'button'} onClick={onClick}>{children}</button>
    ),
  }
})

const mockUseAdherenceHistory = vi.mocked(useAdherenceHistory)
const mockUseNotes = vi.mocked(useNotes)
const mockUseTimeline = vi.mocked(useTimeline)
const mockUseMedications = vi.mocked(useMedications)
const mockUseAppointments = vi.mocked(useAppointments)
const mockUseAppStore = vi.mocked(useAppStore)

const baseAppStore = {
  showQuickCaptureModal: false,
  openQuickCaptureModal: vi.fn(),
  closeQuickCaptureModal: vi.fn(),
  toast: vi.fn(),
}

const baseNotes = {
  notes: [],
  isLoading: false,
  addNote: vi.fn(),
  isAdding: false,
  updateNote: vi.fn(),
  isUpdating: false,
  deleteNote: vi.fn(),
  isDeleting: false,
}

const makeMedItem = (overrides: Partial<SchedItem> = {}): SchedItem => ({
  id: 'sched-1',
  type: 'med',
  medicationId: 'med-1',
  name: 'Aspirin',
  time: '08:00',
  timeMinutes: 480,
  instructions: '',
  status: 'done',
  actualTime: null,
  ...overrides,
})

describe('SummaryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAppStore.mockReturnValue(baseAppStore as ReturnType<typeof useAppStore>)
    mockUseAdherenceHistory.mockReturnValue({ adherence: {}, isLoading: false })
    mockUseNotes.mockReturnValue(baseNotes as ReturnType<typeof useNotes>)
    mockUseTimeline.mockReturnValue({ timeline: [], isLoading: false, error: null, refetch: vi.fn() })
    mockUseMedications.mockReturnValue({ meds: [], isLoading: false } as unknown as ReturnType<typeof useMedications>)
    mockUseAppointments.mockReturnValue({ appts: [], isLoading: false } as unknown as ReturnType<typeof useAppointments>)
  })

  it('renders all three stat cards (Completed, Late, Missed)', () => {
    renderWithProviders(<SummaryView />)

    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.getByText('Missed')).toBeInTheDocument()
  })

  it('displays correct completed/late/missed counts from timeline data', () => {
    const timeline: SchedItem[] = [
      makeMedItem({ id: 's1', status: 'done' }),
      makeMedItem({ id: 's2', status: 'done' }),
      makeMedItem({ id: 's3', status: 'late' }),
      makeMedItem({ id: 's4', status: 'missed' }),
    ]
    mockUseTimeline.mockReturnValue({ timeline, isLoading: false, error: null, refetch: vi.fn() })

    renderWithProviders(<SummaryView />)

    // done(2) + late(1) → completed=3, late=1, missed=1
    // We have at least the numeric values in the DOM
    expect(screen.getByText('3')).toBeInTheDocument() // completed (done+late)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2) // late=1, missed=1
  })

  it('renders the 7-day adherence chart with day labels', () => {
    renderWithProviders(<SummaryView />)

    // The chart always renders 7 day labels: S M T W T F S
    const dayLabels = screen.getAllByText(/^[SMTWTFS]$/)
    expect(dayLabels.length).toBe(7)
  })

  it('renders notes when they exist', () => {
    const notes = [
      {
        id: 'note-1',
        content: 'Feeling dizzy after Aspirin',
        medication_id: null,
        appointment_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'user-1',
      },
    ]
    mockUseNotes.mockReturnValue({ ...baseNotes, notes } as unknown as ReturnType<typeof useNotes>)

    renderWithProviders(<SummaryView />)

    expect(screen.getByText('Feeling dizzy after Aspirin')).toBeInTheDocument()
  })

  it('renders empty notes placeholder when no notes exist', () => {
    mockUseNotes.mockReturnValue(baseNotes as ReturnType<typeof useNotes>)

    renderWithProviders(<SummaryView />)

    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('shows the 7-Day Adherence section heading', () => {
    renderWithProviders(<SummaryView />)

    expect(screen.getByText('7-Day Adherence')).toBeInTheDocument()
  })
})
