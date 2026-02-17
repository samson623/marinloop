import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'

type Profile = {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  plan: 'free' | 'pro' | 'family'
}

type AuthResult = { error: Error | null }

type MfaEnrollResult = {
  factorId: string
  qrCodeSvg: string
  secret: string
} | null

type AuthSubscription = {
  unsubscribe: () => void
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  isDemo: boolean
  isLoading: boolean

  initialize: () => Promise<void>
  signInWithGoogle: () => Promise<AuthResult>
  signInWithEmail: (email: string, pass: string) => Promise<AuthResult>
  signUp: (email: string, pass: string, name: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  enrollMfa: () => Promise<{ data: MfaEnrollResult; error: Error | null }>
  verifyMfa: (factorId: string, code: string) => Promise<AuthResult>
}

const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@medflow.app',
} as User

const DEMO_PROFILE: Profile = {
  id: 'demo-user',
  email: 'demo@medflow.app',
  name: 'Demo User',
  avatar_url: null,
  plan: 'free',
}

let authSubscription: AuthSubscription | null = null

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, avatar_url, plan')
    .eq('id', userId)
    .single()

  if (error) return null
  return data
}

function cleanupOAuthUrl() {
  const url = new URL(window.location.href)
  const hadCode = url.searchParams.has('code')
  const hadState = url.searchParams.has('state')

  if (!hadCode && !hadState) return

  url.searchParams.delete('code')
  url.searchParams.delete('state')

  const query = url.searchParams.toString()
  const nextUrl = query ? `${url.pathname}?${query}${url.hash}` : `${url.pathname}${url.hash}`
  window.history.replaceState({}, document.title, nextUrl)
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isDemo: env.isDemoApp,
  isLoading: true,

  initialize: async () => {
    if (env.isDemoApp) {
      set({
        session: null,
        user: DEMO_USER,
        profile: DEMO_PROFILE,
        isDemo: true,
        isLoading: false,
      })
      return
    }

    const applySession = async (nextSession: Session | null) => {
      if (!nextSession) {
        set({ session: null, user: null, profile: null, isDemo: false, isLoading: false })
        return
      }

      try {
        const profile = await fetchProfile(nextSession.user.id)
        set({ session: nextSession, user: nextSession.user, profile, isDemo: false, isLoading: false })
      } catch (err) {
        console.warn('[Auth] failed to fetch profile:', err)
        set({ session: nextSession, user: nextSession.user, profile: null, isDemo: false, isLoading: false })
      }
    }

    // Safety net: clear loading after 5s max.
    setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        console.warn('[Auth] initialization timed out, forcing loading false')
        set({ isLoading: false })
      }
    }, 5000)

    // Register exactly once to avoid duplicate listeners on repeated init calls.
    if (!authSubscription) {
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        void applySession(nextSession)
      })
      authSubscription = data.subscription as AuthSubscription
    }

    try {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('[Auth] OAuth code exchange failed:', error.message)
        }
      }

      cleanupOAuthUrl()

      const { data } = await supabase.auth.getSession()
      await applySession(data.session)
    } catch (err) {
      console.error('[Auth] init error:', err)
      set({ session: null, user: null, profile: null, isDemo: false, isLoading: false })
    }
  },

  signInWithGoogle: async () => {
    if (env.isDemoApp) return { error: null }

    // Always use current origin so the OAuth callback returns to the same context (PWA or tab).
    // Otherwise on iOS the callback can open in Safari and the home-screen PWA never gets the session.
    const redirectTo = window.location.origin
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })

    return { error: error ? new Error(error.message) : null }
  },

  signInWithEmail: async (email, pass) => {
    if (env.isDemoApp) {
      set({
        session: null,
        user: DEMO_USER,
        profile: DEMO_PROFILE,
        isDemo: true,
        isLoading: false,
      })
      return { error: null }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    return { error: error ? new Error(error.message) : null }
  },

  signUp: async (email, pass, name) => {
    if (env.isDemoApp) return { error: null }

    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: name,
        },
      },
    })

    return { error: error ? new Error(error.message) : null }
  },

  signOut: async () => {
    if (env.isDemoApp) {
      set({
        session: null,
        user: DEMO_USER,
        profile: DEMO_PROFILE,
        isDemo: true,
        isLoading: false,
      })
      return { error: null }
    }

    const { error } = await supabase.auth.signOut()
    if (!error) {
      set({ session: null, user: null, profile: null, isDemo: false })
    }
    return { error: error ? new Error(error.message) : null }
  },

  enrollMfa: async () => {
    if (env.isDemoApp) return { data: null, error: null }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'MedFlow Authenticator',
    })

    if (error || !data) {
      return { data: null, error: error ? new Error(error.message) : new Error('Failed to enroll MFA') }
    }

    return {
      data: {
        factorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
      },
      error: null,
    }
  },

  verifyMfa: async (factorId, code) => {
    if (env.isDemoApp) return { error: null }

    const challenge = await supabase.auth.mfa.challenge({ factorId })
    if (challenge.error || !challenge.data) {
      return { error: new Error(challenge.error?.message ?? 'Failed to challenge MFA factor') }
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    })

    return { error: verify.error ? new Error(verify.error.message) : null }
  },
}))
