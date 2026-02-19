import { useRef, useState } from 'react'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { VoiceIntentService } from '@/shared/services/voice-intent'
import { NotificationsService } from '@/shared/services/notifications'
import type { VoiceIntentResult } from '@/shared/types/contracts'
import type { DoseLogCreateInput } from '@/shared/types/contracts'
import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionLike,
  VoiceConfirmation,
} from '@/shared/types/voice'

export type VoiceIntentServiceLike = {
  parseTranscript: (transcript: string) => Promise<VoiceIntentResult>
}

export type NotificationsServiceLike = {
  create: (opts: { title: string; message: string; type?: string }) => Promise<unknown>
  sendPush: (userId: string, opts: { title: string; body: string; url: string; tag: string }) => Promise<unknown>
}

export type UseVoiceIntentOptions = {
  logDose: (input: DoseLogCreateInput) => void
  addNoteReal: (payload: { content: string; medication_id: string | null }) => void
  voiceIntentService?: VoiceIntentServiceLike
  notificationsService?: NotificationsServiceLike
}

const defaultVoiceIntentService: VoiceIntentServiceLike = VoiceIntentService
const defaultNotificationsService: NotificationsServiceLike = NotificationsService as NotificationsServiceLike

export function useVoiceIntent(options: UseVoiceIntentOptions) {
  const {
    logDose,
    addNoteReal,
    voiceIntentService = defaultVoiceIntentService,
    notificationsService = defaultNotificationsService,
  } = options

  const {
    setTab,
    openAddMedModal,
    openAddApptModal,
    addNote,
    meds,
    assistantState,
    setAssistantPendingIntent,
    clearAssistantState,
  } = useAppStore()
  const { session, isDemo } = useAuthStore()
  const { timeline } = useTimeline()

  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceBubble, setVoiceBubble] = useState('')
  const [voiceConfirmation, setVoiceConfirmation] = useState<VoiceConfirmation | null>(null)
  const [voiceTestInput, setVoiceTestInput] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

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
      await notificationsService.create({
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
          await notificationsService.sendPush(session.user.id, {
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
    const intent = await voiceIntentService.parseTranscript(contextualTranscript)

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
        const med = medName ? medList.find((m) => m.name.toLowerCase().includes(medName.toLowerCase())) : null
        const medicationId = med?.id ?? null
        if (isDemo) {
          addNote({ content: noteText, medication_id: medicationId })
        } else {
          addNoteReal({ content: noteText, medication_id: medicationId })
        }
        setVoiceBubble(med ? `Note added for ${med.name}.` : 'Note saved.')
        return
      }
      default:
        if (!fallbackKeywordRoute(transcript)) {
          store.toast(`"${text}" - command not recognized`, 'tw')
        }
    }
  }

  const handleVoice = () => {
    const SpeechRecognitionCtor = (
      window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    ).SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition

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

  return {
    voiceActive,
    voiceBubble,
    voiceConfirmation,
    setVoiceConfirmation,
    voiceTestInput,
    setVoiceTestInput,
    handleVoice,
    processVoice,
  }
}
