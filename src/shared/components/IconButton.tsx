import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

type IconButtonSize = 'sm' | 'md' | 'lg'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  'aria-label': string
  children: ReactNode
  size?: IconButtonSize
  className?: string
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'w-8 h-8 rounded-[10px]',
  md: 'w-[38px] h-[38px] rounded-[12px]',
  lg: 'w-10 h-10 rounded-[50%]',
}

/**
 * Icon-only button with required aria-label for accessibility.
 * Use for notifications, theme toggle, profile, close, etc.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      size = 'md',
      className,
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center border-none cursor-pointer outline-none transition-colors duration-120',
          'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-bg-elevated)] active:scale-95',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
