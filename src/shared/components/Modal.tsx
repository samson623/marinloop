import * as Dialog from '@radix-ui/react-dialog'
import { useRef, type ReactNode } from 'react'

export type ModalVariant = 'center' | 'bottom'

type ModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  variant?: ModalVariant
  children: ReactNode
  /** Ref for the element that opened the modal; focus returns here on close. */
  triggerRef?: React.RefObject<HTMLElement | null>
  /** Optional custom close button; if not provided, a default icon close is rendered. */
  closeLabel?: string
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 500,
  background: 'var(--color-overlay)',
}

const contentBase: React.CSSProperties = {
  position: 'fixed',
  zIndex: 501,
  background: 'var(--color-bg-primary)',
  boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
}

const contentCenter: React.CSSProperties = {
  ...contentBase,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: 400,
  width: 'calc(100% - 48px)',
  maxHeight: '90vh',
  overflowY: 'auto',
  borderRadius: 16,
  border: '1px solid var(--color-border-primary)',
  padding: 24,
}

const contentBottom: React.CSSProperties = {
  ...contentBase,
  bottom: 0,
  left: 0,
  right: 0,
  width: '100%',
  maxWidth: 480,
  maxHeight: '88vh',
  margin: '0 auto',
  overflowY: 'auto',
  borderRadius: '16px 16px 0 0',
  border: 'none',
  padding: 0,
}

const headerStyle: React.CSSProperties = {
  padding: '4px 20px 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--color-border-primary)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: 0,
}

const closeButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-bg-tertiary)',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  borderRadius: '50%',
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  variant = 'bottom',
  children,
  triggerRef,
  closeLabel = 'Close',
}: ModalProps) {
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current
  const descId = description ? `modal-desc-${titleId}` : undefined

  const contentStyle = variant === 'center' ? contentCenter : contentBottom

  const handleCloseAutoFocus = (e: Event) => {
    if (triggerRef?.current) {
      e.preventDefault()
      triggerRef.current.focus()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content
          className={variant === 'bottom' ? 'animate-slide-up-sheet' : undefined}
          style={contentStyle}
          aria-labelledby={titleId}
          aria-describedby={descId || undefined}
          onCloseAutoFocus={handleCloseAutoFocus}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          {variant === 'bottom' && (
            <div style={{ width: 36, height: 4, background: 'var(--color-text-tertiary)', opacity: 0.3, margin: '10px auto', borderRadius: 4 }} aria-hidden />
          )}
          <div style={variant === 'bottom' ? headerStyle : { marginBottom: 16 }}>
            <Dialog.Title id={titleId} style={titleStyle}>
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description id={descId} className="sr-only">
                {description}
              </Dialog.Description>
            )}
            <Dialog.Close asChild>
              <button type="button" aria-label={closeLabel} style={closeButtonStyle}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </Dialog.Close>
          </div>
          <div style={variant === 'center' ? undefined : { padding: 20 }}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
