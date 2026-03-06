import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import React from 'react'
import { TimelineView } from '@/app/views/TimelineView'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useAppStore } from '@/shared/stores/app-store'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { renderWithProviders } from '@/test/utils'
import type { SchedItem } from '@/shared/stores/app-store'

vi.mock('@/shared/hooks/useTimeline')
vi.mock('@/shared/hooks/useDoseLogs')
vi.mock('@/shared/stores/app-store')

// Modal sub-component imports other hooks; stub out the Modal to avoid deep deps
vi.mock('@/shared/components/Modal', () => ({
  Modal: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}))

const mockUseTimeline = vi.mocked(useTimeline)
const mockUseAppStore = vi.mocked(useAppStore)
const mockUseDoseLogs = vi.mocked(useDoseLogs)

const baseAppStore = {
  buildSched: vi.fn(),
  toast: vi.fn(),
}

const baseUseDoseLogs = {
  todayLogs: [],
  logDose: vi.fn(),
  isLoading: false,
}

const makeMedItem = (overrides: Partial<SchedItem> = {}): SchedItem => ({
  id: 'sched-1',
  type: 'med',
  medicationId: 'med-1',
  name: 'Aspirin',
  dose: '100mg',
  time: '08:00',
  timeMinutes: 480,
  instructions: 'Take with water',
  status: 'pending',
  actualTime: null,
  ...overrides,
})

describe('TimelineView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAppStore.mockReturnValue(baseAppStore as ReturnType<typeof useAppStore>)
    mockUseDoseLogs.mockReturnValue(baseUseDoseLogs as ReturnType<typeof useDoseLogs>)
  })

  it('shows empty state message when timeline has no items', () => {
    mockUseTimeline.mockReturnValue({ timeline: [], isLoading: false, error: null, refetch: vi.fn() })

    renderWithProviders(<TimelineView />)

    expect(screen.getByText('No items for today')).toBeInTheDocument()
  })

  it('renders medication names when timeline has items', () => {
    const items: SchedItem[] = [
      makeMedItem({ id: 'sched-1', name: 'Aspirin', status: 'done' }),
      makeMedItem({ id: 'sched-2', medicationId: 'med-2', name: 'Metformin', status: 'pending' }),
    ]
    mockUseTimeline.mockReturnValue({ timeline: items, isLoading: false, error: null, refetch: vi.fn() })

    renderWithProviders(<TimelineView />)

    expect(screen.getByText('Aspirin')).toBeInTheDocument()
    expect(screen.getByText('Metformin')).toBeInTheDocument()
  })

  it('renders the adherence ring SVG with correct aria-label', () => {
    const items: SchedItem[] = [
      makeMedItem({ id: 'sched-1', name: 'Aspirin', status: 'done' }),
      makeMedItem({ id: 'sched-2', name: 'Metformin', status: 'missed' }),
    ]
    mockUseTimeline.mockReturnValue({ timeline: items, isLoading: false, error: null, refetch: vi.fn() })

    renderWithProviders(<TimelineView />)

    // Ring is rendered as an img role with the adherence label
    const ring = screen.getByRole('img', { name: /Adherence/ })
    expect(ring).toBeInTheDocument()
  })

  it('displays status pills (Done / Late / Missed) when items exist', () => {
    const items: SchedItem[] = [
      makeMedItem({ id: 's1', name: 'Drug A', status: 'done' }),
      makeMedItem({ id: 's2', name: 'Drug B', status: 'late' }),
      makeMedItem({ id: 's3', name: 'Drug C', status: 'missed' }),
    ]
    mockUseTimeline.mockReturnValue({ timeline: items, isLoading: false, error: null, refetch: vi.fn() })

    renderWithProviders(<TimelineView />)

    // Pills are rendered as text inside <Pill> spans
    expect(screen.getAllByText(/Done/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Late/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Missed/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows 0% adherence when all items are pending', () => {
    const items: SchedItem[] = [
      makeMedItem({ id: 's1', name: 'Drug A', status: 'pending' }),
    ]
    mockUseTimeline.mockReturnValue({ timeline: items, isLoading: false, error: null, refetch: vi.fn() })

    renderWithProviders(<TimelineView />)

    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('shows 100% adherence when all items are done', () => {
    const items: SchedItem[] = [
      makeMedItem({ id: 's1', name: 'Drug A', status: 'done' }),
      makeMedItem({ id: 's2', name: 'Drug B', status: 'done' }),
    ]
    mockUseTimeline.mockReturnValue({ timeline: items, isLoading: false, error: null, refetch: vi.fn() })

    renderWithProviders(<TimelineView />)

    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
