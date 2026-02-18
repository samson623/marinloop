import { useThemeStore } from '@/shared/stores/theme-store'
import { IconButton } from '@/shared/components/IconButton'
import { Button } from '@/shared/components/ui'

type LandingScreenProps = {
  onGetStarted: () => void
}

export function LandingScreen({ onGetStarted }: LandingScreenProps) {
  const { toggleTheme } = useThemeStore()

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--color-bg-primary)] p-6 sm:p-8 md:p-10 min-h-screen">
      <IconButton
        size="lg"
        aria-label="Toggle theme"
        onClick={toggleTheme}
        className="absolute top-5 right-5 sm:top-6 sm:right-6"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      </IconButton>

      <div className="w-full max-w-[400px] sm:max-w-[440px] flex flex-col items-center text-center">
        <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
          <h1 className="text-[32px] sm:text-[36px] md:text-[40px] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
            MedFlow
          </h1>
          <span
            className="animate-dot-pulse w-2 h-2 rounded-[2px] bg-[var(--color-accent)] shrink-0"
            aria-hidden
          />
        </div>
        <p className="text-base sm:text-lg text-[var(--color-text-secondary)] mb-3 sm:mb-4 leading-snug max-w-[320px] sm:max-w-none">
          Stay on time. Stay safe. Stay confident.
        </p>
        <p className="text-sm sm:text-base text-[var(--color-text-tertiary)] mb-10 sm:mb-12 md:mb-14 leading-snug max-w-[280px] sm:max-w-none">
          Medication reminders and daily care in one place.
        </p>

        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onGetStarted}
          className="w-full max-w-[280px] sm:max-w-[320px] min-h-[48px]"
        >
          Get started
        </Button>
      </div>
    </div>
  )
}
