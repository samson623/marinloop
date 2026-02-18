import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  'aria-label': string
  children: ReactNode
}

/**
 * Icon-only button with required aria-label for accessibility.
 * Use for notifications, theme toggle, profile, close, etc.
 */
export function IconButton({ children, style, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'pointer',
        background: 'var(--color-bg-tertiary)',
        color: 'var(--color-text-secondary)',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}
