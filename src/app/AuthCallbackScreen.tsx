import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'

/**
 * Handles the OAuth redirect from Google (and other providers).
 * Supabase exchanges the ?code= in the URL when the app loads; we wait for
 * the session then redirect to timeline or login.
 */
export function AuthCallbackScreen() {
  const navigate = useNavigate()
  const { session, isDemo, isLoading } = useAuthStore()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isDemo || session) {
      navigate('/timeline', { replace: true })
      return
    }
    if (!isLoading) {
      // No session and init finished — likely missing/invalid code or exchange failed
      navigate('/login?error=callback', { replace: true })
      return
    }
    // Safety: if still loading after 10s, send to login
    timeoutRef.current = setTimeout(() => {
      navigate('/login?error=timeout', { replace: true })
    }, 10_000)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [session, isDemo, isLoading, navigate])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[var(--color-bg-primary)] p-4">
      <div className="animate-dot-pulse h-3 w-3 rounded-full bg-[var(--color-accent)]" aria-hidden />
      <p className="text-[var(--color-text-secondary)] font-medium [font-size:var(--text-body)]">
        Completing sign-in…
      </p>
    </div>
  )
}
