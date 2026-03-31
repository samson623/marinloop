import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'
import { supabase } from '@/shared/lib/supabase'

/**
 * Handles the OAuth redirect callback.
 *
 * detectSessionInUrl is now OFF so the ?code= stays in the URL for us to
 * exchange explicitly. This eliminates the race where auto-detection consumed
 * the code, the async exchange failed silently, and the code was gone forever.
 */
export function AuthCallbackScreen() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const started = useRef(false)
  const [status, setStatus] = useState('Completing sign-in…')

  useEffect(() => {
    if (session) {
      navigate('/timeline', { replace: true })
      return
    }

    if (!started.current) {
      started.current = true

      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (!code) {
        navigate('/login?error=callback', { replace: true })
        return
      }

      // Exchange the PKCE code ourselves — detectSessionInUrl is OFF
      // so nothing else will consume it.
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('[AuthCallback] PKCE exchange failed:', error.message)
          setStatus(`Sign-in failed: ${error.message}`)
          setTimeout(() => navigate('/login?error=callback', { replace: true }), 3000)
        }
        // Success: onAuthStateChange → auth store sets session →
        // this effect re-runs → navigate to /timeline
      }).catch((err) => {
        console.error('[AuthCallback] PKCE exchange threw:', err)
        setStatus('Sign-in failed unexpectedly.')
        setTimeout(() => navigate('/login?error=callback', { replace: true }), 3000)
      })
    }

    // Safety timeout
    const timeout = setTimeout(() => {
      if (!useAuthStore.getState().session) {
        navigate('/login?error=timeout', { replace: true })
      }
    }, 15_000)

    return () => clearTimeout(timeout)
  }, [session, navigate])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[var(--color-bg-primary)] p-4">
      <div className="animate-dot-pulse h-3 w-3 rounded-full bg-[var(--color-accent)]" aria-hidden />
      <p className="text-[var(--color-text-secondary)] font-medium [font-size:var(--text-body)] text-center px-6">
        {status}
      </p>
    </div>
  )
}
