import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { Button } from '@/shared/components/ui'

const AI_CONSENT_KEY = 'marinloop_ai_consent_given'
const AI_CONSENT_DECLINED_KEY = 'marinloop_ai_consent_declined'

export function useAIConsent() {
  const [consented, setConsented] = useState<boolean>(() => {
    try { return localStorage.getItem(AI_CONSENT_KEY) === '1' } catch { return false }
  })
  const [declined, setDeclinedState] = useState<boolean>(() => {
    try { return localStorage.getItem(AI_CONSENT_DECLINED_KEY) === '1' } catch { return false }
  })

  const setDeclined = (val: boolean) => {
    try { localStorage.setItem(AI_CONSENT_DECLINED_KEY, val ? '1' : '0') } catch { /* ignore */ }
    setDeclinedState(val)
  }

  const consent = () => {
    try { localStorage.setItem(AI_CONSENT_KEY, '1') } catch { /* ignore */ }
    try { localStorage.removeItem(AI_CONSENT_DECLINED_KEY) } catch { /* ignore */ }
    setConsented(true)
    setDeclinedState(false)
  }

  const revoke = () => {
    try { localStorage.removeItem(AI_CONSENT_KEY) } catch { /* ignore */ }
    setConsented(false)
  }

  return { consented, declined, setDeclined, consent, revoke }
}

export function AIConsentModal({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <Dialog.Root open modal>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[600] bg-[var(--color-overlay)]" />
        <Dialog.Content
          className="fixed z-[601] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[min(520px,calc(100vw-2rem))] w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-border-primary)] p-6 bg-[var(--color-bg-primary)] shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-labelledby="ai-consent-title"
          aria-describedby="ai-consent-desc"
        >
          <Dialog.Title
            id="ai-consent-title"
            className="font-bold text-[var(--color-text-primary)] mb-4"
            style={{ fontSize: 'var(--text-subtitle)' }}
          >
            AI Features — Data Disclosure
          </Dialog.Title>
          <Dialog.Description id="ai-consent-desc" className="sr-only">
            Please review how AI features process your medication data before enabling them.
          </Dialog.Description>

          <div className="space-y-3 text-[var(--color-text-secondary)] leading-relaxed mb-6" style={{ fontSize: 'var(--text-body)' }}>
            <p className="font-semibold text-[var(--color-text-primary)]">
              MarinLoop uses AI to power insights, label scanning, and voice commands.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>What is sent:</strong> Medication names, dosages, schedules, notes, and images of prescription labels may be sent to OpenAI&apos;s API servers for processing.</li>
              <li><strong>Third-party processing:</strong> OpenAI is not a HIPAA-covered entity. Data is processed per OpenAI&apos;s privacy policy (openai.com/privacy).</li>
              <li><strong>What not to include:</strong> Do not enter real patient names, MRN numbers, Social Security numbers, or other sensitive personal identifiers.</li>
              <li><strong>Optional:</strong> AI features are optional. Core medication tracking, scheduling, and reminders work without AI.</li>
              <li><strong>Revoke anytime:</strong> You can withdraw consent at any time in Profile &rarr; Data &amp; Privacy.</li>
            </ul>
            <p className="text-[var(--color-text-tertiary)]" style={{ fontSize: 'var(--text-caption)' }}>
              This consent applies to adherence insights, medication label extraction, pill identification, and AI-powered voice commands.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={onAccept}
            >
              I agree &mdash; enable AI features
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              onClick={onDecline}
            >
              No thanks &mdash; skip AI features
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
