import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '@/shared/hooks/useSubscription'

export function TrialBanner() {
  const { isTrialing, trialDaysRemaining } = useSubscription()
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  if (!isTrialing || dismissed) return null

  const urgent = trialDaysRemaining !== null && trialDaysRemaining <= 3

  let message: string
  if (trialDaysRemaining === 0) {
    message = 'Your trial ends today — upgrade now to keep access'
  } else if (trialDaysRemaining === 1) {
    message = 'Your trial ends tomorrow — upgrade now to keep access'
  } else if (urgent) {
    message = `Your trial ends in ${trialDaysRemaining} days — upgrade now to keep access`
  } else if (trialDaysRemaining !== null) {
    message = `${trialDaysRemaining} days left in your free trial — upgrade to keep access`
  } else {
    message = 'Your free trial is ending soon — upgrade to keep access'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center px-4 py-2 text-xs font-semibold text-white ${
        urgent ? 'bg-[var(--color-amber,#d97706)]' : 'bg-[var(--color-accent)]'
      }`}
    >
      <div className="max-w-[480px] mx-auto w-full flex items-center justify-between gap-3">
        <span>{message}</span>
        <div className="flex gap-2 items-center shrink-0">
          <button
            type="button"
            onClick={() => navigate('/subscription')}
            className="px-3.5 py-1.5 bg-white/25 text-white text-[13px] font-bold rounded-lg border-none cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Upgrade
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss trial banner"
            className="w-6 h-6 flex items-center justify-center bg-white/20 text-white rounded-full border-none cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white text-sm font-bold leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
