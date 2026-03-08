import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { renderWithProviders } from '@/test/utils'
import { AdminView } from '@/app/views/AdminView'
import {
  useAdminOverviewStats,
  useAdminUserList,
  useAdminFeedback,
  useAdminAIUsage,
} from '@/shared/hooks/useAdminData'
import { useAuthStore } from '@/shared/stores/auth-store'
import { AuditService } from '@/shared/services/audit'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/shared/hooks/useAdminData', () => ({
  useAdminOverviewStats: vi.fn(),
  useAdminUserList: vi.fn(),
  useAdminFeedback: vi.fn(),
  useAdminAIUsage: vi.fn(),
}))
vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}))
vi.mock('@/shared/lib/env', () => ({ env: { adminUserId: 'admin-uuid-123' } }))
vi.mock('@/shared/services/audit', () => ({
  AuditService: { logAsync: vi.fn(), log: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockUseAdminOverviewStats = vi.mocked(useAdminOverviewStats)
const mockUseAdminUserList = vi.mocked(useAdminUserList)
const mockUseAdminFeedback = vi.mocked(useAdminFeedback)
const mockUseAdminAIUsage = vi.mocked(useAdminAIUsage)
const mockUseAuthStore = vi.mocked(useAuthStore)

// ---------------------------------------------------------------------------
// Default hook return values
// ---------------------------------------------------------------------------

const baseOverviewStats = {
  stats: {
    total_users: 42,
    new_users_7d: 5,
    users_with_push: 10,
    users_who_gave_feedback: 8,
    total_feedback_items: 15,
    bug_reports: 3,
    feature_requests: 7,
    new_users_30d: 12,
    users_with_ai_consent: 30,
    total_ai_calls_today: 100,
    total_ai_calls_7d: 500,
    feedback_7d: 4,
    pro_users: 6,
    family_users: 2,
  },
  isLoading: false,
  isError: false,
  error: null,
}

const baseUserList = {
  users: [
    {
      user_id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
      plan: 'free',
      ai_consent_granted: true,
      joined_at: '2025-01-01T00:00:00Z',
      last_active_at: null,
      feedback_count: 2,
      ai_calls_today: 5,
      audit_actions_total: 10,
    },
  ],
  isLoading: false,
  isError: false,
  error: null,
}

const baseFeedback = {
  feedback: [
    {
      id: 'f1',
      user_id: 'u1',
      type: 'bug',
      message: 'Test bug report',
      current_route: '/meds',
      app_version: '1.0.0',
      created_at: '2025-01-01T00:00:00Z',
    },
  ],
  isLoading: false,
  isError: false,
  error: null,
}

const baseAIUsage = {
  usage: [
    {
      user_id: 'u1',
      email: 'test@example.com',
      request_count: 45,
      at_limit: false,
      near_limit: true,
    },
  ],
  isLoading: false,
  isError: false,
  error: null,
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function mockAdminUser() {
  mockUseAuthStore.mockReturnValue({
    user: { id: 'admin-uuid-123' },
  } as unknown as ReturnType<typeof useAuthStore>)
}

function mockNonAdminUser() {
  mockUseAuthStore.mockReturnValue({
    user: { id: 'other-user-uuid' },
  } as unknown as ReturnType<typeof useAuthStore>)
}

function mockAllHooksDefault() {
  mockUseAdminOverviewStats.mockReturnValue(
    baseOverviewStats as unknown as ReturnType<typeof useAdminOverviewStats>,
  )
  mockUseAdminUserList.mockReturnValue(
    baseUserList as unknown as ReturnType<typeof useAdminUserList>,
  )
  mockUseAdminFeedback.mockReturnValue(
    baseFeedback as unknown as ReturnType<typeof useAdminFeedback>,
  )
  mockUseAdminAIUsage.mockReturnValue(
    baseAIUsage as unknown as ReturnType<typeof useAdminAIUsage>,
  )
}

// ---------------------------------------------------------------------------
// Global jsdom stubs
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllHooksDefault()
  })

  // 1. Access denied for non-admin users
  it('shows "Access Denied" for a non-admin user', () => {
    mockNonAdminUser()

    renderWithProviders(<AdminView />)

    expect(
      screen.getByText(/access denied/i),
    ).toBeInTheDocument()
  })

  // 2. Overview tab renders stat tiles for admin users
  it('renders Overview tab stat tiles for the admin user', () => {
    mockAdminUser()

    renderWithProviders(<AdminView />)

    // The total_users stat (42) should appear somewhere in the overview
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  // 3. Feedback tab — clicking the tab shows feedback content
  it('shows feedback content after clicking the Feedback tab', async () => {
    mockAdminUser()
    const user = userEvent.setup()

    renderWithProviders(<AdminView />)

    const feedbackTab = screen.getByRole('button', { name: /feedback/i })
    await user.click(feedbackTab)

    expect(screen.getByText('Test bug report')).toBeInTheDocument()
  })

  // 4. Users tab — clicking the tab shows user list data
  it('shows user list data after clicking the Users tab', async () => {
    mockAdminUser()
    const user = userEvent.setup()

    renderWithProviders(<AdminView />)

    const usersTab = screen.getByRole('button', { name: /users/i })
    await user.click(usersTab)

    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  // 5. AI Usage tab — clicking the tab shows usage data
  it('shows AI usage data after clicking the AI Usage tab', async () => {
    mockAdminUser()
    const user = userEvent.setup()

    renderWithProviders(<AdminView />)

    const aiTab = screen.getByRole('button', { name: /ai usage/i })
    await user.click(aiTab)

    // The email appears in the AI usage row
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  // 6. Audit logging on mount — AuditService.logAsync called with admin.panel_opened
  it('calls AuditService.logAsync with admin.panel_opened on mount', () => {
    mockAdminUser()

    renderWithProviders(<AdminView />)

    expect(AuditService.logAsync).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.panel_opened' }),
    )
  })

  // 7. Error state — isError on overview hook shows an error message
  it('shows an error message when useAdminOverviewStats returns isError', () => {
    mockAdminUser()
    mockUseAdminOverviewStats.mockReturnValue({
      stats: null,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load stats'),
    } as unknown as ReturnType<typeof useAdminOverviewStats>)

    renderWithProviders(<AdminView />)

    // Some error text should be present
    expect(
      screen.getByText(/error|failed|could not load/i),
    ).toBeInTheDocument()
  })
})
