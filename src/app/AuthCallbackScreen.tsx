import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'
import { supabase } from '@/shared/lib/supabase'

/**
 * Handles the OAuth redirect from Google (and other providers).
 *
 * The Supabase JS client's auto-detection (`detectSessionInUrl`) can race with
 * the auth store's `initialize()` — it strips the ?code= from the URL before
 * initialize can see it, causing the PKCE exchange to silently fail on slower
 * connections (especially mobile). To fix this, we explicitly extract the code
 * and call `exchangeCodeForSession` ourselves as a belt-and-suspenders measure.
 */
export function AuthCallbackScreen() {
  const navigate = useNavigate()
  const { session } = useAuthStore()
  const exchangeAttempted = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (session) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      navigate('/timeline', { replace: true })
      return
    }

    // Explicitly exchange the PKCE code — don't rely solely on auto-detection
    // which can race with initialize() and lose the code.
    if (!exchangeAttempted.current) {
      exchangeAttempted.current = true

      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
          if (error) {
            console.warn('[AuthCallback] Code exchange failed:', error.message)
            navigate('/login?error=callback', { replace: true })
          }
          // On success, onAuthStateChange fires → auth store sets session →
          // this effect re-runs with session truthy → navigate to /timeline
        }).catch(() => {
          navigate('/login?error=callback', { replace: true })
        })
      } else {
        // No code in URL — auto-detection may have already consumed it.
        // Give initialize() up to 8s to finish the exchange it started.
        timeoutRef.current = setTimeout(() => {
          if (!useAuthStore.getState().session) {
            navigate('/login?error=callback', { replace: true })
          }
        }, 8_000)
      }
    }

    // Safety: absolute max wait of 15s
    const safetyTimeout = setTimeout(() => {
      if (!useAuthStore.getState().session) {
        navigate('/login?error=timeout', { replace: true })
      }
    }, 15_000)

    return () => {
      clearTimeout(safetyTimeout)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
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
