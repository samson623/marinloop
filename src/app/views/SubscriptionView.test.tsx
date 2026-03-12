import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { SubscriptionView } from '@/app/views/SubscriptionView'
import { useSubscription } from '@/shared/hooks/useSubscription'
import { useAppStore } from '@/shared/stores/app-store'

// ---------------------------------------------------------------------------
// Module mocks — all modules that transitively import Supabase need factories
// ---------------------------------------------------------------------------

vi.mock('@/shared/hooks/useSubscription', () => ({
  useSubscription: vi.fn(),
}))

vi.mock('@/shared/stores/app-store', () => ({
  useAppStore: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockUseSubscription = vi.mocked(useSubscription)
const mockUseAppStore = vi.mocked(useAppStore)

// ---------------------------------------------------------------------------
// Default return values
// ---------------------------------------------------------------------------

const mockToast = vi.fn()

const freeSubscriptionState: ReturnType<typeof useSubscription> = {
  subscription: null,
  tier: 'free',
  status: null,
  limits: {
    maxMeds: 3,
    maxProfiles: 1,
    aiDailyLimit: 0,
    hasBarcode: false,
    hasOcr: false,
    hasCaregiverMode: false,
    hasSmartReminders: false,
    hasPrioritySupport: false,
  },
  isTrialing: false,
  trialDaysRemaining: null,
  canUseAi: false,
  canUseBarcode: false,
  canUseOcr: false,
  canUseCaregiverMode: false,
  canUseSmartReminders: false,
  canAddMedication: () => true,
  isAtMedLimit: () => false,
  getMedLimitDisplay: () => '3',
  getAiDailyLimit: () => 0,
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function setupMocks() {
  mockUseSubscription.mockReturnValue(freeSubscriptionState)
  mockUseAppStore.mockImplementation((selector) =>
    selector({ toast: mockToast } as unknown as Parameters<typeof selector>[0]),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubscriptionView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders all three plan cards', () => {
    renderWithProviders(<SubscriptionView />, { initialEntries: ['/subscription'] })

    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Basic').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Pro').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the plan picker component', () => {
    renderWithProviders(<SubscriptionView />, { initialEntries: ['/subscription'] })

    expect(screen.getByTestId('plan-picker')).toBeInTheDocument()
  })

  describe('onboarding mode (?onboarding=1)', () => {
    it('shows onboarding heading when ?onboarding=1 is in the URL', () => {
      renderWithProviders(<SubscriptionView />, {
        initialEntries: ['/subscription?onboarding=1'],
      })

      expect(screen.getByText('Choose your plan')).toBeInTheDocument()
      expect(
        screen.getByText(/start free — upgrade anytime/i),
      ).toBeInTheDocument()
    })

    it('shows the skip link in onboarding mode', () => {
      renderWithProviders(<SubscriptionView />, {
        initialEntries: ['/subscription?onboarding=1'],
      })

      expect(
        screen.getByText(/skip — continue with free/i),
      ).toBeInTheDocument()
    })

    it('navigates to /timeline when skip link is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(<SubscriptionView />, {
        initialEntries: ['/subscription?onboarding=1'],
      })

      const skipLink = screen.getByText(/skip — continue with free/i)
      await user.click(skipLink)

      expect(mockNavigate).toHaveBeenCalledWith('/timeline')
    })
  })

  describe('non-onboarding mode', () => {
    it('shows back button when not in onboarding mode', () => {
      renderWithProviders(<SubscriptionView />, { initialEntries: ['/subscription'] })

      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
    })

    it('shows "Subscription" heading when not in onboarding mode', () => {
      renderWithProviders(<SubscriptionView />, { initialEntries: ['/subscription'] })

      expect(screen.getByText('Subscription')).toBeInTheDocument()
    })

    it('shows current plan summary pill when not in onboarding mode', () => {
      renderWithProviders(<SubscriptionView />, { initialEntries: ['/subscription'] })

      expect(screen.getAllByText(/current plan/i).length).toBeGreaterThanOrEqual(1)
    })

    it('does not show the skip link when not in onboarding mode', () => {
      renderWithProviders(<SubscriptionView />, { initialEntries: ['/subscription'] })

      expect(screen.queryByText(/skip — continue with free/i)).not.toBeInTheDocument()
    })
  })

  describe('upgrade flow', () => {
    it('calls toast with Stripe placeholder message when upgrade button is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(<SubscriptionView />, { initialEntries: ['/subscription'] })

      const upgradeButton = screen.getByRole('button', { name: /upgrade to basic/i })
      await user.click(upgradeButton)

      expect(mockToast).toHaveBeenCalledWith('Stripe integration coming soon.', 'tw')
    })

    it('shows upgrade buttons for non-current tiers', () => {
      renderWithProviders(<SubscriptionView />, { initialEntries: ['/subscription'] })

      expect(
        screen.getByRole('button', { name: /upgrade to basic/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /upgrade to pro/i }),
      ).toBeInTheDocument()
    })
  })

  describe('fine print', () => {
    it('shows the fine print text', () => {
      renderWithProviders(<SubscriptionView />, { initialEntries: ['/subscription'] })

      expect(
        screen.getByText(/prices shown in usd/i),
      ).toBeInTheDocument()
    })
  })
})
