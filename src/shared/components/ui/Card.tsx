import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean
  children: ReactNode
}

export function Card({
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-2xl p-4',
        interactive && 'card-interactive cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
