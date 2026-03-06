import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PrivateRoute } from '@/app/PrivateRoute'
import { useAuthStore } from '@/shared/stores/auth-store'
import type { Session } from '@supabase/supabase-js'

vi.mock('@/shared/stores/auth-store')

const mockUseAuthStore = vi.mocked(useAuthStore)

function renderWithRouter(initialEntries: string[] = ['/protected']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<PrivateRoute />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/landing" element={<div>Landing Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PrivateRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a loading indicator when isLoading is true', () => {
    mockUseAuthStore.mockReturnValue({
      session: null,
      isLoading: true,
    } as ReturnType<typeof useAuthStore>)

    renderWithRouter()

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.queryByText('Landing Page')).not.toBeInTheDocument()
  })

  it('redirects to /landing when session is null and not loading', () => {
    mockUseAuthStore.mockReturnValue({
      session: null,
      isLoading: false,
    } as ReturnType<typeof useAuthStore>)

    renderWithRouter()

    expect(screen.getByText('Landing Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('renders the protected Outlet when session exists and not loading', () => {
    const fakeSession = { user: { id: 'user-1' } } as Session

    mockUseAuthStore.mockReturnValue({
      session: fakeSession,
      isLoading: false,
    } as ReturnType<typeof useAuthStore>)

    renderWithRouter()

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByText('Landing Page')).not.toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('does not render protected content while loading even with a session', () => {
    const fakeSession = { user: { id: 'user-1' } } as Session

    mockUseAuthStore.mockReturnValue({
      session: fakeSession,
      isLoading: true,
    } as ReturnType<typeof useAuthStore>)

    renderWithRouter()

    // While loading, always show the loading screen regardless of session state
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
