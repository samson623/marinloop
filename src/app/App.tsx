import { useEffect, useRef, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/shared/lib/query-client'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useAppStore, type Tab } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useNotifications } from '@/shared/hooks/useNotifications'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { useNotes } from '@/shared/hooks/useNotes'
import { useVoiceIntent } from '@/shared/hooks/useVoiceIntent'
import { LoginScreen } from '@/app/LoginScreen'
import { LandingScreen } from '@/app/LandingScreen'
import { TimelineView } from '@/app/views/TimelineView'
import { MedsView } from '@/app/views/MedsView'
import { ApptsView } from '@/app/views/ApptsView'
import { SummaryView } from '@/app/views/SummaryView'
import { ProfileView } from '@/app/views/ProfileView'
import { isMobile, isStandalone } from '@/shared/lib/device'
import { AddToHomeScreenPrompt, getAddToHomeScreenSeen, setAddToHomeScreenSeen } from '@/shared/components/AddToHomeScreenPrompt'
import { Modal } from '@/shared/components/Modal'
import { IconButton } from '@/shared/components/IconButton'
import { Button, Input } from '@/shared/components/ui'
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt'
import { useServiceWorkerUpdate } from '@/shared/hooks/useServiceWorkerUpdate'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { getAuthView } from '@/shared/lib/auth-guard'

type NotificationItem = {
  id: string
  icon: string
  msg: string
  sub: string
  time: string
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
  const { tab, setTab, toasts, showProfile, setShowProfile } = useAppStore()
  const { session, isDemo, isLoading, initialize } = useAuthStore()
  const { resolvedTheme, toggleTheme } = useThemeStore()
  const { logDose } = useDoseLogs()
  const { addNote: addNoteReal } = useNotes()
  const voice = useVoiceIntent({ logDose, addNoteReal })
  const [notifOpen, setNotifOpen] = useState(false)
  const notifTriggerRef = useRef<HTMLButtonElement>(null)
  const [showVoiceTest, setShowVoiceTest] = useState(false)
  const [showAddToHomeScreenOnboarding, setShowAddToHomeScreenOnboarding] = useState(false)
  const [showLoginScreen, setShowLoginScreen] = useState(false)
  const installPrompt = useInstallPrompt()
  const { updateAvailable, reloadToUpdate } = useServiceWorkerUpdate()

  useEffect(() => {
    try {
      setShowVoiceTest(new URLSearchParams(window.location.search).get('voiceTest') === '1')
    } catch {
      setShowVoiceTest(false)
    }
  }, [])

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    // Only clean up the hash if it's just an empty '#' (cosmetic)
    // We strictly avoid touching it if it contains params (like access_token)
    if (window.location.hash === '#') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [isLoading])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { })
    }
  }, [])

  useEffect(() => {
    if (!session || isDemo) return
    if (!isMobile() || isStandalone() || getAddToHomeScreenSeen()) return
    const t = setTimeout(() => setShowAddToHomeScreenOnboarding(true), 1500)
    return () => clearTimeout(t)
  }, [session, isDemo])

  const authView = getAuthView(isLoading, session, isDemo)
  if (authView === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg-primary)]">
        Loading...
      </div>
    )
  }

  if (authView === 'login') {
    return (
      <>
        {showLoginScreen ? (
          <LoginScreen onBack={() => setShowLoginScreen(false)} />
        ) : (
          <LandingScreen onGetStarted={() => setShowLoginScreen(true)} />
        )}
        <Toasts toasts={toasts} />
      </>
    )
  }

  const view = showProfile
    ? <ProfileView />
    : tab === 'timeline'
      ? <TimelineView />
      : tab === 'meds'
        ? <MedsView />
        : tab === 'appts'
          ? <ApptsView />
          : <SummaryView />

  const handleAddToHomeScreenDismiss = () => {
    setAddToHomeScreenSeen()
    setShowAddToHomeScreenOnboarding(false)
  }

  return (
    <ErrorBoundary>
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
          <span className="text-[var(--text-subtitle)] font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)] truncate">MedFlow</span>
          {isDemo && (
            <span className="text-[var(--text-caption)] font-bold tracking-[0.08em] text-[var(--color-amber)] bg-[var(--color-amber-bg)] border border-[var(--color-amber-border)] rounded-md py-1 px-2 shrink-0">
              DEMO
            </span>
          )}
        </div>

        <div className="flex flex-row items-center gap-2 sm:gap-3 shrink-0">
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
          <IconButton size="md" aria-label="Open profile" onClick={() => setShowProfile(true)} className="overflow-hidden p-0">
            <img src="https://ui-avatars.com/api/?name=MedFlow+User&background=0D9488&color=fff" alt="" className="w-full h-full object-cover" />
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
          aria-labelledby={`tab-${tab}`}
          className="w-full max-w-[480px] pt-5 px-[max(1rem,env(safe-area-inset-left))] sm:px-5 min-w-0"
          style={{
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
            paddingBottom: 'calc(88px + env(safe-area-inset-bottom))',
          }}
        >
          {view}
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
          const active = tab === t.id
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
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

      {notifOpen && <NotificationsPanel isDemo={isDemo} onClose={() => setNotifOpen(false)} triggerRef={notifTriggerRef} />}

      <Toasts toasts={toasts} />
    </div>
    </ErrorBoundary>
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

function NotificationsPanel({ onClose, isDemo, triggerRef }: { onClose: () => void; isDemo: boolean; triggerRef?: React.RefObject<HTMLButtonElement | null> }) {
  const { notifications, isLoading, markRead } = useNotifications()

  const demoNotifs: NotificationItem[] = [
    { id: 'd-1', icon: '?', msg: 'Levothyroxine - 8:00 AM', sub: 'Take on empty stomach', time: '5m ago' },
    { id: 'd-2', icon: '?', msg: 'Metformin logged', sub: 'Taken at 8:32 AM', time: '28m ago' },
    { id: 'd-3', icon: '?', msg: 'Lisinopril supply low', sub: '8 pills remaining', time: '2h ago' },
    { id: 'd-4', icon: '??', msg: 'Dr. Chen - Today at 3:30 PM', sub: 'City Medical Center', time: '4h ago' },
  ]

  const liveNotifs: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    icon: n.type === 'warning' ? '?' : n.type === 'success' ? '?' : n.type === 'error' ? '!' : '?',
    msg: n.title,
    sub: n.message,
    time: new Date(n.created_at).toLocaleString(),
    read: n.read,
  }))

  const notifs = isDemo ? demoNotifs : liveNotifs

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Notifications" variant="center" triggerRef={triggerRef}>
      <div className="py-2.5">
        {isLoading && !isDemo && (
          <div className="text-[var(--color-text-secondary)] py-2 [font-size:var(--text-body)]">Loading notifications...</div>
        )}
        {!isLoading && notifs.length === 0 && (
          <div className="text-[var(--color-text-secondary)] py-2 [font-size:var(--text-body)]">No notifications</div>
        )}
        {notifs.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => {
              if (!isDemo && !n.read) markRead(n.id)
            }}
            className={`w-full bg-transparent border-none text-left flex gap-3 min-h-[56px] py-4 border-b border-[var(--color-border-secondary)] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${!isDemo && n.read ? 'opacity-60' : ''}`}
          >
            <span className="text-xl w-9 text-center shrink-0">{n.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[var(--color-text-primary)] [font-size:var(--text-body)]">{n.msg}</div>
              <div className="text-[var(--color-text-secondary)] [font-size:var(--text-label)]">{n.sub}</div>
            </div>
            <span className="text-[var(--color-text-tertiary)] whitespace-nowrap shrink-0 [font-family:var(--font-mono)] [font-size:var(--text-caption)]">
              {n.time}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
