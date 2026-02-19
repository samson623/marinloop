import { useThemeStore } from '@/shared/stores/theme-store'
import { IconButton } from '@/shared/components/IconButton'
import { Button } from '@/shared/components/ui'

type LandingScreenProps = {
  onGetStarted: () => void
}

export function LandingScreen({ onGetStarted }: LandingScreenProps) {
  const { toggleTheme } = useThemeStore()

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--color-bg-primary)] p-6 sm:p-8 md:p-10 min-h-screen safe-x"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <IconButton
        size="lg"
        aria-label="Toggle theme"
        onClick={toggleTheme}
        className="absolute top-[max(1.25rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      </IconButton>

      <div className="w-full max-w-[400px] sm:max-w-[440px] flex flex-col items-center text-center">
        <div className="flex items-center justify-center gap-2 mb-4 sm:mb-5">
          <h1 className="font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]" style={{ fontSize: 'var(--text-display)' }}>
            MedFlow
          </h1>
          <span
            className="animate-dot-pulse w-2.5 h-2.5 rounded-sm bg-[var(--color-accent)] shrink-0"
            aria-hidden
          />
        </div>
        <p className="text-[var(--color-text-secondary)] mb-3 sm:mb-4 leading-snug max-w-[320px] sm:max-w-none [font-size:var(--text-body)]">
          Stay on time. Stay safe. Stay confident.
        </p>
        <p className="text-[var(--color-text-tertiary)] mb-6 leading-snug max-w-[280px] sm:max-w-none [font-size:var(--text-label)]">
          Medication reminders and daily care in one place.
        </p>
        <p className="text-[var(--color-text-tertiary)] mb-10 sm:mb-12 md:mb-14 leading-snug max-w-[280px] sm:max-w-none [font-size:var(--text-caption)]">
          MedFlow Care provides reminders and tracking tools. Not medical advice.
        </p>

        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onGetStarted}
          className="w-full max-w-[280px] sm:max-w-[320px]"
        >
          Get started
        </Button>
      </div>
    </div>
  )
}
