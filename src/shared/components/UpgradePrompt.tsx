import { useNavigate } from 'react-router-dom'
import type { SubscriptionTier } from '@/shared/types/subscription'

interface UpgradePromptProps {
  feature: string
  requiredTier?: SubscriptionTier
  className?: string
}

/**
 * Inline upgrade nudge shown when a user tries to access a gated feature.
 * Renders a lock icon, feature name, required tier, and an Upgrade button
 * that navigates to the subscription management page.
 */
export function UpgradePrompt({ feature, requiredTier = 'basic', className = '' }: UpgradePromptProps) {
  const navigate = useNavigate()
  const tierLabel = requiredTier === 'pro' ? 'Pro' : 'Basic'

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 py-3 ${className}`}
      role="status"
      aria-label={`${feature} requires ${tierLabel} plan`}
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0" aria-hidden
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <p className="flex-1 text-[var(--color-text-secondary)] [font-size:var(--text-label)] leading-snug">
        <span className="font-semibold text-[var(--color-text-primary)]">{feature}</span>
        {' '}requires {tierLabel} or higher.
      </p>
      <button
        type="button"
        onClick={() => navigate('/subscription')}
        className="shrink-0 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold [font-size:var(--text-caption)] px-3 py-1.5 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] hover:opacity-90 active:scale-95 transition-transform"
      >
        Upgrade
      </button>
    </div>
  )
}
