import { isIOS } from '@/shared/lib/device'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/Button'

export type AddToHomeScreenVariant = 'onboarding' | 'push-failed'

type AddToHomeScreenPromptProps = {
  onDismiss: () => void
  variant?: AddToHomeScreenVariant
  canInstall?: boolean
  onInstall?: () => Promise<boolean>
}

export function AddToHomeScreenPrompt({
  onDismiss,
  variant = 'onboarding',
  canInstall = false,
  onInstall,
}: AddToHomeScreenPromptProps) {
  const isIOSDevice = isIOS()
  const title = variant === 'push-failed'
    ? 'Enable reminders on this phone'
    : 'Get reminders on this phone'
  const dismissLabel = variant === 'push-failed' ? "I've done it" : 'Got it'

  const handleInstallClick = async () => {
    if (onInstall) {
      const accepted = await onInstall()
      if (accepted) onDismiss()
    } else {
      onDismiss()
    }
  }

  return (
    <Modal open onOpenChange={(o) => !o && onDismiss()} title={title} variant={variant === 'push-failed' ? 'bottom' : 'center'}>
      <div className="flex flex-col gap-4">
        {isIOSDevice ? (
          <>
            <p className="text-[15px] text-[var(--color-text-secondary)] mb-0 leading-snug">
              To get medication reminders, add MedFlow to your home screen:
            </p>
            <ol className="text-[15px] text-[var(--color-text-primary)] ml-5 mb-0 list-decimal leading-relaxed">
              <li>Tap the <strong>Share</strong> button at the bottom of the screen.</li>
              <li>Tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong>.</li>
            </ol>
            <p className="text-sm text-[var(--color-text-secondary)] mb-0 leading-snug">
              Then open MedFlow from the new icon on your home screen.
            </p>
          </>
        ) : canInstall && onInstall ? (
          <>
            <p className="text-[15px] text-[var(--color-text-secondary)] mb-0 leading-snug">
              Add MedFlow to your phone to get reminders.
            </p>
            <Button type="button" onClick={handleInstallClick} variant="primary" size="lg">
              Add MedFlow to your phone
            </Button>
          </>
        ) : (
          <>
            <p className="text-[15px] text-[var(--color-text-secondary)] mb-0 leading-snug">
              Open the browser menu (three dots) and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)] mb-0 leading-snug">
              Then open MedFlow from the new icon to get reminders.
            </p>
          </>
        )}

        <Button type="button" onClick={onDismiss} variant="secondary" size="md">
          {dismissLabel}
        </Button>
      </div>
    </Modal>
  )
}
