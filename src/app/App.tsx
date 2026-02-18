import { useEffect, useRef, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/shared/lib/query-client'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useAppStore, type Tab } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useNotifications } from '@/shared/hooks/useNotifications'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { VoiceIntentService } from '@/shared/services/voice-intent'
import { NotificationsService } from '@/shared/services/notifications'
import type { VoiceIntentResult } from '@/shared/types/contracts'
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

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type NotificationItem = {
  id: string
  icon: string
  msg: string
  sub: string
  time: string
  read?: boolean
}

type VoiceConfirmation = {
  message: string
  onConfirm: () => void
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
  const {
    tab,
    setTab,
    toasts,
    showProfile,
    setShowProfile,
    openAddMedModal,
    openAddApptModal,
    addNote,
    meds,
    assistantState,
    setAssistantPendingIntent,
    clearAssistantState,
  } = useAppStore()
  const { session, isDemo, isLoading, initialize } = useAuthStore()
  const { resolvedTheme, toggleTheme } = useThemeStore()
  const { timeline } = useTimeline()
  const { logDose } = useDoseLogs()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifTriggerRef = useRef<HTMLButtonElement>(null)
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceBubble, setVoiceBubble] = useState('')
  const [voiceConfirmation, setVoiceConfirmation] = useState<VoiceConfirmation | null>(null)
  const [voiceTestInput, setVoiceTestInput] = useState('')
  const [showVoiceTest, setShowVoiceTest] = useState(false)
  const [showAddToHomeScreenOnboarding, setShowAddToHomeScreenOnboarding] = useState(false)
  const [showLoginScreen, setShowLoginScreen] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg-primary)]">
        Loading...
      </div>
    )
  }

  if (!session && !isDemo) {
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

  const handleVoice = () => {
    const SpeechRecognitionCtor = (
      window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor
        webkitSpeechRecognition?: SpeechRecognitionConstructor
      }
    ).SpeechRecognition
      ?? (
        window as Window & {
          SpeechRecognition?: SpeechRecognitionConstructor
          webkitSpeechRecognition?: SpeechRecognitionConstructor
        }
      ).webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      useAppStore.getState().toast('Speech recognition not supported', 'te')
      return
    }

    if (voiceActive) {
      recognitionRef.current?.stop()
      setVoiceActive(false)
      setVoiceBubble('')
      return
    }

    const rec = new SpeechRecognitionCtor()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    recognitionRef.current = rec

    setVoiceActive(true)
    setVoiceBubble('Listening...')

    rec.onresult = (event) => {
      const results = Array.from(event.results)
      const transcript = results.map((r) => r[0].transcript).join('').trim()
      setVoiceBubble(transcript || 'Listening...')
      // Only process when the last segment is final (full utterance complete)
      const lastResult = results[results.length - 1]
      if (lastResult?.isFinal && transcript) {
        void processVoice(transcript)
        setTimeout(() => {
          setVoiceActive(false)
          setVoiceBubble('')
        }, 1500)
      }
    }

    rec.onerror = () => {
      setVoiceActive(false)
      setVoiceBubble('')
    }

    rec.onend = () => {
      setVoiceActive(false)
      setVoiceBubble('')
    }

    rec.start()
  }

  const fallbackKeywordRoute = (text: string) => {
    const store = useAppStore.getState()
    const normalized = text.toLowerCase()
    if (normalized.includes('medication') || normalized.includes('meds')) {
      store.setTab('meds')
      store.toast('Showing medications', 'ts')
      return true
    }

    if (normalized.includes('appointment') || normalized.includes('appt')) {
      store.setTab('appts')
      store.toast('Showing appointments', 'ts')
      return true
    }

    if (normalized.includes('summary')) {
      store.setTab('summary')
      store.toast('Showing summary', 'ts')
      return true
    }

    if (normalized.includes('timeline') || normalized.includes('schedule')) {
      store.setTab('timeline')
      store.toast('Showing timeline', 'ts')
      return true
    }

    return false
  }

  const applyNavigation = (target?: string) => {
    const store = useAppStore.getState()
    if (target === 'meds' || target === 'appts' || target === 'summary' || target === 'timeline') {
      store.setTab(target)
      store.toast(`Showing ${target === 'appts' ? 'appointments' : target}`, 'ts')
      return true
    }
    return false
  }

  const findDoseTarget = (intent: VoiceIntentResult) => {
    const name = intent.entities.dose?.medication_name?.toLowerCase()
    const pendingMeds = timeline.filter((item) => item.tp === 'med' && item.st === 'pending')
    if (pendingMeds.length === 0) return null
    if (name) {
      const match = pendingMeds.find((item) => item.name.toLowerCase().includes(name))
      if (match) return match
    }
    return pendingMeds.find((item) => item.nx) ?? pendingMeds[0]
  }

  const scheduleReminder = async (intent: VoiceIntentResult) => {
    const draft = intent.entities.reminder
    const inMinutes = draft?.in_minutes
    if (!inMinutes || inMinutes <= 0) {
      useAppStore.getState().toast('Please provide a reminder time (for example, "in 60 minutes").', 'tw')
      return
    }

    const title = draft?.title || 'Medication reminder'
    const message = draft?.message || `Reminder set for ${inMinutes} minutes from now.`

    try {
      await NotificationsService.create({
        title,
        message: `Scheduled for ${inMinutes} minutes from now.`,
        type: 'info',
      })
    } catch {
      // keep local reminder scheduling even if persistence fails
    }

    window.setTimeout(async () => {
      useAppStore.getState().toast(title, 'tw')
      if (session?.user?.id) {
        try {
          await NotificationsService.sendPush(session.user.id, {
            title,
            body: message,
            url: '/',
            tag: 'medflow-reminder',
          })
        } catch {
          // optional push path may fail if user is unsubscribed
        }
      }
    }, inMinutes * 60 * 1000)

    useAppStore.getState().toast(`Reminder set for ${inMinutes} minute${inMinutes === 1 ? '' : 's'}.`, 'ts')
  }

  const processVoice = async (text: string) => {
    const store = useAppStore.getState()
    const transcript = text.trim()
    if (!transcript) {
      store.toast('I did not catch that.', 'tw')
      return
    }

    const contextualTranscript = assistantState.pendingIntent
      ? `Pending intent: ${assistantState.pendingIntent}. Missing: ${assistantState.missing.join(', ')}. User follow-up: ${transcript}`
      : transcript
    const intent = await VoiceIntentService.parseTranscript(contextualTranscript)

    if (intent.missing.length > 0) {
      const prompt = intent.assistant_message || `I need ${intent.missing.join(', ')} to continue.`
      setVoiceBubble(prompt)
      setAssistantPendingIntent({ intent: intent.intent, missing: intent.missing, prompt })
      store.toast(prompt, 'tw')
      return
    }

    clearAssistantState()

    if (intent.confidence < 0.45 && !fallbackKeywordRoute(transcript)) {
      store.toast(`"${text}" - command not recognized`, 'tw')
      return
    }

    switch (intent.intent) {
      case 'navigate':
        if (!applyNavigation(intent.entities.navigate?.target) && !fallbackKeywordRoute(transcript)) {
          store.toast(`"${text}" - command not recognized`, 'tw')
        }
        return
      case 'open_add_med':
        setTab('meds')
        openAddMedModal({
          name: intent.entities.medication?.name,
          dose: intent.entities.medication?.dosage,
          freq: intent.entities.medication?.freq,
          time: intent.entities.medication?.time,
          inst: intent.entities.medication?.instructions,
          warn: intent.entities.medication?.warnings,
          sup: intent.entities.medication?.supply,
        })
        store.toast('Opening add medication form', 'ts')
        return
      case 'open_add_appt':
        setTab('appts')
        openAddApptModal({
          title: intent.entities.appointment?.title,
          date: intent.entities.appointment?.date,
          time: intent.entities.appointment?.time,
          loc: intent.entities.appointment?.location,
          notes: intent.entities.appointment?.notes,
        })
        store.toast('Opening add appointment form', 'ts')
        return
      case 'query_next_dose': {
        const next = timeline.find((item) => item.tp === 'med' && item.st === 'pending')
        if (!next) {
          store.toast('No upcoming doses found.', 'tw')
          return
        }
        const response = `Your next dose is ${next.name} at ${next.time}.`
        setVoiceBubble(response)
        store.toast(response, 'ts')
        return
      }
      case 'log_dose': {
        const target = findDoseTarget(intent)
        if (!target || !target.mid) {
          store.toast('I could not find a dose to log right now.', 'tw')
          return
        }
        const medicationId = target.mid
        const status = intent.entities.dose?.status ?? 'taken'
        const confirmationMessage = status === 'missed'
          ? `Mark ${target.name} (${target.time}) as missed?`
          : `Log ${target.name} (${target.time}) as taken?`
        setVoiceConfirmation({
          message: confirmationMessage,
          onConfirm: () => {
            if (isDemo) {
              if (status === 'missed') store.markMissed(target.id)
              else store.markDone(target.id)
            } else {
              logDose({
                medication_id: medicationId,
                schedule_id: target.id,
                taken_at: new Date().toISOString(),
                status: status === 'missed' ? 'missed' : 'taken',
                notes: null,
              })
            }
            setVoiceConfirmation(null)
          },
        })
        return
      }
      case 'create_reminder':
        setVoiceConfirmation({
          message: 'Create this reminder?',
          onConfirm: () => {
            void scheduleReminder(intent)
            setVoiceConfirmation(null)
          },
        })
        return
      case 'add_note': {
        const noteText = intent.entities.note?.text?.trim()
        if (!noteText) {
          store.toast('What should the note say? Say "add note" then your note.', 'tw')
          return
        }
        const medList = meds ?? []
        const medName = intent.entities.note?.medication_name?.trim()
        const med = medName
          ? medList.find((m) => m.name.toLowerCase().includes(medName.toLowerCase()))
          : medList[0]
        if (!med) {
          store.toast(medName ? `No medication named "${medName}" found.` : 'Add a medication first, then add a note.', 'tw')
          return
        }
        addNote(med.id, noteText)
        setVoiceBubble(`Note added for ${med.name}.`)
        return
      }
      default:
        if (!fallbackKeywordRoute(transcript)) {
          store.toast(`"${text}" - command not recognized`, 'tw')
        }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg-primary)]">
      {showAddToHomeScreenOnboarding && (
        <AddToHomeScreenPrompt
          variant="onboarding"
          onDismiss={handleAddToHomeScreenDismiss}
          canInstall={installPrompt.canInstall}
          onInstall={installPrompt.promptInstall}
        />
      )}
      <a href="#main-content" className="sr-only focus-not-sr-only">Skip to main content</a>
      <header className="sticky top-0 z-[100] py-4 px-4 sm:px-5 backdrop-blur-[12px] bg-[var(--color-bg-primary-translucent)] border-b border-[var(--color-border-primary)]">
        <div className="max-w-[480px] mx-auto w-full flex items-center justify-between">
        <div className="animate-fade-in flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-text-inverse)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <span className="text-lg font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">MedFlow</span>
          {isDemo && (
            <span className="text-[10px] font-bold tracking-[0.08em] text-[var(--color-amber)] bg-[var(--color-amber-bg)] border border-[var(--color-amber-border)] rounded-md py-0.5 px-1.5">
              DEMO
            </span>
          )}
        </div>

        <div className="flex gap-3">
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

      <main id="main-content" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex-1 max-w-[480px] mx-auto w-full pt-4 px-4 sm:px-5 pb-[100px] min-w-0">
        {view}
      </main>

      <nav
        role="tablist"
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 h-[74px] bg-[var(--color-bg-primary)] border-t border-[var(--color-border-primary)] flex items-center justify-center z-[90] pb-[max(0.625rem,env(safe-area-inset-bottom))]"
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
              className={`flex flex-col items-center gap-1 py-2 px-4 relative border-none cursor-pointer bg-transparent outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)]'}`}
            >
              {active && (
                <span
                  className="animate-scale-in absolute -top-3.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-[var(--color-accent)] rounded-b"
                  aria-hidden
                />
              )}
              {t.icon(active)}
              <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
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
            value={voiceTestInput}
            onChange={(e) => setVoiceTestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && voiceTestInput.trim()) {
                void processVoice(voiceTestInput.trim())
                setVoiceTestInput('')
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
              if (voiceTestInput.trim()) void processVoice(voiceTestInput.trim())
              setVoiceTestInput('')
            }}
          >
            Run
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={handleVoice}
        aria-label={voiceActive ? 'Stop voice input' : 'Voice commands'}
        className={`fixed bottom-[90px] right-5 w-14 h-14 rounded-full flex items-center justify-center border-none text-[var(--color-text-inverse)] cursor-pointer z-[95] shadow-[0_8px_20px_-4px_var(--color-accent-translucent)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${voiceActive ? 'animate-pulse-ring bg-[var(--color-red)]' : 'bg-[var(--color-accent)]'}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
      </button>

      {voiceBubble && (
        <div className="animate-view-in fixed bottom-40 right-5 p-3 px-4 rounded-2xl rounded-br-md bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] shadow-[0_4px_12px_rgba(0,0,0,0.1)] max-w-[220px] z-[94] text-sm font-medium text-[var(--color-text-primary)]">
          {voiceBubble}
        </div>
      )}

      {voiceConfirmation && (
        <Modal
          open={!!voiceConfirmation}
          onOpenChange={(o) => !o && setVoiceConfirmation(null)}
          title="Confirm"
          variant="center"
        >
          <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-3.5">
            {voiceConfirmation.message}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1 py-2.5"
              onClick={() => {
                voiceConfirmation.onConfirm()
                setVoiceConfirmation(null)
              }}
            >
              Confirm
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1 py-2.5"
              onClick={() => setVoiceConfirmation(null)}
            >
              Cancel
            </Button>
          </div>
        </Modal>
      )}

      {notifOpen && <NotificationsPanel isDemo={isDemo} onClose={() => setNotifOpen(false)} triggerRef={notifTriggerRef} />}

      <Toasts toasts={toasts} />
    </div>
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
          className="animate-toast bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] py-3 px-3.5 rounded-[10px] text-[13px] font-semibold shadow-[var(--shadow-elevated)] border-l-[3px]"
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
    <Modal open onOpenChange={(o) => !o && onClose()} title="Notifications" variant="bottom" triggerRef={triggerRef}>
      <div className="py-2.5">
        {isLoading && !isDemo && (
          <div className="text-[13px] text-[var(--color-text-secondary)] py-1.5">Loading notifications...</div>
        )}
        {!isLoading && notifs.length === 0 && (
          <div className="text-[13px] text-[var(--color-text-secondary)] py-1.5">No notifications</div>
        )}
        {notifs.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => {
              if (!isDemo && !n.read) markRead(n.id)
            }}
            className={`w-full bg-transparent border-none text-left flex gap-3 py-3 border-b border-[var(--color-border-secondary)] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${!isDemo && n.read ? 'opacity-60' : ''}`}
          >
            <span className="text-xl w-8 text-center shrink-0">{n.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">{n.msg}</div>
              <div className="text-xs text-[var(--color-text-secondary)]">{n.sub}</div>
            </div>
            <span className="text-[11px] text-[var(--color-text-tertiary)] whitespace-nowrap shrink-0 [font-family:var(--font-mono)]">
              {n.time}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
