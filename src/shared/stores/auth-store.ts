import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'

type Profile = {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  timezone: string
  plan: 'free' | 'pro' | 'family'
  allergies: string[] | null
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
  isLoading: boolean

  initialize: () => Promise<void>
  signInWithGoogle: () => Promise<AuthResult>
  signInWithEmail: (email: string, pass: string) => Promise<AuthResult>
  signUp: (email: string, pass: string, name: string, betaCode: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  enrollMfa: () => Promise<{ data: MfaEnrollResult; error: Error | null }>
  verifyMfa: (factorId: string, code: string) => Promise<AuthResult>
  updatePlan: (plan: 'free' | 'pro' | 'family') => Promise<AuthResult>
}

let authSubscription: AuthSubscription | null = null

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, avatar_url, timezone, plan, allergies')
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
  isLoading: true,

  initialize: async () => {
    // Detect OAuth callback BEFORE calling getSession(). The Supabase SDK strips
    // ?code= from the URL via history.replaceState early inside getSession(), so
    // by the time onAuthStateChange fires null the param is already gone and a
    // post-hoc URL check always misses it (root cause of the desktop redirect bug).
    let oauthExchangeInProgress = false
    try {
      const url = new URL(window.location.href)
      oauthExchangeInProgress = url.searchParams.has('code')
    } catch { /* non-browser environment */ }

    const applySession = async (nextSession: Session | null) => {
      if (!nextSession) {
        // If we know a PKCE exchange was started, keep isLoading=true until the
        // session arrives (or the 5-second safety net fires).
        if (oauthExchangeInProgress) return
        set({ session: null, user: null, profile: null, isLoading: false })
        return
      }

      // Session arrived — exchange is complete.
      oauthExchangeInProgress = false

      // Clean OAuth params from URL once we have a confirmed session.
      cleanupOAuthUrl()

      try {
        const profile = await fetchProfile(nextSession.user.id)
        set({ session: nextSession, user: nextSession.user, profile, isLoading: false })

        // Silently sync IANA timezone to the database so the cron dispatcher fires at the right wall-clock time
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (browserTz && (!profile?.timezone || profile.timezone !== browserTz)) {
          supabase.from('profiles').update({ timezone: browserTz }).eq('id', nextSession.user.id).then(() => { })
        }
      } catch (err) {
        console.warn('[Auth] failed to fetch profile:', err)
        set({ session: nextSession, user: nextSession.user, profile: null, isLoading: false })
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
      // getSession() triggers the PKCE exchange and strips ?code= from the URL.
      // URL cleanup runs only inside applySession once a valid session is confirmed.
      const { data } = await supabase.auth.getSession()
      await applySession(data.session)
    } catch (err) {
      console.error('[Auth] init error:', err)
      set({ session: null, user: null, profile: null, isLoading: false })
    }
  },

  signInWithGoogle: async () => {
    // Use a dedicated callback URL so Supabase always redirects to the same path.
    // Add this exact URL to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
    const redirectTo =
      env.oauthRedirectUrl?.trim() ||
      `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })

    return { error: error ? new Error(error.message) : null }
  },

  signInWithEmail: async (email, pass) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    return { error: error ? new Error(error.message) : null }
  },

  signUp: async (email, pass, name, betaCode) => {
    // Step 1: pre-check the code exists and is not yet redeemed.
    // This avoids creating an orphan auth account when the code is bad.
    const normalizedCode = betaCode.trim().toUpperCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: codeRow, error: codeCheckError } = await (supabase as any)
      .from('beta_invite_codes')
      .select('id, redeemed_at')
      .eq('code', normalizedCode)
      .single() as { data: { id: string; redeemed_at: string | null } | null; error: unknown }

    if (codeCheckError || !codeRow) {
      return { error: new Error('Invalid invite code.') }
    }
    if (codeRow.redeemed_at) {
      return { error: new Error('This invite code has already been used.') }
    }

    // Step 2: create the auth account.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { full_name: name },
      },
    })

    if (signUpError) {
      return { error: new Error(signUpError.message) }
    }

    // Step 3: atomically redeem the code. The SECURITY DEFINER function
    // prevents a race condition where two users claim the same code.
    if (signUpData.user?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('redeem_beta_code', {
        p_code: normalizedCode,
        p_user_id: signUpData.user.id,
      })
    }

    return { error: null }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      set({ session: null, user: null, profile: null })
    }
    return { error: error ? new Error(error.message) : null }
  },

  enrollMfa: async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'marinloop Authenticator',
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

  updatePlan: async (plan) => {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user?.id) return { error: new Error('Not authenticated') }

    const { error } = await supabase.from('profiles').update({ plan }).eq('id', data.session.user.id)

    if (error) return { error: new Error(error.message) }

    const refreshed = await fetchProfile(data.session.user.id)
    set({ profile: refreshed })
    return { error: null }
  },
}))
