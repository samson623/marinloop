import { TIER_CONFIG } from '@/shared/types/subscription'
import type { SubscriptionTier } from '@/shared/types/subscription'
import { Button } from '@/shared/components/ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanPickerProps {
  currentTier: SubscriptionTier
  selectedTier: SubscriptionTier
  onSelect: (tier: SubscriptionTier) => void
  billingPeriod: 'monthly' | 'yearly'
  onBillingPeriodChange: (p: 'monthly' | 'yearly') => void
  onUpgrade: (tier: SubscriptionTier) => void
  isTrialing?: boolean
  trialDaysRemaining?: number | null
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(tier: SubscriptionTier, billingPeriod: 'monthly' | 'yearly'): string {
  const pricing = TIER_CONFIG[tier].pricing
  if (pricing.monthly === 0) return 'Free'
  if (billingPeriod === 'yearly') {
    return `$${pricing.yearly.toFixed(2)}/yr`
  }
  return `$${pricing.monthly.toFixed(2)}/mo`
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="8" fill="var(--color-accent)" opacity="0.15" />
      <path
        d="M4.5 8.5L6.5 10.5L11.5 5.5"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Plan card CTA logic
// ---------------------------------------------------------------------------

function getPlanCta(
  tier: SubscriptionTier,
  currentTier: SubscriptionTier,
  isTrialing: boolean,
  trialDaysRemaining: number | null | undefined,
): { label: string; disabled: boolean; isCurrent: boolean; isDowngrade: boolean } {
  if (currentTier === tier) {
    const trialSuffix =
      isTrialing && trialDaysRemaining != null
        ? ` — Trialing (${trialDaysRemaining}d left)`
        : ''
    return { label: `Current Plan${trialSuffix}`, disabled: true, isCurrent: true, isDowngrade: false }
  }

  const tierOrder: Record<SubscriptionTier, number> = { free: 0, basic: 1, pro: 2 }
  const isDowngrade = tierOrder[tier] < tierOrder[currentTier]

  if (isDowngrade) {
    return { label: 'Downgrade', disabled: true, isCurrent: false, isDowngrade: true }
  }

  if (tier === 'free') {
    return { label: 'Start Free', disabled: false, isCurrent: false, isDowngrade: false }
  }
  if (tier === 'basic') {
    return { label: 'Upgrade to Basic', disabled: false, isCurrent: false, isDowngrade: false }
  }
  return { label: 'Upgrade to Pro', disabled: false, isCurrent: false, isDowngrade: false }
}

// ---------------------------------------------------------------------------
// PlanCard sub-component
// ---------------------------------------------------------------------------

function PlanCard({
  tier,
  currentTier,
  selectedTier,
  billingPeriod,
  isTrialing,
  trialDaysRemaining,
  disabled,
  onSelect,
  onUpgrade,
}: {
  tier: SubscriptionTier
  currentTier: SubscriptionTier
  selectedTier: SubscriptionTier
  billingPeriod: 'monthly' | 'yearly'
  isTrialing: boolean
  trialDaysRemaining: number | null | undefined
  disabled: boolean
  onSelect: (t: SubscriptionTier) => void
  onUpgrade: (t: SubscriptionTier) => void
}) {
  const info = TIER_CONFIG[tier]
  const isSelected = selectedTier === tier
  const isCurrent = currentTier === tier
  const cta = getPlanCta(tier, currentTier, isTrialing, trialDaysRemaining)
  const priceDisplay = formatPrice(tier, billingPeriod)

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={() => onSelect(tier)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(tier)
        }
      }}
      className="flex flex-col gap-4 rounded-2xl p-5 cursor-pointer transition-all duration-150"
      style={{
        background: isSelected ? 'var(--color-accent-bg)' : 'var(--color-bg-secondary)',
        border: isSelected
          ? '2px solid var(--color-accent)'
          : '1.5px solid var(--color-border-primary)',
        outline: 'none',
      }}
    >
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-bold"
            style={{ fontSize: 'var(--text-subtitle)', color: 'var(--color-text-primary)' }}
          >
            {info.name}
          </span>
          {isCurrent && (
            <span
              className="rounded-full px-2.5 py-0.5 font-semibold"
              style={{
                background: 'var(--color-accent-bg)',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
                fontSize: 'var(--text-caption)',
              }}
            >
              Current
            </span>
          )}
        </div>
        <span
          className="font-semibold tabular-nums"
          style={{ fontSize: 'var(--text-title)', color: 'var(--color-accent)' }}
        >
          {priceDisplay}
        </span>
      </div>

      {/* Feature list */}
      <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {info.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <CheckIcon />
            <span style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-auto pt-1">
        {cta.isDowngrade ? (
          <div title="Contact support to downgrade">
            <Button
              variant="secondary"
              size="sm"
              disabled
              onClick={(e) => e.stopPropagation()}
            >
              {cta.label}
            </Button>
          </div>
        ) : cta.isCurrent ? (
          <Button
            variant="secondary"
            size="sm"
            disabled
            onClick={(e) => e.stopPropagation()}
          >
            {cta.label}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation()
              onUpgrade(tier)
            }}
          >
            {cta.label}
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PlanPicker({
  currentTier,
  selectedTier,
  onSelect,
  billingPeriod,
  onBillingPeriodChange,
  onUpgrade,
  isTrialing = false,
  trialDaysRemaining = null,
  disabled = false,
}: PlanPickerProps) {
  const tiers: SubscriptionTier[] = ['free', 'basic', 'pro']

  return (
    <div data-testid="plan-picker" className="flex flex-col gap-5">
      {/* Billing period toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onBillingPeriodChange('monthly')}
          className="rounded-full px-4 py-1.5 font-semibold transition-all"
          style={{
            background: billingPeriod === 'monthly' ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
            color: billingPeriod === 'monthly' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            border: '1.5px solid var(--color-border-primary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
          }}
          aria-pressed={billingPeriod === 'monthly'}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onBillingPeriodChange('yearly')}
          className="flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold transition-all"
          style={{
            background: billingPeriod === 'yearly' ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
            color: billingPeriod === 'yearly' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            border: '1.5px solid var(--color-border-primary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
          }}
          aria-pressed={billingPeriod === 'yearly'}
        >
          Yearly
          <span
            className="rounded-full px-2 py-0.5 font-semibold"
            style={{
              background: billingPeriod === 'yearly' ? 'rgba(255,255,255,0.25)' : 'var(--color-accent-bg)',
              color: billingPeriod === 'yearly' ? 'var(--color-text-inverse)' : 'var(--color-accent)',
              fontSize: 'var(--text-caption)',
            }}
          >
            Save ~17%
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div
        role="radiogroup"
        aria-label="Subscription plans"
        className="grid gap-4 sm:grid-cols-3"
      >
        {tiers.map((tier) => (
          <PlanCard
            key={tier}
            tier={tier}
            currentTier={currentTier}
            selectedTier={selectedTier}
            billingPeriod={billingPeriod}
            isTrialing={isTrialing}
            trialDaysRemaining={trialDaysRemaining}
            disabled={disabled}
            onSelect={onSelect}
            onUpgrade={onUpgrade}
          />
        ))}
      </div>
    </div>
  )
}
