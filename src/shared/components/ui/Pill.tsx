import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

type PillVariant = 'green' | 'amber' | 'red' | 'neutral'

type PillProps = {
  variant?: PillVariant
  children: ReactNode
  className?: string
}

const variantTextClasses: Record<PillVariant, string> = {
  green: 'text-[var(--color-green)]',
  amber: 'text-[var(--color-amber)]',
  red: 'text-[var(--color-red)]',
  neutral: 'text-[var(--color-text-tertiary)]',
}

const variantDotClasses: Record<PillVariant, string> = {
  green: 'bg-[var(--color-green)]',
  amber: 'bg-[var(--color-amber)]',
  red: 'bg-[var(--color-red)]',
  neutral: 'bg-[var(--color-text-tertiary)]',
}

export function Pill({
  variant = 'neutral',
  children,
  className,
}: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 py-2 px-3.5 rounded-[20px] font-semibold min-h-[32px]',
        'bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]',
        variantTextClasses[variant],
        className
      )}
      style={{ fontSize: 'var(--text-caption)' }}
    >
      <span
        className={cn('shrink-0 rounded-full w-[7px] h-[7px]', variantDotClasses[variant])}
        aria-hidden
      />
      {children}
    </span>
  )
}
