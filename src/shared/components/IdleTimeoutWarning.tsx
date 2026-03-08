/**
 * IdleTimeoutWarning — HIPAA §164.312(a)(2)(iii) inactivity warning overlay.
 *
 * Renders a fixed, centered card overlay when the user has been idle for
 * warnAt ms. Gives the user 120 seconds (default) to confirm they are still
 * present before the session is automatically terminated.
 */
import { useEffect, useRef } from 'react'
import { Button } from '@/shared/components/ui'
import { useAuthStore } from '@/shared/stores/auth-store'

interface IdleTimeoutWarningProps {
  secondsRemaining: number
  resetTimer: () => void
}

export function IdleTimeoutWarning({ secondsRemaining, resetTimer }: IdleTimeoutWarningProps) {
  const signOut = useAuthStore((s) => s.signOut)
  const stayBtnRef = useRef<HTMLButtonElement>(null)

  // Focus the "Stay signed in" button when the overlay mounts so keyboard
  // users can dismiss the warning without tabbing through the dimmed content.
  useEffect(() => {
    stayBtnRef.current?.focus()
  }, [])

  const handleSignOut = () => {
    void signOut()
  }

  return (
    /* Dim overlay */
    <div
      className="fixed inset-0 z-[800] flex items-center justify-center bg-black/50"
      aria-hidden="false"
    >
      {/* Warning card */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        aria-describedby="idle-warning-desc"
        className="w-[calc(100%-2rem)] max-w-[400px] rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.22)]"
      >
        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-amber,#d97706)]/15">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-amber,#d97706)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2
          id="idle-warning-title"
          className="mb-2 font-bold text-[var(--color-text-primary)]"
          style={{ fontSize: 'var(--text-subtitle)' }}
        >
          Session expiring
        </h2>

        <p
          id="idle-warning-desc"
          className="mb-6 leading-relaxed text-[var(--color-text-secondary)]"
          style={{ fontSize: 'var(--text-body)' }}
        >
          You&apos;ve been inactive for 13 minutes. You&apos;ll be signed out
          in{' '}
          <strong className="text-[var(--color-text-primary)]">
            {secondsRemaining} second{secondsRemaining !== 1 ? 's' : ''}
          </strong>
          .
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            ref={stayBtnRef}
            type="button"
            variant="primary"
            size="md"
            className="flex-1"
            onClick={resetTimer}
          >
            Stay signed in
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={handleSignOut}
          >
            Sign out now
          </Button>
        </div>
      </div>
    </div>
  )
}
