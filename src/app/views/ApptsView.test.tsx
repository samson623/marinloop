import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import React from 'react'
import { ApptsView } from '@/app/views/ApptsView'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useAppStore } from '@/shared/stores/app-store'
import { renderWithProviders } from '@/test/utils'

vi.mock('@/shared/hooks/useAppointments')
vi.mock('@/shared/stores/app-store')

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

const mockUseAppointments = vi.mocked(useAppointments)
const mockUseAppStore = vi.mocked(useAppStore)

const baseAppStore = {
  showAddApptModal: false,
  draftAppt: null,
  openAddApptModal: vi.fn(),
  closeAddApptModal: vi.fn(),
  toast: vi.fn(),
}

const baseAppointments = {
  appts: [],
  isLoading: false,
  error: null,
  addAppt: vi.fn(),
  updateAppt: vi.fn(),
  deleteAppt: vi.fn(),
  isAdding: false,
}

// Future appointment (1 year ahead)
const futureISO = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
// Past appointment (1 year ago)
const pastISO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

describe('ApptsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAppStore.mockReturnValue(baseAppStore as ReturnType<typeof useAppStore>)
  })

  it('renders the empty state when no appointments exist', () => {
    mockUseAppointments.mockReturnValue(baseAppointments as ReturnType<typeof useAppointments>)

    renderWithProviders(<ApptsView />)

    expect(screen.getByText('No appointments scheduled')).toBeInTheDocument()
  })

  it('renders appointment titles when appointments exist', () => {
    const appts = [
      { id: 'appt-1', title: 'Cardiology Checkup', start_time: futureISO, location: 'City Hospital', notes: null, doctor: null, user_id: 'user-1', commute_minutes: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'appt-2', title: 'Blood Work', start_time: futureISO, location: 'Lab', notes: null, doctor: null, user_id: 'user-1', commute_minutes: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
    mockUseAppointments.mockReturnValue({
      ...baseAppointments,
      appts,
    } as unknown as ReturnType<typeof useAppointments>)

    renderWithProviders(<ApptsView />)

    expect(screen.getByText('Cardiology Checkup')).toBeInTheDocument()
    expect(screen.getByText('Blood Work')).toBeInTheDocument()
  })

  it('renders past appointments with reduced opacity style', () => {
    const appts = [
      { id: 'appt-1', title: 'Old Appointment', start_time: pastISO, location: '', notes: null, doctor: null, user_id: 'user-1', commute_minutes: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
    mockUseAppointments.mockReturnValue({
      ...baseAppointments,
      appts,
    } as unknown as ReturnType<typeof useAppointments>)

    renderWithProviders(<ApptsView />)

    const btn = screen.getByRole('listitem', { name: /Old Appointment/i })
    // Past appointments have opacity: 0.45
    expect(btn).toHaveStyle({ opacity: '0.45' })
  })

  it('renders future appointments at full opacity', () => {
    const appts = [
      { id: 'appt-2', title: 'Future Checkup', start_time: futureISO, location: '', notes: null, doctor: null, user_id: 'user-1', commute_minutes: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
    mockUseAppointments.mockReturnValue({
      ...baseAppointments,
      appts,
    } as unknown as ReturnType<typeof useAppointments>)

    renderWithProviders(<ApptsView />)

    const btn = screen.getByRole('listitem', { name: /Future Checkup/i })
    expect(btn).toHaveStyle({ opacity: '1' })
  })

  it('shows the "Add Appointment" button at all times', () => {
    mockUseAppointments.mockReturnValue(baseAppointments as ReturnType<typeof useAppointments>)

    renderWithProviders(<ApptsView />)

    expect(screen.getAllByRole('button', { name: /Add Appointment/i }).length).toBeGreaterThanOrEqual(1)
  })
})
