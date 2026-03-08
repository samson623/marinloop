/**
 * useIdleTimeout — HIPAA §164.312(a)(2)(iii) automatic logoff after inactivity.
 *
 * Architecture:
 * - A single setInterval ticks every second and compares Date.now() to the
 *   last-activity timestamp stored in a ref. This avoids creating new event
 *   listeners on every activity event and eliminates stale closure issues.
 * - Activity events reset only the ref value; the interval does the rest.
 * - On visibilitychange (tab becoming visible), the interval fires on the next
 *   tick — if the elapsed time already exceeds logoutAt the logout runs within
 *   1 second of regaining visibility.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/shared/stores/auth-store'

export interface IdleTimeoutOptions {
  /** ms of inactivity before showing the warning. Default: 13 minutes */
  warnAt?: number
  /** ms of inactivity before automatic sign-out. Default: 15 minutes */
  logoutAt?: number
}

const DEFAULT_WARN_AT   = 13 * 60 * 1000
const DEFAULT_LOGOUT_AT = 15 * 60 * 1000

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
] as const

export function useIdleTimeout(options?: IdleTimeoutOptions): {
  showWarning: boolean
  secondsRemaining: number
  resetTimer: () => void
} {
  const warnAt   = options?.warnAt   ?? DEFAULT_WARN_AT
  const logoutAt = options?.logoutAt ?? DEFAULT_LOGOUT_AT
  // secondsRemaining when warnAt is first exceeded
  const warningWindowSecs = Math.round((logoutAt - warnAt) / 1000)

  const signOut = useAuthStore((s) => s.signOut)

  // Initialise with 0 (pure); the effect seeds it with Date.now() before the
  // interval starts, so the first tick always sees elapsed < warnAt.
  const lastActivityRef = useRef<number>(0)
  const loggedOutRef    = useRef<boolean>(false)

  const [showWarning,      setShowWarning]      = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(warningWindowSecs)

  /** Public API: dismiss the warning and reset the idle clock */
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    setShowWarning(false)
    setSecondsRemaining(warningWindowSecs)
  }, [warningWindowSecs])

  useEffect(() => {
    // Seed the activity timestamp now that we are inside an effect (side-effect
    // zone). This ensures the first interval tick computes elapsed from mount
    // time rather than from the JS epoch (0).
    lastActivityRef.current = Date.now()
    loggedOutRef.current = false

    /** Called on every activity event — just stamps the timestamp */
    const handleActivity = () => {
      lastActivityRef.current = Date.now()
    }

    /** visibilitychange: when the tab regains focus, reset the activity stamp
     *  only if the hidden period was within the warning window. If the tab was
     *  hidden long enough to exceed logoutAt, the interval will sign the user
     *  out on its very next tick (within 1 second). */
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Do not reset activity here — let the interval decide whether the
        // elapsed time warrants a logout. We only update if it's under warnAt
        // so that going away and coming back quickly doesn't trigger the warning.
        const elapsed = Date.now() - lastActivityRef.current
        if (elapsed < warnAt) {
          lastActivityRef.current = Date.now()
        }
      }
    }

    ACTIVITY_EVENTS.forEach((e) =>
      document.addEventListener(e, handleActivity, { passive: true })
    )
    document.addEventListener('visibilitychange', handleVisibility)

    /** Tick every second: compare elapsed time and update state */
    const intervalId = setInterval(() => {
      if (loggedOutRef.current) return

      const elapsed = Date.now() - lastActivityRef.current

      if (elapsed >= logoutAt) {
        loggedOutRef.current = true
        setShowWarning(false)
        void signOut()
        return
      }

      if (elapsed >= warnAt) {
        const remaining = Math.max(0, Math.round((logoutAt - elapsed) / 1000))
        setShowWarning(true)
        setSecondsRemaining(remaining)
      } else {
        setShowWarning(false)
        setSecondsRemaining(warningWindowSecs)
      }
    }, 1000)

    return () => {
      clearInterval(intervalId)
      ACTIVITY_EVENTS.forEach((e) =>
        document.removeEventListener(e, handleActivity)
      )
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [warnAt, logoutAt, warningWindowSecs, signOut])

  return { showWarning, secondsRemaining, resetTimer }
}
