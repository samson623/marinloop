import { useSubscription } from '@/shared/hooks/useSubscription'

export function ProfileSwitcher() {
  const { tier } = useSubscription()

  if (tier !== 'pro') return null

  return (
    <div
      title="Care Giver Mode — Coming Soon"
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] cursor-default select-none opacity-70"
    >
      <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] whitespace-nowrap">
        Care Giver Mode
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-[var(--color-accent)] text-[var(--color-text-inverse)] opacity-80">
        Soon
      </span>
    </div>
  )
}
