import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'
import { supabase } from '@/shared/lib/supabase'

/**
 * Handles the OAuth redirect from Google (and other providers).
 *
 * Race condition: Supabase's `detectSessionInUrl` auto-exchanges the ?code=
 * during client init (module load), stripping it from the URL. By the time
 * React mounts and initialize() runs, the code is gone. If the async exchange
 * hasn't finished, getSession() returns null, isLoading goes false, and the
 * old callback screen would redirect to /login?error=callback.
 *
 * Fix: don't depend on isLoading at all. Just poll for the session to appear
 * (from either auto-detection or explicit exchange) and give it plenty of time.
 * Try an explicit exchange if the code is still in the URL, but NEVER redirect
 * on exchange failure — the auto-detection path may still complete.
 */
export function AuthCallbackScreen() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const started = useRef(false)

  useEffect(() => {
    // Session arrived — done.
    if (session) {
      navigate('/timeline', { replace: true })
      return
    }

    if (!started.current) {
      started.current = true

      // If the code is still in the URL (auto-detection hasn't consumed it yet),
      // try an explicit exchange. Fire-and-forget — if it fails (code already
      // used by auto-detection), the session will still appear via that path.
      try {
        const code = new URL(window.location.href).searchParams.get('code')
        if (code) {
          supabase.auth.exchangeCodeForSession(code).catch(() => {
            // Swallow — auto-detection may have already exchanged it.
          })
        }
      } catch { /* URL parse failure — ignore */ }
    }

    // Poll the store for a session every 300ms. Covers both auto-detection
    // and explicit exchange paths without depending on isLoading.
    const poll = setInterval(() => {
      if (useAuthStore.getState().session) {
        navigate('/timeline', { replace: true })
      }
    }, 300)

    // Give up after 12 seconds — something is genuinely wrong.
    const timeout = setTimeout(() => {
      if (!useAuthStore.getState().session) {
        navigate('/login?error=timeout', { replace: true })
      }
    }, 12_000)

    return () => {
      clearInterval(poll)
      clearTimeout(timeout)
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
