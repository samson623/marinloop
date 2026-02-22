import * as Dialog from '@radix-ui/react-dialog'
import { useId, useMemo, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { IconButton } from '@/shared/components/IconButton'
import { isMobile } from '@/shared/lib/device'

export type ModalVariant = 'center' | 'bottom' | 'responsive'

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
  const id = useId()
  const titleId = `modal-title-${id.replace(/:/g, '')}`
  const descId = description ? `modal-desc-${titleId}` : undefined

  const resolvedVariant = useMemo(
    () => (variant === 'responsive' ? (isMobile() ? 'bottom' : 'center') : variant),
    [variant]
  )

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
            resolvedVariant === 'center'
              ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[min(520px,calc(100vw-2rem))] w-[calc(100%-48px)] max-h-[90vh] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-border-primary)] p-6'
              : 'animate-slide-up-sheet bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-2xl border-none p-0 pt-[env(safe-area-inset-top)]'
          )}
          aria-labelledby={titleId}
          aria-describedby={descId || undefined}
          onCloseAutoFocus={handleCloseAutoFocus}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          {resolvedVariant === 'bottom' && (
            <div
              className="w-10 h-1 bg-[var(--color-text-tertiary)] opacity-30 mt-2 mb-3 mx-auto rounded-full"
              aria-hidden
            />
          )}
          <div
            className={cn(
              'flex items-center justify-between gap-3',
              resolvedVariant === 'bottom'
                ? 'py-1 px-5 pb-4 border-b border-[var(--color-border-primary)]'
                : 'mb-4'
            )}
          >
            <Dialog.Title
              id={titleId}
              className="m-0 font-bold text-[var(--color-text-primary)]"
              style={{ fontSize: 'var(--text-subtitle)' }}
            >
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description id={descId} className="sr-only">
                {description}
              </Dialog.Description>
            )}
            <Dialog.Close asChild>
              <IconButton aria-label={closeLabel} size="md" className="!rounded-full shrink-0" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </IconButton>
            </Dialog.Close>
          </div>
          <div className={resolvedVariant === 'center' ? undefined : 'px-5 pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]'}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
