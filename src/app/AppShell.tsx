/**
 * AppShell — authenticated shell layout: header, bottom nav, FABs, modals, and all
 * shell-level effects (SW messages, reminders search param, hash cleaner, add-to-home timer).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useAppStore, type Tab } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { useNotes } from '@/shared/hooks/useNotes'
import { useVoiceIntent } from '@/shared/hooks/useVoiceIntent'
import { isMobile, isStandalone } from '@/shared/lib/device'
import { AddToHomeScreenPrompt } from '@/shared/components/AddToHomeScreenPrompt'
import { getAddToHomeScreenSeen, setAddToHomeScreenSeen } from '@/shared/lib/add-to-home-screen-storage'
import { BetaTermsModal, useBetaTermsAccepted } from '@/shared/components/BetaTermsModal'
import { AIConsentModal, useAIConsent } from '@/shared/components/AIConsentModal'
import { FeedbackModal } from '@/shared/components/FeedbackModal'
import { Modal } from '@/shared/components/Modal'
import { IconButton } from '@/shared/components/IconButton'
import { Button, Input } from '@/shared/components/ui'
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt'
import { useServiceWorkerUpdate } from '@/shared/hooks/useServiceWorkerUpdate'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { useReminders } from '@/shared/hooks/useReminders'
import { useRealtimeSync } from '@/shared/hooks/useRealtimeSync'
import { useOfflineQueue } from '@/shared/hooks/useOfflineQueue'
import { RemindersPanel } from '@/app/components/RemindersPanel'
import { NotificationsPanel } from '@/app/components/NotificationsPanel'
import { NotificationsService } from '@/shared/services/notifications'
import {
  LogoIcon, BellAlarmIcon, BellIcon, SunIcon, MoonIcon, MicIcon,
  ClockIcon, PillIcon, CalendarIcon, BarChartIcon, UsersIcon,
} from '@/shared/components/icons'

const tabs: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { id: 'timeline', label: 'Timeline', icon: (a) => <ClockIcon    size={22} strokeWidth={a ? 2.2 : 1.6} /> },
  { id: 'meds',     label: 'Meds',     icon: (a) => <PillIcon     size={22} strokeWidth={a ? 2.2 : 1.6} /> },
  { id: 'appts',    label: 'Appts',    icon: (a) => <CalendarIcon size={22} strokeWidth={a ? 2.2 : 1.6} /> },
  { id: 'summary',  label: 'Health',   icon: (a) => <BarChartIcon size={22} strokeWidth={a ? 2.2 : 1.6} /> },
  { id: 'care',     label: 'Care',     icon: (a) => <UsersIcon    size={22} strokeWidth={a ? 2.2 : 1.6} /> },
]

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

export function AppShell() {
  const { session, profile, user } = useAuthStore()
  const { resolvedTheme, toggleTheme } = useThemeStore()
  const { logDose } = useDoseLogs()
  const { addNote: addNoteReal } = useNotes()
  const { addReminderAsync, reminders } = useReminders()
  const { showRemindersPanel, openRemindersPanel } = useAppStore()
  useRealtimeSync()
  const { isOnline, isSyncing, pendingCount } = useOfflineQueue()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifTriggerRef = useRef<HTMLButtonElement>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Build a stable createReminder function to inject into useVoiceIntent.
  // This is the canonical place for the confirmation push on voice-created reminders.
  // Returns the new reminder ID (or null on failure) and opens the edit panel.
  const createReminder = useCallback(
    async ({ userId, title, body, fireAt }: { userId: string; title: string; body: string; fireAt: Date }): Promise<string | null> => {
      try {
        const reminder = await addReminderAsync({ user_id: userId, title, body, fire_at: fireAt.toISOString() })
        // Open the reminders panel with auto-edit for the newly created reminder
        openRemindersPanel(reminder.id)
        // Send an immediate push notification to confirm the reminder was set
        const timeStr = fireAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
        try {
          await NotificationsService.sendPush(userId, {
            title: `Reminder set: ${title}`,
            body: `Will fire at ${timeStr}`,
            url: '/timeline?reminders=open',
            tag: `reminder-confirm-${reminder.id}`,
          })
        } catch { /* push may not be subscribed — that's OK */ }
        return reminder.id
      } catch {
        return null
      }
    },
    [addReminderAsync, openRemindersPanel]
  )

  const voice = useVoiceIntent({
    logDose,
    addNoteReal,
    createReminder,
    onAdherenceSummary: () => {
      void queryClient.invalidateQueries({ queryKey: ['adherence-insights'] })
    },
  })
  const { accepted: betaTermsAccepted, accept: acceptBetaTerms } = useBetaTermsAccepted()
  const { consented: aiConsented, declined: aiDeclined, setDeclined: setAiDeclined, consent: grantAiConsent } = useAIConsent()
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

  const queryClient = useQueryClient()

  // iOS Safari: client.navigate() is unsupported in SW, so the SW sends postMessages instead.
  // Handle SW_NAVIGATE (navigation), DOSE_TAKEN (refresh timeline), SNOOZE_REMINDER (refresh reminders).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent) => {
      const { type, url } = event.data ?? {}
      switch (type) {
        case 'SW_NAVIGATE':
          if (url && typeof url === 'string') {
            try {
              const u = new URL(url)
              if (u.origin === window.location.origin) {
                navigate(u.pathname + u.search, { replace: true })
              }
            } catch { /* ignore malformed urls */ }
          }
          break
        case 'DOSE_TAKEN':
          void queryClient.invalidateQueries({ queryKey: ['dose_logs'] })
          void queryClient.invalidateQueries({ queryKey: ['dose_logs', 'today'] })
          break
        case 'SNOOZE_REMINDER':
          void queryClient.invalidateQueries({ queryKey: ['reminders'] })
          break
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [navigate, queryClient])

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
    {betaTermsAccepted && !aiConsented && !aiDeclined && <AIConsentModal onAccept={grantAiConsent} onDecline={() => setAiDeclined(true)} />}
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
            <LogoIcon size={22} strokeWidth={2.5} />
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
            <BellAlarmIcon size={19} strokeWidth={2} />
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
            <BellIcon size={19} strokeWidth={2} />
          </IconButton>
          <IconButton size="md" aria-label="Toggle theme" onClick={toggleTheme}>
            {resolvedTheme === 'dark'
              ? <SunIcon  size={20} strokeWidth={1.8} />
              : <MoonIcon size={20} strokeWidth={1.8} />}
          </IconButton>
          <IconButton size="md" aria-label="Send feedback" onClick={() => setFeedbackOpen(true)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </IconButton>
          <IconButton size="md" aria-label="Open profile" onClick={() => navigate('/profile')} className="overflow-hidden p-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name ?? 'Profile'} className="w-full h-full object-cover" />
            ) : (
              <span
                className="w-full h-full flex items-center justify-center bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-bold text-sm"
                aria-hidden
              >
                {(profile?.name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()}
              </span>
            )}
          </IconButton>
        </div>
        </div>
      </header>

      {/* Offline / syncing status banner */}
      {(!isOnline || isSyncing) && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold ${
            isSyncing
              ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
              : 'bg-[var(--color-amber,#d97706)] text-white'
          }`}
        >
          {isSyncing ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
              Syncing {pendingCount > 0 ? `${pendingCount} item${pendingCount !== 1 ? 's' : ''}` : ''}…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
              Offline — changes will sync when reconnected
            </>
          )}
        </div>
      )}

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
              <span className={`font-medium leading-none [font-size:var(--text-caption)] ${!active ? 'max-[374px]:hidden' : ''}`}>{t.label}</span>
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
        <MicIcon size={24} strokeWidth={2.5} />
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

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <Toasts toasts={toasts} />
    </div>
    </ErrorBoundary>
    </Sentry.ErrorBoundary>
  )
}
