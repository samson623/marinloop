import { useNavigate } from 'react-router-dom'
import { getPlatformLabel, isStandalone } from '@/shared/lib/device'
import { Button } from '@/shared/components/ui'

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] flex items-center justify-center font-bold [font-size:var(--text-label)]">
        {n}
      </span>
      <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] leading-relaxed pt-0.5">{text}</p>
    </div>
  )
}

export function InstallGuideScreen() {
  const platform = getPlatformLabel()
  const installed = isStandalone()
  const navigate = useNavigate()

  if (installed) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-primary)] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="font-extrabold text-[var(--color-text-primary)] mb-3" style={{ fontSize: 'var(--text-title)' }}>
          You&apos;re all set!
        </h1>
        <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] mb-6 max-w-[280px]">
          marinloop is installed and running from your home screen.
        </p>
        <Button variant="primary" size="lg" onClick={() => navigate('/landing')}>
          Continue to marinloop
        </Button>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto bg-[var(--color-bg-primary)]"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-[420px] mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-text-inverse)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]" style={{ fontSize: 'var(--text-title)' }}>
            Install marinloop
          </h1>
        </div>

        <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] mb-6 leading-relaxed">
          Add marinloop to your home screen for the best experience, including push notification reminders.
        </p>

        {platform === 'iOS' && (
          <>
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl p-4 mb-4">
              <p className="font-bold text-[var(--color-amber)] [font-size:var(--text-label)] mb-2 uppercase tracking-[0.05em]">
                Important: Use Safari
              </p>
              <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)]">
                Installation on iOS only works in Safari, not Chrome or Firefox.
              </p>
            </div>
            <div className="space-y-4">
              <Step n={1} text="Open marinloop.com in Safari on your iPhone or iPad." />
              <Step n={2} text="Tap the Share button (the square with an arrow) in Safari's bottom toolbar." />
              <Step n={3} text="Scroll down in the share sheet and tap Add to Home Screen." />
              <Step n={4} text="Tap Add in the top-right corner of the dialog." />
              <Step n={5} text="Open marinloop from your home screen (not Safari)." />
              <Step n={6} text="Go to Profile and enable Push Notifications. iOS requires the app to be open from the home screen icon." />
            </div>
            <div className="mt-5 p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]">
              <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] leading-relaxed">
                Push notifications on iOS require iOS 16.4 or later.
              </p>
            </div>
          </>
        )}

        {platform === 'Android' && (
          <div className="space-y-4">
            <Step n={1} text="Open marinloop.com in Chrome on your Android device." />
            <Step n={2} text="Tap the three-dot menu (\u22ee) in the top-right corner of Chrome." />
            <Step n={3} text="Tap Add to Home Screen or Install app." />
            <Step n={4} text="Tap Install in the prompt that appears." />
            <Step n={5} text="Open marinloop from your home screen or app drawer and enable notifications when prompted." />
          </div>
        )}

        {platform === 'Desktop' && (
          <div className="space-y-4">
            <Step n={1} text="In Chrome or Edge, look for the install icon (\u2295) in the address bar." />
            <Step n={2} text="Click it, then click Install in the dialog." />
            <Step n={3} text="marinloop will open as a standalone app window." />
            <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] leading-relaxed pt-2">
              Alternatively: open the browser menu and choose Install marinloop or Add to Desktop.
            </p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-[var(--color-border-primary)]">
          <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/landing')}>
            Go to marinloop
          </Button>
        </div>
      </div>
    </div>
  )
}
