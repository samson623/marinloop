import { useState } from 'react'
import { FeedbackModal } from '@/shared/components/FeedbackModal'

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] w-12 h-12 rounded-full flex items-center justify-center bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] cursor-pointer z-[95] shadow-[0_2px_8px_rgba(0,0,0,0.1)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
