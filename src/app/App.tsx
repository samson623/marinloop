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
import { TimelineView } from '@/app/views/TimelineView'
import { MedsView } from '@/app/views/MedsView'
import { ApptsView } from '@/app/views/ApptsView'
import { SummaryView } from '@/app/views/SummaryView'
import { ProfileView } from '@/app/views/ProfileView'
import { isMobile, isStandalone } from '@/shared/lib/device'
import { AddToHomeScreenPrompt, getAddToHomeScreenSeen, setAddToHomeScreenSeen } from '@/shared/components/AddToHomeScreenPrompt'
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt'

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
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceBubble, setVoiceBubble] = useState('')
  const [voiceConfirmation, setVoiceConfirmation] = useState<VoiceConfirmation | null>(null)
  const [voiceTestInput, setVoiceTestInput] = useState('')
  const [showVoiceTest, setShowVoiceTest] = useState(false)
  const [showAddToHomeScreenOnboarding, setShowAddToHomeScreenOnboarding] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const installPrompt = useInstallPrompt()

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
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)' }}>Loading...</div>
  }

  if (!session && !isDemo) {
    return (
      <>
        <LoginScreen />
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
      {showAddToHomeScreenOnboarding && (
        <AddToHomeScreenPrompt
          variant="onboarding"
          onDismiss={handleAddToHomeScreenDismiss}
          canInstall={installPrompt.canInstall}
          onInstall={installPrompt.promptInstall}
        />
      )}
      <header style={{
        padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)',
        background: 'var(--color-bg-primary-translucent)', borderBottom: '1px solid var(--color-border-primary)',
      }}>
        <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>MedFlow</span>
          {isDemo && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-amber)', background: 'var(--color-amber-bg)', border: '1px solid var(--color-amber-border)', borderRadius: 6, padding: '3px 6px' }}>DEMO</span>}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setNotifOpen(true)} style={{
            width: 38, height: 38, borderRadius: 12, border: 'none', background: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" /><path d="M9.5 17a2.5 2.5 0 0 0 5 0" /></svg>
          </button>
          <button onClick={toggleTheme} style={{
            width: 38, height: 38, borderRadius: 12, border: 'none', background: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            {resolvedTheme === 'dark'
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>}
          </button>
          <button onClick={() => setShowProfile(true)} style={{
            width: 38, height: 38, borderRadius: 12, border: 'none', background: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
          }}>
            <img src="https://ui-avatars.com/api/?name=MedFlow+User&background=0D9488&color=fff" alt="avatar" style={{ width: '100%', height: '100%' }} />
          </button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 480, margin: '0 auto', width: '100%', padding: '16px 16px 100px' }}>{view}</main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 74, background: 'var(--color-bg-primary)',
        borderTop: '1px solid var(--color-border-primary)', display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        paddingBottom: 10, zIndex: 90,
      }}>
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)', cursor: 'pointer', padding: '8px 16px', position: 'relative',
            }}>
              {active && <span className="animate-scale-in" style={{ position: 'absolute', top: -14, width: 32, height: 4, background: 'var(--color-accent)', borderRadius: '0 0 4px 4px' }} />}
              {t.icon(active)}
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{t.label}</span>
            </button>
          )
        })}
      </nav>

      {showVoiceTest && (
        <div style={{
          position: 'fixed', top: 56, left: 16, right: 16, zIndex: 99,
          display: 'flex', gap: 8, alignItems: 'center', background: 'var(--color-bg-secondary)',
          padding: 8, borderRadius: 12, border: '1px solid var(--color-border-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Test voice:</span>
          <input
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
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)',
              background: 'var(--color-input-bg)', color: 'var(--color-text-primary)', fontSize: 13, outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => { if (voiceTestInput.trim()) void processVoice(voiceTestInput.trim()); setVoiceTestInput('') }}
            style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--color-accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Run
          </button>
        </div>
      )}

      <button
        onClick={handleVoice}
        className={voiceActive ? 'animate-pulse-ring' : ''}
        style={{
          position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28,
          background: voiceActive ? 'var(--color-red)' : 'var(--color-accent)',
          boxShadow: '0 8px 20px -4px var(--color-accent-translucent)', border: 'none', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 95,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
      </button>

      {voiceBubble && (
        <div className="animate-view-in" style={{
          position: 'fixed', bottom: 160, right: 20, padding: '12px 16px', background: 'var(--color-bg-secondary)',
          borderRadius: '16px 16px 4px 16px', border: '1px solid var(--color-border-primary)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: 220, zIndex: 94, fontSize: 13, fontWeight: 500,
        }}>
          {voiceBubble}
        </div>
      )}

      {voiceConfirmation && (
        <div className="animate-view-in" style={{
          position: 'fixed',
          bottom: 220,
          right: 20,
          width: 260,
          background: 'var(--color-bg-secondary)',
          borderRadius: 14,
          border: '1px solid var(--color-border-primary)',
          boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
          zIndex: 98,
          padding: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10 }}>
            {voiceConfirmation.message}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                voiceConfirmation.onConfirm()
              }}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => setVoiceConfirmation(null)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                border: '1px solid var(--color-border-primary)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {notifOpen && <NotificationsPanel isDemo={isDemo} onClose={() => setNotifOpen(false)} />}

      <Toasts toasts={toasts} />
    </div>
  )
}

function Toasts({ toasts }: { toasts: { id: string; msg: string; cls: string }[] }) {
  if (!toasts.length) return null
  const bc: Record<string, string> = { ts: 'var(--color-green)', tw: 'var(--color-amber)', te: 'var(--color-red)' }
  return (
    <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 6, width: '90%', maxWidth: 400 }}>
      {toasts.map((t) => (
        <div key={t.id} className="animate-toast" style={{
          background: 'var(--color-text-primary)', color: 'var(--color-text-inverse)',
          padding: '12px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          borderLeft: `3px solid ${bc[t.cls] || bc.ts}`, boxShadow: 'var(--shadow-elevated)',
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

function NotificationsPanel({ onClose, isDemo }: { onClose: () => void; isDemo: boolean }) {
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--color-overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-view-in" style={{
        width: '100%', maxWidth: 480, maxHeight: '70vh', background: 'var(--color-bg-primary)', borderRadius: '16px 16px 0 0', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, background: 'var(--color-text-tertiary)', opacity: 0.3, margin: '10px auto', borderRadius: 4 }} />
        <div style={{ padding: '4px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-primary)' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>Notifications</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-tertiary)', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', borderRadius: '50%' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div style={{ padding: '10px 20px' }}>
          {isLoading && !isDemo && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '6px 0' }}>Loading notifications...</div>}
          {!isLoading && notifs.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '6px 0' }}>No notifications</div>}
          {notifs.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!isDemo && !n.read) markRead(n.id)
              }}
              style={{
                width: '100%', background: 'transparent', border: 'none', textAlign: 'left', display: 'flex', gap: 12,
                padding: '12px 0', borderBottom: '1px solid var(--color-border-secondary)', cursor: 'pointer',
                opacity: !isDemo && n.read ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0 }}>{n.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.msg}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{n.sub}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>{n.time}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
