import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'

/**
 * Handles the OAuth redirect callback.
 *
 * With implicit flow + detectSessionInUrl: true, the Supabase client reads
 * the access_token and refresh_token from the URL hash automatically during
 * client init. No PKCE exchange needed — the session appears in the store
 * via onAuthStateChange. We just wait for it.
 */
export function AuthCallbackScreen() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (session) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      navigate('/timeline', { replace: true })
      return
    }

    // The session should appear almost immediately from hash detection.
    // Give it 10 seconds max for slow mobile connections.
    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (!useAuthStore.getState().session) {
          navigate('/login?error=callback', { replace: true })
        }
      }, 10_000)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [session, navigate])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[var(--color-bg-primary)] p-4">
      <div className="animate-dot-pulse h-3 w-3 rounded-full bg-[var(--color-accent)]" aria-hidden />
      <p className="text-[var(--color-text-secondary)] font-medium [font-size:var(--text-body)]">
        Completing sign-in…
      </p>
    </div>
  )
}
