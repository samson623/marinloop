import { useThemeStore } from '@/shared/stores/theme-store'

type LandingScreenProps = {
  onGetStarted: () => void
}

export function LandingScreen({ onGetStarted }: LandingScreenProps) {
  const { toggleTheme } = useThemeStore()

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-primary)',
      padding: 24,
    }}>
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      </button>

      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>MedFlow</h1>
          <span className="animate-dot-pulse" style={{ width: 8, height: 8, background: 'var(--color-accent)', borderRadius: 2 }} />
        </div>
        <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          Stay on time. Stay safe. Stay confident.
        </p>
        <p style={{ fontSize: 14, color: 'var(--color-text-tertiary)', marginBottom: 48, lineHeight: 1.5 }}>
          Medication reminders and daily care in one place.
        </p>

        <button
          type="button"
          onClick={onGetStarted}
          style={{
            width: '100%',
            maxWidth: 280,
            padding: 16,
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Get started
        </button>
      </div>
    </div>
  )
}
