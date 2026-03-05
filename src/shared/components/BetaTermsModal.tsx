import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { Button } from '@/shared/components/ui'

const STORAGE_KEY = 'marinloop_beta_terms_accepted'

export function useBetaTermsAccepted() {
  const [accepted, setAccepted] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setAccepted(true)
  }

  return { accepted, accept }
}

export function BetaTermsModal({ onAccept }: { onAccept: () => void }) {
  return (
    <Dialog.Root open modal>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[600] bg-[var(--color-overlay)]" />
        <Dialog.Content
          className="fixed z-[601] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[min(520px,calc(100vw-2rem))] w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-border-primary)] p-6 bg-[var(--color-bg-primary)] shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-labelledby="beta-terms-title"
          aria-describedby="beta-terms-desc"
        >
          <Dialog.Title
            id="beta-terms-title"
            className="font-bold text-[var(--color-text-primary)] mb-4"
            style={{ fontSize: 'var(--text-subtitle)' }}
          >
            Beta Program Terms
          </Dialog.Title>
          <Dialog.Description id="beta-terms-desc" className="sr-only">
            Please read and accept the marinloop beta program terms to continue.
          </Dialog.Description>

          <div className="space-y-3 text-[var(--color-text-secondary)] leading-relaxed mb-6" style={{ fontSize: 'var(--text-body)' }}>
            <p className="font-semibold text-[var(--color-text-primary)]">
              Welcome to the marinloop beta. Please read before continuing.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>marinloop is <strong>pre-release software</strong> and may contain bugs or unexpected behavior.</li>
              <li>This service is <strong>not a medical device</strong> and is not intended to diagnose, treat, cure, or prevent any disease or health condition.</li>
              <li>Always follow your healthcare provider&apos;s instructions. <strong>Do not rely solely on this app for medication management.</strong></li>
              <li>Your data is stored on Supabase infrastructure and is <strong>not covered by a HIPAA Business Associate Agreement</strong> during this beta. Do not enter sensitive protected health information.</li>
              <li>Beta data may be reset or deleted before general availability.</li>
              <li>By continuing you agree to provide honest feedback to help improve the product.</li>
            </ul>
            <p className="text-[var(--color-text-tertiary)]" style={{ fontSize: 'var(--text-caption)' }}>
              You can review these terms again in Profile &rarr; Data &amp; Privacy.
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={onAccept}
          >
            I understand &mdash; Continue to marinloop
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
