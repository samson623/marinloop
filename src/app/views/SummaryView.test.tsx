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
import { useRefillPredictions } from '@/shared/hooks/useRefillPredictions'
import { useStreak } from '@/shared/hooks/useStreak'
import { useAdherenceInsights } from '@/shared/hooks/useAdherenceInsights'
import { useVitals } from '@/shared/hooks/useVitals'
import { useJournal } from '@/shared/hooks/useJournal'
import { renderWithProviders } from '@/test/utils'
import type { SchedItem } from '@/shared/stores/app-store'

// matchMedia not available in jsdom — stub it before any component renders
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

vi.mock('@/shared/hooks/useAdherenceHistory')
vi.mock('@/shared/hooks/useNotes')
vi.mock('@/shared/hooks/useTimeline')
vi.mock('@/shared/hooks/useMedications')
vi.mock('@/shared/hooks/useAppointments')
vi.mock('@/shared/stores/app-store')
vi.mock('@/shared/hooks/useRefillPredictions')
vi.mock('@/shared/hooks/useStreak')
vi.mock('@/shared/hooks/useAdherenceInsights')
vi.mock('@/shared/hooks/useVitals')
vi.mock('@/shared/hooks/useJournal')

// Stub portal-heavy / motion components
vi.mock('@/shared/components/QuickCaptureModal', () => ({ QuickCaptureModal: () => null }))
vi.mock('@/shared/components/ConfirmDeleteModal', () => ({ ConfirmDeleteModal: () => null }))
vi.mock('@/app/components/VitalEntryModal', () => ({ VitalEntryModal: () => null }))
vi.mock('@/app/components/JournalEntryModal', () => ({ JournalEntryModal: () => null }))

// recharts ResizeObserver / SVG not available in jsdom — swap for a minimal stub
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Card and Button pass-through stubs so children render
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
const mockUseRefillPredictions = vi.mocked(useRefillPredictions)
const mockUseStreak = vi.mocked(useStreak)
const mockUseAdherenceInsights = vi.mocked(useAdherenceInsights)
const mockUseVitals = vi.mocked(useVitals)
const mockUseJournal = vi.mocked(useJournal)

const baseAppStore = {
  showQuickCaptureModal: false,
  openQuickCaptureModal: vi.fn(),
  closeQuickCaptureModal: vi.fn(),
  openRemindersPanel: vi.fn(),
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
    mockUseRefillPredictions.mockReturnValue({ predictions: [], isLoading: false } as unknown as ReturnType<typeof useRefillPredictions>)
    mockUseStreak.mockReturnValue({ currentStreak: 0, longestStreak: 0, isLoading: false } as unknown as ReturnType<typeof useStreak>)
    mockUseAdherenceInsights.mockReturnValue({ insights: [], isLoading: false } as unknown as ReturnType<typeof useAdherenceInsights>)
    mockUseVitals.mockReturnValue({ vitals: [], isLoading: false, addVital: vi.fn(), isAdding: false } as unknown as ReturnType<typeof useVitals>)
    mockUseJournal.mockReturnValue({ entries: [], isLoading: false, addEntry: vi.fn(), isAdding: false } as unknown as ReturnType<typeof useJournal>)
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
    expect(screen.getByText('3')).toBeInTheDocument() // completed (done+late)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2) // late=1, missed=1
  })

  it('renders the sub-tab switcher with Adherence, Vitals, and Journal tabs', () => {
    renderWithProviders(<SummaryView />)

    expect(screen.getByRole('tab', { name: /Adherence/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Vitals/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Journal/i })).toBeInTheDocument()
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

  it('shows the 30-Day Adherence section heading', () => {
    renderWithProviders(<SummaryView />)

    expect(screen.getByText('30-Day Adherence')).toBeInTheDocument()
  })
})
