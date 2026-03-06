import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { MedsView } from '@/app/views/MedsView'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { useRefills } from '@/shared/hooks/useRefillsList'
import { useAppStore } from '@/shared/stores/app-store'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/shared/hooks/useMedications')
vi.mock('@/shared/hooks/useSchedules')
vi.mock('@/shared/hooks/useRefillsList')
vi.mock('@/shared/stores/app-store')

// Stub complex child modals so we don't need to resolve their deep dependencies
vi.mock('@/app/views/MedDetailModal', () => ({
  default: () => <div data-testid="med-detail-modal" />,
}))
vi.mock('@/app/views/AddMedModal', () => ({
  default: () => <div data-testid="add-med-modal" />,
}))
vi.mock('@/shared/lib/medication-utils', () => ({
  getSupplyInfo: (_supply: number, _total: number, _dpd: number) => ({
    pct: 60,
    days: 10,
    color: 'green',
  }),
}))

const mockUseMedications = vi.mocked(useMedications)
const mockUseSchedules = vi.mocked(useSchedules)
const mockUseRefills = vi.mocked(useRefills)
const mockUseAppStore = vi.mocked(useAppStore)

const baseAppStore = {
  showAddMedModal: false,
  draftMed: null,
  addMedModalOptions: null,
  openAddMedModal: vi.fn(),
  closeAddMedModal: vi.fn(),
  toast: vi.fn(),
}

const baseMedications = {
  meds: [],
  isLoading: false,
  error: null,
  addMed: vi.fn(),
  addMedBundle: vi.fn(),
  addMedBundleAsync: vi.fn(),
  updateMed: vi.fn(),
  deleteMed: vi.fn(),
  isAdding: false,
  isUpdating: false,
  isDeleting: false,
}

const baseSchedules = {
  scheds: [],
  isLoading: false,
  addSched: vi.fn(),
  addSchedAsync: vi.fn(),
  updateSched: vi.fn(),
  deleteSched: vi.fn(),
}

const baseRefills = {
  refills: [],
  isLoading: false,
  upsertRefill: vi.fn(),
  updateRefill: vi.fn(),
  deleteRefill: vi.fn(),
  isUpdating: false,
  isDeleting: false,
}

describe('MedsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAppStore.mockReturnValue(baseAppStore as ReturnType<typeof useAppStore>)
    mockUseSchedules.mockReturnValue(baseSchedules as unknown as ReturnType<typeof useSchedules>)
    mockUseRefills.mockReturnValue(baseRefills as unknown as ReturnType<typeof useRefills>)
  })

  it('renders empty state when no medications exist', () => {
    mockUseMedications.mockReturnValue(baseMedications as unknown as ReturnType<typeof useMedications>)

    renderWithProviders(<MedsView />)

    expect(screen.getByText('No medications yet')).toBeInTheDocument()
  })

  it('renders medication names when medications exist', () => {
    const meds = [
      { id: 'med-1', name: 'Aspirin', dosage: '100mg', freq: 1, instructions: '', warnings: '' },
      { id: 'med-2', name: 'Metformin', dosage: '500mg', freq: 2, instructions: '', warnings: '' },
    ]
    mockUseMedications.mockReturnValue({
      ...baseMedications,
      meds,
    } as unknown as ReturnType<typeof useMedications>)

    renderWithProviders(<MedsView />)

    expect(screen.getByText('Aspirin')).toBeInTheDocument()
    expect(screen.getByText('Metformin')).toBeInTheDocument()
  })

  it('renders the supply bar for a medication with refill data', () => {
    const meds = [
      { id: 'med-1', name: 'Lisinopril', dosage: '10mg', freq: 1, instructions: '', warnings: '' },
    ]
    const refills = [
      { id: 'ref-1', medication_id: 'med-1', current_quantity: 15, total_quantity: 30 },
    ]
    mockUseMedications.mockReturnValue({
      ...baseMedications,
      meds,
    } as unknown as ReturnType<typeof useMedications>)
    mockUseRefills.mockReturnValue({
      ...baseRefills,
      refills,
    } as unknown as ReturnType<typeof useRefills>)

    renderWithProviders(<MedsView />)

    // Supply text: "X pills left"
    expect(screen.getByText('15 pills left')).toBeInTheDocument()
  })

  it('displays dosage badge for each medication', () => {
    const meds = [
      { id: 'med-1', name: 'Warfarin', dosage: '5mg', freq: 1, instructions: '', warnings: '' },
    ]
    mockUseMedications.mockReturnValue({
      ...baseMedications,
      meds,
    } as unknown as ReturnType<typeof useMedications>)

    renderWithProviders(<MedsView />)

    expect(screen.getByText('5mg')).toBeInTheDocument()
  })

  it('shows the "Add Medication" button at all times', () => {
    mockUseMedications.mockReturnValue(baseMedications as unknown as ReturnType<typeof useMedications>)

    renderWithProviders(<MedsView />)

    expect(screen.getAllByRole('button', { name: /Add Medication/i }).length).toBeGreaterThanOrEqual(1)
  })
})
