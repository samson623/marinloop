import { forwardRef } from 'react'
import { cn } from '@/shared/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string
}

/**
 * Text input that matches the design system (.fi styles).
 * Use for all form text inputs for consistent focus and placeholder styling.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn('fi', className)}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
