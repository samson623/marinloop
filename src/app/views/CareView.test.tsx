import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { CareView } from '@/app/views/CareView'
import { useProviders } from '@/shared/hooks/useProviders'
import { useCareNetwork } from '@/shared/hooks/useCareNetwork'
import { useEmergencyContacts } from '@/shared/hooks/useEmergencyContacts'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/shared/hooks/useProviders')
vi.mock('@/shared/hooks/useCareNetwork')
vi.mock('@/shared/hooks/useEmergencyContacts')

// Stub Modal to avoid portal/animation complexity in jsdom
vi.mock('@/shared/components/Modal', () => ({
  Modal: ({ children, title, open }: { children: React.ReactNode; title: string; open: boolean }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}))
vi.mock('@/shared/components/ConfirmDeleteModal', () => ({
  ConfirmDeleteModal: () => null,
}))

const mockUseProviders = vi.mocked(useProviders)
const mockUseCareNetwork = vi.mocked(useCareNetwork)
const mockUseEmergencyContacts = vi.mocked(useEmergencyContacts)

const baseProviders = {
  providers: [],
  isLoading: false,
  error: null,
  addProvider: vi.fn(),
  updateProvider: vi.fn(),
  deleteProvider: vi.fn(),
  isAdding: false,
}

const baseCareNetwork = {
  connections: [],
  isLoading: false,
  error: null,
  addConnection: vi.fn(),
  revokeConnection: vi.fn(),
  deleteConnection: vi.fn(),
  updateConnection: vi.fn(),
  isAdding: false,
}

const baseEmergencyContacts = {
  contacts: [],
  isLoading: false,
  addContact: vi.fn(),
  removeContact: vi.fn(),
  isAdding: false,
}

describe('CareView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseProviders.mockReturnValue(baseProviders as ReturnType<typeof useProviders>)
    mockUseCareNetwork.mockReturnValue(baseCareNetwork as ReturnType<typeof useCareNetwork>)
    mockUseEmergencyContacts.mockReturnValue(baseEmergencyContacts as ReturnType<typeof useEmergencyContacts>)
  })

  it('renders Care Team tab by default', () => {
    renderWithProviders(<CareView />)

    expect(screen.getByRole('tab', { name: /Care Team/i })).toBeInTheDocument()
  })

  it('shows empty state when no providers', () => {
    renderWithProviders(<CareView />)

    expect(screen.getByText(/No providers added yet/i)).toBeInTheDocument()
  })

  it('shows providers list when data exists', () => {
    mockUseProviders.mockReturnValue({
      ...baseProviders,
      providers: [
        {
          id: '1',
          user_id: 'u1',
          name: 'Dr. Smith',
          specialty: 'primary_care',
          phone: '555-1234',
          email: null,
          address: null,
          notes: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
    } as unknown as ReturnType<typeof useProviders>)

    renderWithProviders(<CareView />)

    expect(screen.getByText('Dr. Smith')).toBeInTheDocument()
  })

  it('switches to Caregivers tab', () => {
    renderWithProviders(<CareView />)

    const caregiversTab = screen.getByRole('tab', { name: /Caregivers/i })
    fireEvent.click(caregiversTab)

    expect(screen.getByText(/No caregivers yet/i)).toBeInTheDocument()
  })

  it('shows empty state when no caregivers', () => {
    renderWithProviders(<CareView />)

    const caregiversTab = screen.getByRole('tab', { name: /Caregivers/i })
    fireEvent.click(caregiversTab)

    expect(screen.getByText(/No caregivers yet/i)).toBeInTheDocument()
  })

  it('switches to Emergency tab and shows empty state', () => {
    renderWithProviders(<CareView />)

    const emergencyTab = screen.getByRole('tab', { name: /Emergency/i })
    fireEvent.click(emergencyTab)

    expect(screen.getByText(/No emergency contacts/i)).toBeInTheDocument()
  })

  it('shows Add Provider button on Care Team tab', () => {
    renderWithProviders(<CareView />)

    // Find a button whose accessible name or text content matches "Add Provider"
    expect(
      screen.getAllByRole('button').some(
        (btn) => /add\s+provider/i.test(btn.textContent ?? '') || /add\s+provider/i.test(btn.getAttribute('aria-label') ?? ''),
      ),
    ).toBe(true)
  })
})
