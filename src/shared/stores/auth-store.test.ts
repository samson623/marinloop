import { describe, it, expect, vi, afterEach } from 'vitest'

// vi.doMock + vi.resetModules lets each test load a fresh store instance.
afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

const makeSession = (userId = 'user-1') => ({
  user: { id: userId, email: 'test@marinloop.com' },
  access_token: 'token',
  refresh_token: 'refresh',
  expires_at: Date.now() / 1000 + 3600,
})

const makeProfile = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@marinloop.com',
  name: 'Test User',
  avatar_url: null,
  timezone: 'America/New_York',
  plan: 'free',
  allergies: null,
  ...overrides,
})

function mockDeps({
  session = null as ReturnType<typeof makeSession> | null,
  profileData = makeProfile() as ReturnType<typeof makeProfile> | null,
  profileError = null as Error | null,
  getSessionError = null as Error | null,
  signOutError = null as Error | null,
  signInError = null as Error | null,
  signUpError = null as Error | null,
  betaCodeRow = { id: 'code-1', redeemed_at: null } as { id: string; redeemed_at: string | null } | null,
  betaCodeError = null as unknown,
  windowHref = 'http://localhost:5173/',
} = {}) {
  // Stub window.location
  vi.stubGlobal('window', {
    location: { href: windowHref },
    history: { replaceState: vi.fn() },
  })

  const mockFrom = vi.fn()
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profileData, error: profileError }),
    update: vi.fn().mockReturnThis(),
    then: vi.fn(),
  }
  mockFrom.mockReturnValue(selectChain)

  const onAuthStateChangeCb: Array<(event: string, s: unknown) => void> = []
  const mockSubscription = { unsubscribe: vi.fn() }

  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({
      data: { session },
      error: getSessionError,
    }),
    onAuthStateChange: vi.fn().mockImplementation((cb) => {
      onAuthStateChangeCb.push(cb)
      return { data: { subscription: mockSubscription } }
    }),
    signOut: vi.fn().mockResolvedValue({ error: signOutError }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: signInError }),
    signUp: vi.fn().mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: signUpError,
    }),
    signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    mfa: {
      enroll: vi.fn(),
      challenge: vi.fn(),
      verify: vi.fn(),
    },
  }

  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })

  const betaCodeChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: betaCodeRow, error: betaCodeError }),
  }

  // Override from for beta_invite_codes table
  const managedProfilesChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }

  mockFrom.mockImplementation((table: string) => {
    if (table === 'beta_invite_codes') return betaCodeChain
    if (table === 'managed_profiles') return managedProfilesChain
    return selectChain
  })

  vi.doMock('@/shared/lib/supabase', () => ({
    supabase: {
      from: mockFrom,
      auth: mockAuth,
      rpc: mockRpc,
    },
  }))

  vi.doMock('@/shared/lib/env', () => ({
    env: { oauthRedirectUrl: null, adminUserId: undefined },
  }))

  return { mockAuth, mockFrom, onAuthStateChangeCb, selectChain, mockRpc, betaCodeChain }
}

describe('useAuthStore', () => {
  describe('initialize()', () => {
    it('sets session, user, profile and isLoading=false on a valid session', async () => {
      const session = makeSession()
      const profile = makeProfile()
      mockDeps({ session, profileData: profile })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      const store = useAuthStore.getState()

      await store.initialize()

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.session).not.toBeNull()
      expect(state.user?.id).toBe('user-1')
      expect(state.profile?.name).toBe('Test User')
      expect(state.profile?.allergies).toBeNull()
    })

    it('sets isLoading=false with null session when no session exists and no ?code= param', async () => {
      mockDeps({ session: null })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      await useAuthStore.getState().initialize()

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.session).toBeNull()
      expect(state.user).toBeNull()
      expect(state.profile).toBeNull()
    })

    it('keeps isLoading=true when applySession(null) is called while ?code= is in the URL (PKCE guard)', async () => {
      mockDeps({ session: null, windowHref: 'http://localhost:5173/?code=abc123' })

      const { useAuthStore } = await import('@/shared/stores/auth-store')

      // Don't await — the store will hang (PKCE guard) until session arrives or timeout
      void useAuthStore.getState().initialize()

      // Give the micro-task queue a tick to process getSession (which returns null)
      await new Promise((r) => setTimeout(r, 0))

      expect(useAuthStore.getState().isLoading).toBe(true)
    })

    it('includes allergies from the profile fetch', async () => {
      const session = makeSession()
      const profile = makeProfile({ allergies: ['penicillin', 'sulfa'] })
      mockDeps({ session, profileData: profile })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().profile?.allergies).toEqual(['penicillin', 'sulfa'])
    })
  })

  describe('signOut()', () => {
    it('clears session, user and profile on success', async () => {
      const session = makeSession()
      mockDeps({ session })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      await useAuthStore.getState().initialize()

      const result = await useAuthStore.getState().signOut()

      expect(result.error).toBeNull()
      const state = useAuthStore.getState()
      expect(state.session).toBeNull()
      expect(state.user).toBeNull()
      expect(state.profile).toBeNull()
    })

    it('preserves state and returns error when Supabase signOut fails', async () => {
      const session = makeSession()
      const signOutError = new Error('network failure')
      mockDeps({ session, signOutError })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      await useAuthStore.getState().initialize()

      const result = await useAuthStore.getState().signOut()

      expect(result.error?.message).toContain('network failure')
      // State should not be wiped on failure
      expect(useAuthStore.getState().session).not.toBeNull()
    })
  })

  describe('signInWithEmail()', () => {
    it('calls Supabase signInWithPassword with the provided credentials', async () => {
      const { mockAuth } = mockDeps({ session: null })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      const result = await useAuthStore.getState().signInWithEmail('user@test.com', 'password123')

      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'password123',
      })
      expect(result.error).toBeNull()
    })

    it('returns error when signInWithPassword fails', async () => {
      const signInError = new Error('Invalid credentials')
      mockDeps({ session: null, signInError })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      const result = await useAuthStore.getState().signInWithEmail('bad@test.com', 'wrong')

      expect(result.error?.message).toContain('Invalid credentials')
    })
  })

  describe('signUp()', () => {
    it('returns error for an invalid invite code', async () => {
      mockDeps({ session: null, betaCodeRow: null, betaCodeError: new Error('not found') })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      const result = await useAuthStore.getState().signUp('a@b.com', 'pass1234', 'Alice', 'MLOOP-BADCODE')

      expect(result.error?.message).toBe('Invalid invite code.')
    })

    it('returns error when invite code has already been redeemed', async () => {
      mockDeps({
        session: null,
        betaCodeRow: { id: 'code-1', redeemed_at: '2026-01-01T00:00:00Z' },
      })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      const result = await useAuthStore.getState().signUp('a@b.com', 'pass1234', 'Alice', 'MLOOP-USED01')

      expect(result.error?.message).toBe('This invite code has already been used.')
    })

    it('returns no error and redeems code on successful sign-up', async () => {
      const { mockRpc } = mockDeps({ session: null })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      const result = await useAuthStore.getState().signUp('new@test.com', 'StrongPass1!', 'Bob', 'MLOOP-VALID1')

      expect(result.error).toBeNull()
      expect(mockRpc).toHaveBeenCalledWith('redeem_beta_code', expect.objectContaining({
        p_code: 'MLOOP-VALID1',
      }))
    })

    it('normalizes invite code to uppercase before checking', async () => {
      const { betaCodeChain } = mockDeps({ session: null })

      const { useAuthStore } = await import('@/shared/stores/auth-store')
      await useAuthStore.getState().signUp('a@b.com', 'pass1234', 'Alice', 'mloop-valid1')

      expect(betaCodeChain.eq).toHaveBeenCalledWith('code', 'MLOOP-VALID1')
    })
  })
})
