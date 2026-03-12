import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSubscription } from '@/shared/hooks/useSubscription'
import { useAppStore } from '@/shared/stores/app-store'
import { PlanPicker } from '@/shared/components/PlanPicker'
import { TIER_CONFIG } from '@/shared/types/subscription'
import type { SubscriptionTier } from '@/shared/types/subscription'
import { Button } from '@/shared/components/ui'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CurrentPlanPill({
  tier,
  isTrialing,
  trialDaysRemaining,
}: {
  tier: SubscriptionTier
  isTrialing: boolean
  trialDaysRemaining: number | null
}) {
  const label = isTrialing && trialDaysRemaining != null
    ? `${TIER_CONFIG[tier].name} — Trial (${trialDaysRemaining}d left)`
    : TIER_CONFIG[tier].name

  return (
    <div className="flex justify-center">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold"
        style={{
          background: 'var(--color-accent-bg)',
          color: 'var(--color-accent)',
          border: '1px solid var(--color-accent)',
          fontSize: 'var(--text-body)',
        }}
      >
        Current plan: {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function SubscriptionView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isOnboarding = searchParams.get('onboarding') === '1'

  const { tier, isTrialing, trialDaysRemaining } = useSubscription()
  const toast = useAppStore((s) => s.toast)

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(tier)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [upgrading, setUpgrading] = useState(false)

  function handleUpgrade() {
    setUpgrading(true)
    toast('Stripe integration coming soon.', 'tw')
    // Reset after brief delay so the disabled state is visible
    setTimeout(() => setUpgrading(false), 1200)
  }

  return (
    <div
      data-testid="subscription-view"
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b"
        style={{
          background: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)',
        }}
      >
        {isOnboarding ? (
          <span
            className="font-bold"
            style={{ fontSize: 'var(--text-subtitle)', color: 'var(--color-accent)' }}
          >
            MarinLoop
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-auto"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ← Back
          </Button>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 w-full max-w-[480px] mx-auto flex flex-col gap-6">
        {/* Heading */}
        <div className="flex flex-col gap-1.5 text-center">
          <h1
            className="font-bold"
            style={{ fontSize: 'var(--text-title)', color: 'var(--color-text-primary)' }}
          >
            {isOnboarding ? 'Choose your plan' : 'Subscription'}
          </h1>
          {isOnboarding && (
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
              Start free — upgrade anytime. No credit card required for the free plan.
            </p>
          )}
        </div>

        {/* Current plan summary — non-onboarding only */}
        {!isOnboarding && (
          <CurrentPlanPill
            tier={tier}
            isTrialing={isTrialing}
            trialDaysRemaining={trialDaysRemaining}
          />
        )}

        {/* Plan picker */}
        <PlanPicker
          currentTier={tier}
          selectedTier={selectedTier}
          onSelect={setSelectedTier}
          billingPeriod={billingPeriod}
          onBillingPeriodChange={setBillingPeriod}
          onUpgrade={handleUpgrade}
          isTrialing={isTrialing}
          trialDaysRemaining={trialDaysRemaining}
          disabled={upgrading}
        />

        {/* Skip link — onboarding only */}
        {isOnboarding && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/timeline')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-body)',
                color: 'var(--color-text-secondary)',
                textDecoration: 'underline',
                padding: '4px 8px',
              }}
            >
              Skip — continue with Free →
            </button>
          </div>
        )}

        {/* Fine print */}
        <p
          className="text-center"
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}
        >
          Prices shown in USD. Cancel anytime.
        </p>
      </main>
    </div>
  )
}
