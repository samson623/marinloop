import { forwardRef } from 'react'
import { cn } from '@/shared/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-none hover:opacity-95 active:opacity-90',
  secondary:
    'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[1.5px] border-[var(--color-border-primary)] hover:bg-[var(--color-bg-tertiary)] active:bg-[var(--color-border-secondary)]',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] border-none hover:bg-[var(--color-bg-tertiary)] active:bg-[var(--color-bg-tertiary)]',
  danger:
    'bg-[var(--color-red-bg)] text-[var(--color-red)] border border-[var(--color-red-border)] hover:opacity-90 active:opacity-80',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-3 min-h-[44px] rounded-xl',
  md: 'px-5 py-3.5 min-h-[48px] rounded-xl',
  lg: 'px-6 py-4 min-h-[52px] rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      className,
      children,
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
          'w-full inline-flex items-center justify-center font-semibold cursor-pointer outline-none transition-all duration-120',
          '[font-size:var(--text-body)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
          'tap-spring active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          variantClasses[variant],
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

Button.displayName = 'Button'
