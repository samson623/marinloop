import * as Dialog from '@radix-ui/react-dialog'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { IconButton } from '@/shared/components/IconButton'

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

  const handleCloseAutoFocus = (e: Event) => {
    if (triggerRef?.current) {
      e.preventDefault()
      triggerRef.current.focus()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[500] bg-[var(--color-overlay)]"
        />
        <Dialog.Content
          className={cn(
            'fixed z-[501] bg-[var(--color-bg-primary)] shadow-[0_20px_40px_rgba(0,0,0,0.15)]',
            variant === 'center'
              ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[400px] w-[calc(100%-48px)] max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border-primary)] p-6'
              : 'animate-slide-up-sheet bottom-0 left-0 right-0 w-full max-w-[480px] max-h-[88vh] mx-auto overflow-y-auto rounded-t-2xl border-none p-0'
          )}
          aria-labelledby={titleId}
          aria-describedby={descId || undefined}
          onCloseAutoFocus={handleCloseAutoFocus}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          {variant === 'bottom' && (
            <div
              className="w-9 h-1 bg-[var(--color-text-tertiary)] opacity-30 my-2.5 mx-auto rounded"
              aria-hidden
            />
          )}
          <div
            className={cn(
              'flex items-center justify-between',
              variant === 'bottom'
                ? 'py-1 px-5 pb-3.5 border-b border-[var(--color-border-primary)]'
                : 'mb-4'
            )}
          >
            <Dialog.Title
              id={titleId}
              className="text-[17px] font-bold text-[var(--color-text-primary)] m-0"
            >
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description id={descId} className="sr-only">
                {description}
              </Dialog.Description>
            )}
            <Dialog.Close asChild>
              <IconButton aria-label={closeLabel} size="sm" className="!w-[30px] !h-[30px] !rounded-full" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </IconButton>
            </Dialog.Close>
          </div>
          <div className={variant === 'center' ? undefined : 'p-5'}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
