import { Navigate, useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { IconButton } from '@/shared/components/IconButton'
import { Button } from '@/shared/components/ui'

export function LandingScreen() {
  const { toggleTheme } = useThemeStore()
  const { session } = useAuthStore()
  const navigate = useNavigate()

  if (session) return <Navigate to="/timeline" replace />

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-[var(--color-bg-primary)] safe-x"
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

      <div className="flex min-h-screen w-full items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
          <div className="w-full">
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] shadow-[var(--shadow-elevated)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M7 4h6l4 4v12H7z" />
                  <path d="M9 13h6M9 17h4M13 4v4h4" />
                </svg>
              </span>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]" style={{ fontSize: 'var(--text-display)' }}>
                  MarinLoop
                </h1>
                <span className="animate-dot-pulse h-2.5 w-2.5 shrink-0 rounded-sm bg-[var(--color-accent)]" aria-hidden />
                <span className="shrink-0 rounded-md bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-inverse)] opacity-80 select-none">
                  BETA
                </span>
              </div>
            </div>

            <p className="mx-auto mb-4 font-semibold leading-tight text-[var(--color-text-primary)] [font-size:clamp(1.8rem,4vw,3rem)]">
              Medication routines, reminders, and care coordination with a clear safety boundary.
            </p>
            <p className="mx-auto mb-4 text-[var(--color-text-secondary)] [font-size:var(--text-body)]">
              Built for patients and caregivers who need an installable daily workflow for medications, adherence, vitals, notes, and care-network coordination.
            </p>
            <p className="mx-auto mb-8 text-[var(--color-text-tertiary)] [font-size:var(--text-label)]">
              MarinLoop is a personal tracking and reminder product. It is not a medical device, not for emergency use, and not offered in this beta for covered-entity workflows requiring HIPAA business associate agreements.
            </p>

            <div className="mb-8 flex flex-wrap justify-center gap-3">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => navigate('/login')}
                className="min-w-[200px]"
              >
                Open beta sign-in
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => navigate('/trust')}
                className="min-w-[200px]"
              >
                Review trust center
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4">
                <p className="mb-1 font-semibold text-[var(--color-text-primary)] [font-size:var(--text-label)]">Core workflow</p>
                <p className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)]">
                  Timeline, meds, reminders, vitals, journal, care network, and installable PWA support.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4">
                <p className="mb-1 font-semibold text-[var(--color-text-primary)] [font-size:var(--text-label)]">Trust controls</p>
                <p className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)]">
                  In-app privacy and terms, AI consent gating, Row Level Security, and account export/delete controls.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4">
                <p className="mb-1 font-semibold text-[var(--color-text-primary)] [font-size:var(--text-label)]">Review ready</p>
                <p className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)]">
                  Built for testers, technical partners, and clinical reviewers who want clear boundaries before adoption.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full rounded-[28px] border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5 text-left shadow-[var(--shadow-elevated)] sm:p-6">
            <div className="mb-5 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-green)]" aria-hidden />
              <p className="font-semibold text-[var(--color-text-primary)] [font-size:var(--text-label)]">
                Reviewer snapshot
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-[var(--color-bg-primary)] p-4">
                <p className="mb-2 font-semibold text-[var(--color-text-primary)] [font-size:var(--text-label)]">What MarinLoop is</p>
                <p className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)]">
                  A personal medication-management workflow for reminders, adherence tracking, and caregiver coordination.
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--color-bg-primary)] p-4">
                <p className="mb-2 font-semibold text-[var(--color-text-primary)] [font-size:var(--text-label)]">What it is not</p>
                <p className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)]">
                  Not a diagnostic tool, not a clinician substitute, not an emergency alerting system, and not a HIPAA deployment for covered-entity workflows in this beta.
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--color-bg-primary)] p-4">
                <p className="mb-2 font-semibold text-[var(--color-text-primary)] [font-size:var(--text-label)]">Optional AI</p>
                <p className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)]">
                  AI features are opt-in and revocable. Core medication tracking works without AI.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">
              <button type="button" onClick={() => navigate('/terms')} className="cursor-pointer border-none bg-transparent p-0 text-inherit underline underline-offset-4">
                Terms
              </button>
              <button type="button" onClick={() => navigate('/privacy')} className="cursor-pointer border-none bg-transparent p-0 text-inherit underline underline-offset-4">
                Privacy
              </button>
              <button type="button" onClick={() => navigate('/trust')} className="cursor-pointer border-none bg-transparent p-0 text-inherit underline underline-offset-4">
                Trust Center
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
