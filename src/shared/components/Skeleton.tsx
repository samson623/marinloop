import { cn } from '@/shared/lib/utils'

/* ─── Inject shimmer keyframes once ─────────────────────────────────────── */
let _injected = false
function injectShimmerStyles() {
  if (_injected || typeof document === 'undefined') return
  _injected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes shimmer {
      0%   { background-position: 200% 0 }
      100% { background-position: -200% 0 }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-shimmer {
        animation: none !important;
      }
    }
  `
  document.head.appendChild(style)
}

/* ─── Shared shimmer style applied to every skeleton element ─────────────── */
const SHIMMER_CLASSES =
  'skeleton-shimmer rounded-xl bg-[var(--color-bg-secondary)]'

const shimmerStyle: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary) 50%, var(--color-bg-secondary) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 2s infinite',
}

/* ─── Base rectangle ─────────────────────────────────────────────────────── */
export function SkeletonBase({
  className,
  width,
  height,
}: {
  className?: string
  width?: string
  height?: string
}) {
  injectShimmerStyles()
  return (
    <div
      className={cn(SHIMMER_CLASSES, className)}
      style={{ ...shimmerStyle, width, height }}
      aria-hidden="true"
    />
  )
}

/* ─── Text line ──────────────────────────────────────────────────────────── */
const TEXT_WIDTH_MAP: Record<string, string> = {
  full: '100%',
  '3/4': '75%',
  '1/2': '50%',
  '1/3': '33.333%',
  '1/4': '25%',
}

export function SkeletonText({
  width = 'full',
  className,
}: {
  width?: 'full' | '3/4' | '1/2' | '1/3' | '1/4'
  className?: string
}) {
  injectShimmerStyles()
  return (
    <div
      className={cn(SHIMMER_CLASSES, 'h-[14px]', className)}
      style={{ ...shimmerStyle, width: TEXT_WIDTH_MAP[width] }}
      aria-hidden="true"
    />
  )
}

/* ─── Circle ─────────────────────────────────────────────────────────────── */
export function SkeletonCircle({
  size = 40,
  className,
}: {
  size?: number
  className?: string
}) {
  injectShimmerStyles()
  return (
    <div
      className={cn('skeleton-shimmer rounded-full flex-shrink-0', className)}
      style={{ ...shimmerStyle, width: size, height: size }}
      aria-hidden="true"
    />
  )
}

/* ─── Card with lines ────────────────────────────────────────────────────── */
export function SkeletonCard({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  injectShimmerStyles()
  const widths: Array<'full' | '3/4' | '1/2' | '1/3' | '1/4'> = [
    'full',
    '3/4',
    '1/2',
    '3/4',
    'full',
  ]
  return (
    <div
      className={cn(
        'bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-2xl p-4 space-y-3',
        className
      )}
      aria-hidden="true"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonText key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  )
}

/* ─── Stat card (3-up grid in SummaryView) ───────────────────────────────── */
export function SkeletonStatCard({ className }: { className?: string }) {
  injectShimmerStyles()
  return (
    <div
      className={cn(
        'bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-2xl p-5 text-center flex flex-col items-center gap-2',
        className
      )}
      aria-hidden="true"
    >
      {/* Large number placeholder */}
      <div
        className={cn(SHIMMER_CLASSES, 'h-8 w-8 rounded-lg')}
        style={shimmerStyle}
      />
      {/* Label placeholder */}
      <div
        className={cn(SHIMMER_CLASSES, 'h-[11px] w-14 rounded')}
        style={shimmerStyle}
      />
    </div>
  )
}

/* ─── Chart bar column (7-day adherence) ─────────────────────────────────── */
export function SkeletonChartBar({ className }: { className?: string }) {
  injectShimmerStyles()
  return (
    <div
      className={cn('flex-1 flex flex-col items-center justify-end h-full gap-1', className)}
      aria-hidden="true"
    >
      {/* Percentage label placeholder */}
      <div
        className={cn(SHIMMER_CLASSES, 'h-[12px] w-7 rounded mb-1')}
        style={shimmerStyle}
      />
      {/* Bar — random-ish height via nth pattern */}
      <div
        className={cn(SHIMMER_CLASSES, 'w-full rounded-full')}
        style={{ ...shimmerStyle, height: '40%', minHeight: 4 }}
      />
      {/* Day label placeholder */}
      <div
        className={cn(SHIMMER_CLASSES, 'h-[12px] w-4 rounded mt-1')}
        style={shimmerStyle}
      />
    </div>
  )
}

/* ─── Appointment card skeleton ──────────────────────────────────────────── */
export function SkeletonApptCard({ className }: { className?: string }) {
  injectShimmerStyles()
  return (
    <div
      className={cn(
        'w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] border-l-4 border-l-[var(--color-bg-tertiary)] rounded-2xl p-4 mb-3 min-h-[80px] flex flex-col gap-2',
        className
      )}
      aria-hidden="true"
    >
      {/* Date/time line */}
      <SkeletonText width="1/3" className="h-[13px]" />
      {/* Title line */}
      <SkeletonText width="3/4" className="h-[16px]" />
      {/* Location line */}
      <SkeletonText width="1/2" className="h-[13px]" />
    </div>
  )
}

/* ─── Note row skeleton ──────────────────────────────────────────────────── */
export function SkeletonNoteRow({ className }: { className?: string }) {
  injectShimmerStyles()
  return (
    <div
      className={cn(
        'mb-4 pb-4 border-b border-[var(--color-border-secondary)] last:border-0 last:mb-0 last:pb-0 flex flex-col gap-2',
        className
      )}
      aria-hidden="true"
    >
      {/* Title + timestamp row */}
      <div className="flex items-center justify-between gap-3">
        <SkeletonText width="1/3" className="h-[14px]" />
        <SkeletonText width="1/4" className="h-[12px]" />
      </div>
      {/* Content line 1 */}
      <SkeletonText width="full" className="h-[13px]" />
      {/* Content line 2 (shorter) */}
      <SkeletonText width="3/4" className="h-[13px]" />
    </div>
  )
}
