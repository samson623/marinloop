import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
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
  /** Called when an interaction occurs outside the dialog; call e.preventDefault() to suppress close. */
  onInteractOutside?: (e: Event) => void
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
  onInteractOutside,
}: ModalProps) {
  const id = useId()
  const titleId = `modal-title-${id.replace(/:/g, '')}`
  const descId = description ? `modal-desc-${titleId}` : undefined

  const resolvedVariant = useMemo(
    () => (variant === 'responsive' ? (isMobile() ? 'bottom' : 'center') : variant),
    [variant]
  )

  // Capture focus target before dialog opens (fallback when no triggerRef provided)
  const preFocusRef = useRef<Element | null>(null)

  const handleCloseAutoFocus = (e: Event) => {
    if (triggerRef?.current) {
      e.preventDefault()
      triggerRef.current.focus()
    } else if (preFocusRef.current && preFocusRef.current instanceof HTMLElement) {
      e.preventDefault()
      preFocusRef.current.focus()
    }
  }

  useEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      preFocusRef.current = document.activeElement
    }
  }, [open])

  // ── Swipe-to-dismiss for bottom sheet variant ──
  const dragY = useRef(0)
  const dragStartY = useRef(0)
  const dragStartTime = useRef(0)
  const isDragging = useRef(false)
  const [translateY, setTranslateY] = useState(0)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resolvedVariant !== 'bottom') return
    isDragging.current = true
    dragStartY.current = e.clientY
    dragStartTime.current = Date.now()
    dragY.current = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || resolvedVariant !== 'bottom') return
    const delta = e.clientY - dragStartY.current
    if (delta > 0) {
      dragY.current = delta
      setTranslateY(delta)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || resolvedVariant !== 'bottom') return
    isDragging.current = false
    const delta = e.clientY - dragStartY.current
    const elapsed = Date.now() - dragStartTime.current
    const velocity = elapsed > 0 ? delta / elapsed : 0
    if (delta > 100 || velocity > 0.5) {
      setTranslateY(0)
      onOpenChange(false)
    } else {
      setTranslateY(0)
    }
    dragY.current = 0
  }

  const closeButton = (
    <Dialog.Close asChild>
      <IconButton aria-label={closeLabel} size="md" className="!rounded-full shrink-0" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </IconButton>
    </Dialog.Close>
  )

  if (resolvedVariant === 'center') {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          {/* Overlay acts as flex centering container — no transform on Content, so fixed children position correctly */}
          <Dialog.Overlay className="fixed inset-0 z-[500] flex items-center justify-center bg-[var(--color-overlay)] p-6">
            <Dialog.Content
              className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] shadow-[0_20px_40px_rgba(0,0,0,0.15)] p-6"
              aria-labelledby={titleId}
              aria-describedby={descId || undefined}
              onCloseAutoFocus={handleCloseAutoFocus}
              onEscapeKeyDown={() => onOpenChange(false)}
              onInteractOutside={onInteractOutside}
            >
              {description && (
                <Dialog.Description id={descId} className="sr-only">
                  {description}
                </Dialog.Description>
              )}
              <div className="flex items-center justify-between gap-3 mb-4">
                <Dialog.Title
                  id={titleId}
                  className="m-0 font-bold text-[var(--color-text-primary)]"
                  style={{ fontSize: 'var(--text-subtitle)' }}
                >
                  {title}
                </Dialog.Title>
                {closeButton}
              </div>
              <div>{children}</div>
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[500] bg-[var(--color-overlay)]" />
        <Dialog.Content
          className={cn(
            'fixed z-[501] bg-[var(--color-bg-primary)] shadow-[0_20px_40px_rgba(0,0,0,0.15)]',
            'animate-slide-up-sheet bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-2xl border-none p-0 pt-[env(safe-area-inset-top)]'
          )}
          aria-labelledby={titleId}
          aria-describedby={descId || undefined}
          onCloseAutoFocus={handleCloseAutoFocus}
          onEscapeKeyDown={() => onOpenChange(false)}
          onInteractOutside={onInteractOutside}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={
            translateY > 0
              ? { transform: `translateY(${translateY}px)`, transition: 'none' }
              : undefined
          }
        >
          <div
            className="w-10 h-1 bg-[var(--color-text-tertiary)] opacity-30 mt-2 mb-3 mx-auto rounded-full"
            aria-hidden
          />
          <div className="py-1 px-5 pb-4 border-b border-[var(--color-border-primary)] flex items-center justify-between gap-3">
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
            {closeButton}
          </div>
          <div className="px-5 pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
