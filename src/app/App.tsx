import { useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useSearchParams, Outlet } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import { queryClient } from '@/shared/lib/query-client'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useAppStore, type Tab } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useNotifications } from '@/shared/hooks/useNotifications'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { useNotes } from '@/shared/hooks/useNotes'
import { useVoiceIntent } from '@/shared/hooks/useVoiceIntent'
import { TimelineView } from '@/app/views/TimelineView'
import { MedsView } from '@/app/views/MedsView'
import { ApptsView } from '@/app/views/ApptsView'
import { SummaryView } from '@/app/views/SummaryView'
import { ProfileView } from '@/app/views/ProfileView'
import { LandingScreen } from '@/app/LandingScreen'
import { LoginScreen } from '@/app/LoginScreen'
import { AuthCallbackScreen } from '@/app/AuthCallbackScreen'
import { InstallGuideScreen } from '@/app/InstallGuideScreen'
import { PrivateRoute } from '@/app/PrivateRoute'
import { isMobile, isStandalone } from '@/shared/lib/device'
import { AddToHomeScreenPrompt } from '@/shared/components/AddToHomeScreenPrompt'
import { getAddToHomeScreenSeen, setAddToHomeScreenSeen } from '@/shared/lib/add-to-home-screen-storage'
import { BetaTermsModal, useBetaTermsAccepted } from '@/shared/components/BetaTermsModal'
import { FeedbackWidget } from '@/shared/components/FeedbackWidget'
import { Modal } from '@/shared/components/Modal'
import { IconButton } from '@/shared/components/IconButton'
import { Button, Input } from '@/shared/components/ui'
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt'
import { useServiceWorkerUpdate } from '@/shared/hooks/useServiceWorkerUpdate'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { useReminders } from '@/shared/hooks/useReminders'
import { RemindersPanel } from '@/app/components/RemindersPanel'

type NotificationItem = {
  id: string
  type: string
  msg: string
  sub: string
  rawDate: Date
  read?: boolean
}

const tabs: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: 'timeline',
    label: 'Timeline',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    ),
  },
  {
    id: 'meds',
    label: 'Meds',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6a2 2 0 012 2v1H7V4a2 2 0 012-2z" /><rect x="7" y="5" width="10" height="16" rx="2" /></svg>
    ),
  },
  {
    id: 'appts',
    label: 'Appts',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    ),
  },
  {
    id: 'summary',
    label: 'Summary',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
    ),
  },
]

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  )
}

function AppInner() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { })
    }
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/timeline" replace />} />
      <Route path="/landing" element={<LandingScreen />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/auth/callback" element={<AuthCallbackScreen />} />
      <Route path="/install" element={<InstallGuideScreen />} />
      <Route element={<PrivateRoute />}>
        <Route element={<AppShell />}>
          <Route path="/timeline" element={<TimelineView />} />
          <Route path="/meds" element={<MedsView />} />
          <Route path="/appts" element={<ApptsView />} />
          <Route path="/summary" element={<SummaryView />} />
          <Route path="/profile" element={<ProfileView />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/timeline" replace />} />
    </Routes>
  )
}

function AppShell() {
  const { session } = useAuthStore()
  const { resolvedTheme, toggleTheme } = useThemeStore()
  const { logDose } = useDoseLogs()
  const { addNote: addNoteReal } = useNotes()
  const { addReminderAsync, reminders } = useReminders()
  const { showRemindersPanel, openRemindersPanel } = useAppStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifTriggerRef = useRef<HTMLButtonElement>(null)

  // Build a stable createReminder function to inject into useVoiceIntent
  // Returns the new reminder ID (or null on failure) and opens the edit panel
  const createReminder = useCallback(
    async ({ userId, title, body, fireAt }: { userId: string; title: string; body: string; fireAt: Date }): Promise<string | null> => {
      try {
        const reminder = await addReminderAsync({ user_id: userId, title, body, fire_at: fireAt.toISOString() })
        // Open the reminders panel with auto-edit for the newly created reminder
        openRemindersPanel(reminder.id)
        return reminder.id
      } catch {
        return null
      }
    },
    [addReminderAsync, openRemindersPanel]
  )

  const voice = useVoiceIntent({ logDose, addNoteReal, createReminder })
  const { accepted: betaTermsAccepted, accept: acceptBetaTerms } = useBetaTermsAccepted()
  const [showVoiceTest] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('voiceTest') === '1'
    } catch {
      return false
    }
  })
  const [showAddToHomeScreenOnboarding, setShowAddToHomeScreenOnboarding] = useState(false)
  const installPrompt = useInstallPrompt()
  const { updateAvailable, reloadToUpdate } = useServiceWorkerUpdate()
  const toasts = useAppStore((s) => s.toasts)

  // Open reminders panel when navigating to ?reminders=open (e.g. from push notification tap)
  useEffect(() => {
    if (searchParams.get('reminders') === 'open') {
      openRemindersPanel()
      setSearchParams((prev) => { prev.delete('reminders'); return prev }, { replace: true })
    }
  }, [searchParams, openRemindersPanel, setSearchParams])

  // iOS Safari: client.navigate() is unsupported in SW, so the SW sends a postMessage instead.
  // Listen for SW_NAVIGATE and handle it via React Router so ?reminders=open triggers the effect above.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SW_NAVIGATE' && typeof event.data.url === 'string') {
        try {
          const u = new URL(event.data.url)
          if (u.origin === window.location.origin) {
            navigate(u.pathname + u.search, { replace: true })
          }
        } catch { /* ignore malformed urls */ }
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [navigate])

  useEffect(() => {
    // Only clean up the hash if it's just an empty '#' (cosmetic)
    if (window.location.hash === '#') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [pathname])

  useEffect(() => {
    if (!session) return
    if (!isMobile() || isStandalone() || getAddToHomeScreenSeen()) return
    const t = setTimeout(() => setShowAddToHomeScreenOnboarding(true), 1500)
    return () => clearTimeout(t)
  }, [session])

  const handleAddToHomeScreenDismiss = () => {
    setAddToHomeScreenSeen()
    setShowAddToHomeScreenOnboarding(false)
  }

  const activeTab = pathname.slice(1) as Tab

  return (
    <Sentry.ErrorBoundary fallback={<div className="fixed inset-0 flex items-center justify-center bg-[var(--color-bg-primary)] p-6 text-center text-[var(--color-text-secondary)]">Something went wrong. Please refresh.</div>}>
    <ErrorBoundary>
    {!betaTermsAccepted && <BetaTermsModal onAccept={acceptBetaTerms} />}
    <div className="flex flex-col min-h-screen bg-[var(--color-bg-primary)] w-full">
      {showAddToHomeScreenOnboarding && (
        <AddToHomeScreenPrompt
          variant="onboarding"
          onDismiss={handleAddToHomeScreenDismiss}
          canInstall={installPrompt.canInstall}
          onInstall={installPrompt.promptInstall}
        />
      )}
      <a href="#main-content" className="sr-only focus-not-sr-only">Skip to main content</a>
      <header
        className="sticky top-0 left-0 right-0 z-[100] w-full pt-[max(1rem,env(safe-area-inset-top))] pb-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-5 backdrop-blur-[12px] bg-[var(--color-bg-primary-translucent)] border-b border-[var(--color-border-primary)]"
        dir="ltr"
      >
        <div className="w-full flex flex-row items-center justify-between gap-4">
        <div className="animate-fade-in flex items-center gap-3 shrink-0 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-text-inverse)] shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <span className="text-[var(--text-subtitle)] font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)] truncate">marinloop</span>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md bg-[var(--color-accent)] text-[var(--color-text-inverse)] opacity-80 select-none">
            BETA
          </span>
        </div>

        <div className="flex flex-row items-center gap-2 sm:gap-3 shrink-0">
          {/* Reminders alarm icon */}
          <IconButton
            size="md"
            aria-label="Open reminders"
            onClick={() => openRemindersPanel()}
            className="relative"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="7" />
              <polyline points="12 9 12 12 13.5 13.5" />
              <path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-1.99 1.82H9.83a2 2 0 0 1-1.99-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 1.99 1.82l.35 3.83" />
            </svg>
            {reminders.filter((r) => !r.fired).length > 0 && (
              <span
                aria-label={`${reminders.filter((r) => !r.fired).length} upcoming reminders`}
                className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[var(--color-accent)]"
              />
            )}
          </IconButton>
          <IconButton
            ref={notifTriggerRef}
            size="md"
            aria-label="Open notifications"
            onClick={() => setNotifOpen(true)}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" /><path d="M9.5 17a2.5 2.5 0 0 0 5 0" /></svg>
          </IconButton>
          <IconButton size="md" aria-label="Toggle theme" onClick={toggleTheme}>
            {resolvedTheme === 'dark'
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>}
          </IconButton>
          <IconButton size="md" aria-label="Open profile" onClick={() => navigate('/profile')} className="overflow-hidden p-0">
            <img src="https://ui-avatars.com/api/?name=marinloop+User&background=0D9488&color=fff" alt="" className="w-full h-full object-cover" />
          </IconButton>
        </div>
        </div>
      </header>

      {updateAvailable && (
        <div
          role="alert"
          className="flex items-center justify-center px-4 py-2.5 bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-semibold"
        >
          <div className="max-w-[480px] mx-auto w-full flex items-center justify-between gap-3">
          <span>New version available</span>
          <button
            type="button"
            onClick={reloadToUpdate}
            className="px-3.5 py-1.5 bg-white/25 text-white text-[13px] font-bold rounded-lg border-none cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Refresh
          </button>
          </div>
        </div>
      )}

      <div className="flex-1 w-full flex justify-center">
        <main
          id="main-content"
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="w-full max-w-[480px] pt-5 px-[max(1rem,env(safe-area-inset-left))] sm:px-5 min-w-0"
          style={{
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
            paddingBottom: 'calc(88px + env(safe-area-inset-bottom))',
          }}
        >
          <Outlet />
        </main>
      </div>

      <nav
        role="tablist"
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 w-full min-h-[72px] bg-[var(--color-bg-primary)] border-t border-[var(--color-border-primary)] flex items-center justify-center z-[90] pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
      >
        <div className="max-w-[480px] mx-auto w-full flex justify-around items-center h-full">
        {tabs.map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => navigate('/' + t.id)}
              className={`flex flex-col items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] py-2 px-4 relative border-none cursor-pointer bg-transparent outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)]'}`}
            >
              {active && (
                <span
                  className="animate-scale-in absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[var(--color-accent)] rounded-b"
                  aria-hidden
                />
              )}
              {t.icon(active)}
              <span className="font-medium leading-none [font-size:var(--text-caption)]">{t.label}</span>
            </button>
          )
        })}
        </div>
      </nav>

      {showVoiceTest && (
        <div className="fixed top-14 left-4 right-4 z-[99] flex gap-2 items-center bg-[var(--color-bg-secondary)] p-2 rounded-xl border border-[var(--color-border-primary)] shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          <label htmlFor="voice-test-input" className="text-[11px] font-semibold text-[var(--color-text-tertiary)] whitespace-nowrap">
            Test voice:
          </label>
          <Input
            id="voice-test-input"
            type="text"
            value={voice.voiceTestInput}
            onChange={(e) => voice.setVoiceTestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && voice.voiceTestInput.trim()) {
                void voice.processVoice(voice.voiceTestInput.trim())
                voice.setVoiceTestInput('')
              }
            }}
            placeholder="e.g. go to meds / add note felt dizzy"
            aria-label="Test voice command"
            className="flex-1 py-2 px-3 text-[13px] rounded-lg"
          />
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="w-auto py-2 px-3 text-xs"
            onClick={() => {
              if (voice.voiceTestInput.trim()) void voice.processVoice(voice.voiceTestInput.trim())
              voice.setVoiceTestInput('')
            }}
          >
            Run
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={voice.handleVoice}
        aria-label={voice.voiceActive ? 'Stop voice input' : 'Voice commands'}
        className={`fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] w-14 h-14 rounded-full flex items-center justify-center border-none text-[var(--color-text-inverse)] cursor-pointer z-[95] shadow-[0_8px_20px_-4px_var(--color-accent-translucent)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] hover:opacity-95 active:scale-95 transition-transform ${voice.voiceActive ? 'animate-pulse-ring bg-[var(--color-red)]' : 'bg-[var(--color-accent)]'}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
      </button>

      {voice.voiceBubble && (
        <div
          className="animate-view-in fixed bottom-44 p-3 px-4 rounded-2xl rounded-br-md bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] shadow-[0_4px_12px_rgba(0,0,0,0.1)] max-w-[min(220px,calc(100vw-2rem))] z-[94] font-medium text-[var(--color-text-primary)]"
          style={{ right: 'max(1rem, env(safe-area-inset-right))', fontSize: 'var(--text-body)' }}
        >
          {voice.voiceBubble}
        </div>
      )}

      {voice.voiceConfirmation && (
        <Modal
          open={!!voice.voiceConfirmation}
          onOpenChange={(o) => !o && voice.setVoiceConfirmation(null)}
          title="Confirm"
          variant="center"
        >
          <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-3.5">
            {voice.voiceConfirmation.message}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1 py-2.5"
              onClick={() => {
                voice.voiceConfirmation!.onConfirm()
                voice.setVoiceConfirmation(null)
              }}
            >
              Confirm
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1 py-2.5"
              onClick={() => voice.setVoiceConfirmation(null)}
            >
              Cancel
            </Button>
          </div>
        </Modal>
      )}

      {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} triggerRef={notifTriggerRef} />}
      {showRemindersPanel && <RemindersPanel />}

      <Toasts toasts={toasts} />
      <FeedbackWidget />
    </div>
    </ErrorBoundary>
    </Sentry.ErrorBoundary>
  )
}

function Toasts({ toasts }: { toasts: { id: string; msg: string; cls: string }[] }) {
  if (!toasts.length) return null
  const borderColor: Record<string, string> = { ts: 'var(--color-green)', tw: 'var(--color-amber)', te: 'var(--color-red)' }
  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-3.5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-1.5 w-[90%] max-w-[400px]"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] py-3.5 px-4 rounded-xl font-semibold shadow-[var(--shadow-elevated)] border-l-4 [font-size:var(--text-body)]"
          style={{ borderLeftColor: borderColor[t.cls] ?? borderColor.ts }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}

function notifDayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function NotifIcon({ type }: { type: string }) {
  const color =
    type === 'error' ? 'var(--color-red)' :
    type === 'warning' ? '#f59e0b' :
    type === 'success' ? 'var(--color-accent)' :
    'var(--color-accent)'
  const bg =
    type === 'error' ? 'color-mix(in srgb, var(--color-red) 12%, transparent)' :
    type === 'warning' ? 'color-mix(in srgb, #f59e0b 12%, transparent)' :
    'color-mix(in srgb, var(--color-accent) 12%, transparent)'
  return (
    <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center" style={{ background: bg }}>
      {type === 'error' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      ) : type === 'warning' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      ) : type === 'success' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      )}
    </div>
  )
}

function NotificationsPanel({ onClose, triggerRef }: { onClose: () => void; triggerRef?: React.RefObject<HTMLButtonElement | null> }) {
  const { notifications, isLoading, markRead } = useNotifications()

  const notifs: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    msg: n.title,
    sub: n.message,
    rawDate: new Date(n.created_at),
    read: n.read,
  }))

  const groups: { label: string; items: NotificationItem[] }[] = []
  const seen = new Map<string, number>()
  for (const n of notifs) {
    const label = notifDayLabel(n.rawDate)
    if (!seen.has(label)) { seen.set(label, groups.length); groups.push({ label, items: [] }) }
    groups[seen.get(label)!].items.push(n)
  }

  // Track which day labels are explicitly expanded. Default: only Today.
  // Initialized unconditionally so it doesn't depend on data being loaded yet.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['Today']))

  const toggle = (label: string) =>
    setExpanded((prev) => { const next = new Set(prev); next.has(label) ? next.delete(label) : next.add(label); return next })

  const totalUnread = notifs.filter((n) => !n.read).length

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Notifications" variant="center" triggerRef={triggerRef}>
      <div className="-mt-1">
        {/* Unread summary pill */}
        {totalUnread > 0 && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
            <span className="text-[14px] font-semibold text-[var(--color-accent)]">{totalUnread} unread</span>
          </div>
        )}

        {isLoading && (
          <div className="text-[var(--color-text-secondary)] py-6 text-center text-[15px]">Loading...</div>
        )}
        {!isLoading && notifs.length === 0 && (
          <div className="py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">All caught up</p>
            <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">No notifications yet</p>
          </div>
        )}

        {groups.map((group, gi) => {
          const isCollapsed = !expanded.has(group.label)
          const unread = group.items.filter((i) => !i.read).length
          return (
            <div key={group.label} className={gi > 0 ? 'mt-2' : ''}>
              {/* Day header */}
              <button
                type="button"
                onClick={() => toggle(group.label)}
                className="w-full flex items-center justify-between gap-3 py-2.5 px-1 bg-transparent border-none cursor-pointer text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[15px] font-bold text-[var(--color-text-primary)]">{group.label}</span>
                  {unread > 0 && (
                    <span className="shrink-0 min-w-[20px] h-5 flex items-center justify-center text-[11px] font-bold px-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)]">{unread}</span>
                  )}
                </div>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-[var(--color-text-tertiary)] transition-transform shrink-0 ${isCollapsed ? '' : 'rotate-180'}`}
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {!isCollapsed && (
                <ul className="flex flex-col gap-2 mt-1 mb-2">
                  {group.items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => { if (!n.read) markRead(n.id) }}
                        className="w-full border-none text-left cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded-2xl transition-colors"
                        style={{
                          background: n.read
                            ? 'var(--color-bg-secondary)'
                            : 'color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-secondary))',
                        }}
                      >
                        <div className="flex gap-3.5 px-3.5 py-3.5 items-start">
                          <NotifIcon type={n.type} />
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className={`text-[15px] leading-snug ${n.read ? 'font-medium text-[var(--color-text-secondary)]' : 'font-semibold text-[var(--color-text-primary)]'}`}>
                              {n.msg}
                            </div>
                            {n.sub && (
                              <div className="text-[13px] text-[var(--color-text-secondary)] mt-1 leading-snug">{n.sub}</div>
                            )}
                            <div className="text-[12px] text-[var(--color-text-tertiary)] mt-1.5 font-medium">
                              {n.rawDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </div>
                          </div>
                          {!n.read && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] shrink-0 mt-1.5" aria-hidden />
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
