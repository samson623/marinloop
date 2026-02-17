import { useEffect, useRef } from 'react'
import { isIOS } from '@/shared/lib/device'

const ADD_TO_HOME_SEEN_KEY = 'medflow_add_to_home_seen'

export function getAddToHomeScreenSeen(): boolean {
  try {
    return !!localStorage.getItem(ADD_TO_HOME_SEEN_KEY)
  } catch {
    return false
  }
}

export function setAddToHomeScreenSeen(): void {
  try {
    localStorage.setItem(ADD_TO_HOME_SEEN_KEY, '1')
  } catch {
    // ignore
  }
}

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
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onDismiss()
  }

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-home-title"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'var(--color-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        ref={wrapperRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 16,
          maxWidth: 400,
          width: '100%',
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
      >
        <h2
          id="add-to-home-title"
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            marginBottom: 16,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>

        {isIOSDevice ? (
          <>
            <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              To get medication reminders, add MedFlow to your home screen:
            </p>
            <ol
              style={{
                fontSize: 15,
                color: 'var(--color-text-primary)',
                marginLeft: 20,
                marginBottom: 20,
                lineHeight: 1.7,
              }}
            >
              <li>Tap the <strong>Share</strong> button at the bottom of the screen.</li>
              <li>Tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong>.</li>
            </ol>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              Then open MedFlow from the new icon on your home screen.
            </p>
          </>
        ) : canInstall && onInstall ? (
          <>
            <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              Add MedFlow to your phone to get reminders.
            </p>
            <button
              type="button"
              onClick={handleInstallClick}
              style={{
                width: '100%',
                padding: 14,
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Add MedFlow to your phone
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              Open the browser menu (three dots) and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.
            </p>
            <p style={{ fontSize: 14, color: 'var(--color-text-tertiary)', marginBottom: 20, lineHeight: 1.5 }}>
              Then open MedFlow from the new icon to get reminders.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={onDismiss}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
          }}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  )
}
