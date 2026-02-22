import { useRef, useState } from 'react'
import { useAppStore, fT, fD } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useNotes } from '@/shared/hooks/useNotes'
import { VoiceIntentService } from '@/shared/services/voice-intent'
import { AIService } from '@/shared/services/ai'
import { NotificationsService } from '@/shared/services/notifications'
import { todayLocal, isoToLocalDate, toLocalTimeString } from '@/shared/lib/dates'
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
    meds: storeMeds,
    appts: storeAppts,
    notes: storeNotes,
    adh: storeAdh,
    assistantState,
    setAssistantPendingIntent,
    clearAssistantState,
  } = useAppStore()
  const { session, isDemo } = useAuthStore()
  const { timeline } = useTimeline()
  const { meds: realMeds } = useMedications()
  const { scheds } = useSchedules()
  const { appts: realAppts } = useAppointments()
  const { notes: realNotes } = useNotes()
  const medsForContext = isDemo
    ? storeMeds
    : (realMeds ?? []).map((m) => {
        const medScheds = (scheds ?? []).filter((s) => s.medication_id === m.id)
        const times = medScheds.map((s) => s.time?.slice(0, 5) ?? '').filter(Boolean)
        return {
          id: m.id,
          name: m.name,
          dose: m.dosage ?? '',
          freq: m.freq ?? 1,
          times,
        }
      })
  const apptsForContext = isDemo
    ? storeAppts
    : (realAppts ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        date: isoToLocalDate(a.start_time),
        time: toLocalTimeString(a.start_time),
        loc: a.location ?? '',
        notes: a.notes ? [a.notes] : [],
      }))
  const notesForContext = isDemo
    ? storeNotes
    : (realNotes ?? []).map((n) => ({
        id: n.id,
        text: n.content,
        time: n.created_at,
        mid: n.medication_id ?? '',
      }))
  const meds = isDemo ? storeMeds : medsForContext

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
      case 'open_add_med': {
        const entryMethod = intent.entities.medication?.entry_method
        const options =
          entryMethod === 'scan'
            ? { openScanner: true, openPhoto: false }
            : entryMethod === 'photo'
              ? { openScanner: false, openPhoto: true }
              : null
        setTab('meds')
        openAddMedModal(
          {
            name: intent.entities.medication?.name,
            dose: intent.entities.medication?.dosage,
            freq: intent.entities.medication?.freq,
            time: intent.entities.medication?.time,
            inst: intent.entities.medication?.instructions,
            warn: intent.entities.medication?.warnings,
            sup: intent.entities.medication?.supply,
          },
          options
        )
        const msg =
          entryMethod === 'scan'
            ? 'Scan the barcode — I\'ll fill in the form'
            : entryMethod === 'photo'
              ? 'Take or upload a photo of the label'
              : 'Opening add medication form'
        store.toast(msg, 'ts')
        return
      }
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
      case 'query': {
        const question = intent.entities.query?.question ?? transcript
        const timelineStr = timeline
          .map((i) => {
            const status = i.st === 'done' ? '✓' : i.st === 'missed' ? 'missed' : i.st === 'late' ? 'late' : 'pending'
            return `- ${i.tp === 'med' ? 'Med' : 'Appt'}: ${i.name}${i.dose ? ` ${i.dose}` : ''} at ${i.time} (${status})`
          })
          .join('\n')
        const medsStr = (isDemo ? storeMeds : medsForContext)
          .map((m) => {
            const t = (m as { times?: string[] }).times ?? []
            const times = t.length ? t.map(fT).join(', ') : ''
            return `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${times ? ` at ${times}` : ''} (${m.freq ?? 1}x daily)`
          })
          .join('\n')
        const apptsStr = (isDemo ? storeAppts : apptsForContext)
          .map((a) => `- ${a.title} on ${fD(a.date)} at ${fT(a.time)}${a.loc ? ` — ${a.loc}` : ''}`)
          .join('\n')
        const notesStr = (isDemo ? storeNotes : notesForContext)
          .map((n) => `- ${n.text}${n.mid ? ` (med link)` : ''}`)
          .join('\n')
        const adhStr =
          Object.keys(storeAdh).length > 0
            ? Object.entries(storeAdh)
                .slice(-7)
                .map(([d, v]) => `${d}: ${v.d}/${v.t} doses`)
                .join('\n')
            : ''
        const context = `Today is ${todayLocal()}.

## Today's schedule (timeline)
${timelineStr || 'No items for today.'}

## Medications
${medsStr || 'No medications.'}

## Appointments
${apptsStr || 'No appointments.'}

## Notes
${notesStr || 'No notes.'}
${adhStr ? `\n## Recent adherence\n${adhStr}` : ''}`

        if (!AIService.isConfigured()) {
          const fallback =
            question.toLowerCase().includes('schedule') || question.toLowerCase().includes('agenda')
              ? timelineStr || 'Nothing on your schedule for today.'
              : question.toLowerCase().includes('med')
                ? medsStr || 'You have no medications listed.'
                : question.toLowerCase().includes('appointment') || question.toLowerCase().includes('appt')
                  ? apptsStr || 'No appointments.'
                  : question.toLowerCase().includes('note')
                    ? notesStr || 'No notes.'
                    : `I can answer questions about your schedule, medications, appointments, and notes. Try: "What's on my schedule?" or "What meds do I have?"`
          setVoiceBubble(fallback)
          store.toast(fallback, 'ts')
          return
        }
        setVoiceBubble('Thinking...')
        try {
          const response = await AIService.chat([
            {
              role: 'system',
              content: `You are MedFlow Care's clinical voice assistant. Answer the user's question using ONLY the data below. Be concise (1-3 sentences). Cite specifics. Do not make up data. If the data doesn't contain the answer, say so clearly. Do not give medical advice.`,
            },
            { role: 'user', content: `Data:\n${context}\n\nUser question: ${question}\n\nAnswer briefly:` },
          ])
          setVoiceBubble(response)
          store.toast(response, 'ts')
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Could not answer. Please try again.'
          setVoiceBubble(errMsg)
          store.toast(errMsg, 'te')
        }
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
