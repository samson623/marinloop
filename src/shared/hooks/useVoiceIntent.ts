import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, fT, fD } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useNotes } from '@/shared/hooks/useNotes'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { useRefillPredictions } from '@/shared/hooks/useRefillPredictions'
import { VoiceIntentService } from '@/shared/services/voice-intent'
import { AIService } from '@/shared/services/ai'
import { useAIConsent } from '@/shared/hooks/useAIConsent'
import { useSubscription } from '@/shared/hooks/useSubscription'
import { todayLocal, isoToLocalDate, toLocalTimeString } from '@/shared/lib/dates'
import type { VoiceIntentResult } from '@/shared/types/contracts'
import type { DoseLogCreateInput } from '@/shared/types/contracts'
import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionLike,
  VoiceConfirmation,
} from '@/shared/types/voice'

export type VoiceIntentServiceLike = {
  parseTranscript: (transcript: string, isConsented?: boolean) => Promise<VoiceIntentResult>
}

export type NotificationsServiceLike = {
  create: (opts: { title: string; message: string; type?: string }) => Promise<unknown>
  sendPush: (userId: string, opts: { title: string; body: string; url: string; tag: string }) => Promise<unknown>
}

export type UseVoiceIntentOptions = {
  logDose: (input: DoseLogCreateInput) => void
  addNoteReal: (payload: { content: string; medication_id: string | null }) => void
  createReminder?: (payload: { userId: string; title: string; body: string; fireAt: Date }) => Promise<string | null>
  onAdherenceSummary?: () => void
  voiceIntentService?: VoiceIntentServiceLike
  notificationsService?: NotificationsServiceLike
}

const defaultVoiceIntentService: VoiceIntentServiceLike = VoiceIntentService

export function useVoiceIntent(options: UseVoiceIntentOptions) {
  const {
    logDose,
    addNoteReal,
    createReminder,
    onAdherenceSummary,
    voiceIntentService = defaultVoiceIntentService,
  } = options

  const navigate = useNavigate()
  const { consented } = useAIConsent()
  const { canUseAi } = useSubscription()
  const {
    openAddMedModal,
    openAddApptModal,
    assistantState,
    setAssistantPendingIntent,
    clearAssistantState,
  } = useAppStore()
  const { session } = useAuthStore()
  const { timeline } = useTimeline()
  const { meds: realMeds } = useMedications()
  const { scheds } = useSchedules()
  const { appts: realAppts } = useAppointments()
  const { notes: realNotes } = useNotes()
  const { adherence: adherenceHistory } = useAdherenceHistory(7)
  const { predictions: refillPredictions } = useRefillPredictions()

  const medsForContext = (realMeds ?? []).map((m) => {
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

  const apptsForContext = (realAppts ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    date: isoToLocalDate(a.start_time),
    time: toLocalTimeString(a.start_time),
    loc: a.location ?? '',
    notes: a.notes ? [a.notes] : [],
  }))

  const notesForContext = (realNotes ?? []).map((n) => ({
    id: n.id,
    text: n.content,
    time: n.created_at,
    medicationId: n.medication_id ?? '',
  }))

  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceBubble, setVoiceBubble] = useState('')
  const [voiceConfirmation, setVoiceConfirmation] = useState<VoiceConfirmation | null>(null)
  const [voiceTestInput, setVoiceTestInput] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const fallbackKeywordRoute = (text: string) => {
    const store = useAppStore.getState()
    const normalized = text.toLowerCase()
    if (normalized.includes('medication') || normalized.includes('meds')) {
      navigate('/meds')
      store.toast('Showing medications', 'ts')
      return true
    }
    if (normalized.includes('appointment') || normalized.includes('appt')) {
      navigate('/appts')
      store.toast('Showing appointments', 'ts')
      return true
    }
    if (normalized.includes('summary')) {
      navigate('/summary')
      store.toast('Showing summary', 'ts')
      return true
    }
    if (normalized.includes('timeline') || normalized.includes('schedule')) {
      navigate('/timeline')
      store.toast('Showing timeline', 'ts')
      return true
    }
    return false
  }

  const applyNavigation = (target?: string) => {
    const store = useAppStore.getState()
    if (target === 'meds' || target === 'appts' || target === 'summary' || target === 'timeline') {
      navigate('/' + target)
      store.toast(`Showing ${target === 'appts' ? 'appointments' : target}`, 'ts')
      return true
    }
    return false
  }

  const findDoseTarget = (intent: VoiceIntentResult) => {
    const name = intent.entities.dose?.medication_name?.toLowerCase()
    const pendingMeds = timeline.filter((item) => item.type === 'med' && item.status === 'pending')
    if (pendingMeds.length === 0) return null
    if (name) {
      const match = pendingMeds.find((item) => item.name.toLowerCase().includes(name))
      if (match) return match
    }
    return pendingMeds.find((item) => item.isNext) ?? pendingMeds[0]
  }

  const scheduleReminder = async (intent: VoiceIntentResult) => {
    const draft = intent.entities.reminder
    const inMinutes = draft?.in_minutes
    if (!inMinutes || inMinutes <= 0) {
      useAppStore.getState().toast('Please provide a reminder time (for example, "in 60 minutes").', 'tw')
      return
    }
    const title = draft?.title || 'Medication reminder'
    const fireAt = new Date(Date.now() + inMinutes * 60 * 1000)
    const timeStr = fireAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
    // Build a descriptive body: use the original transcript if available, otherwise describe the time
    const body = draft?.message || `Reminder: ${title} at ${timeStr}`

    if (createReminder && session?.user?.id) {
      await createReminder({ userId: session.user.id, title, body, fireAt })
    }

    useAppStore.getState().toast(`Reminder set for ${timeStr}`, 'ts')
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
    const intent = await voiceIntentService.parseTranscript(contextualTranscript, consented)

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
        navigate('/meds')
        openAddMedModal(
          {
            name: intent.entities.medication?.name,
            dose: intent.entities.medication?.dosage,
            freq: intent.entities.medication?.freq,
            time: intent.entities.medication?.time,
            instructions: intent.entities.medication?.instructions,
            warnings: intent.entities.medication?.warnings,
            supply: intent.entities.medication?.supply,
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
        navigate('/appts')
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
        const next = timeline.find((item) => item.type === 'med' && item.status === 'pending')
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
        if (!target || !target.medicationId) {
          store.toast('I could not find a dose to log right now.', 'tw')
          return
        }
        const medicationId = target.medicationId
        const status = intent.entities.dose?.status ?? 'taken'
        const confirmationMessage = status === 'missed'
          ? `Mark ${target.name} (${target.time}) as missed?`
          : `Log ${target.name} (${target.time}) as taken?`
        setVoiceConfirmation({
          message: confirmationMessage,
          onConfirm: () => {
            logDose({
              medication_id: medicationId,
              schedule_id: target.id,
              taken_at: new Date().toISOString(),
              status: status === 'missed' ? 'missed' : 'taken',
              notes: null,
            })
            setVoiceConfirmation(null)
          },
        })
        return
      }
      case 'create_reminder': {
        const reminderDraft = intent.entities.reminder
        const reminderMinutes = reminderDraft?.in_minutes
        if (!reminderMinutes || reminderMinutes <= 0) {
          store.toast('How many minutes? Say "remind me in 10 minutes".', 'tw')
          return
        }
        const reminderTitle = reminderDraft?.title || 'Reminder'
        const reminderFireAt = new Date(Date.now() + reminderMinutes * 60 * 1000)
        const reminderTimeStr = reminderFireAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
        setVoiceConfirmation({
          message: `"${reminderTitle}" at ${reminderTimeStr}?`,
          onConfirm: () => {
            scheduleReminder(intent)
            setVoiceConfirmation(null)
          },
        })
        return
      }
      case 'add_note': {
        const noteText = intent.entities.note?.text?.trim()
        if (!noteText) {
          store.toast('What should the note say? Say "add note" then your note.', 'tw')
          return
        }
        const medName = intent.entities.note?.medication_name?.trim()
        const med = medName ? medsForContext.find((m) => m.name.toLowerCase().includes(medName.toLowerCase())) : null
        const medicationId = med?.id ?? null
        addNoteReal({ content: noteText, medication_id: medicationId })
        setVoiceBubble(med ? `Note added for ${med.name}.` : 'Note saved.')
        return
      }
      case 'adherence_summary':
        navigate('/summary')
        store.toast('Loading your adherence summary...', 'ts')
        onAdherenceSummary?.()
        return
      case 'query': {
        const question = intent.entities.query?.question ?? transcript
        const timelineStr = timeline
          .map((i) => {
            const statusLabel = i.status === 'done' ? '✓' : i.status === 'missed' ? 'missed' : i.status === 'late' ? 'late' : 'pending'
            return `- ${i.type === 'med' ? 'Med' : 'Appt'}: ${i.name}${i.dose ? ` ${i.dose}` : ''} at ${i.time} (${statusLabel})`
          })
          .join('\n')
        const medsStr = medsForContext
          .map((m) => {
            const t = (m as { times?: string[] }).times ?? []
            const times = t.length ? t.map(fT).join(', ') : ''
            return `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${times ? ` at ${times}` : ''} (${m.freq ?? 1}x daily)`
          })
          .join('\n')
        const apptsStr = apptsForContext
          .map((a) => `- ${a.title} on ${fD(a.date)} at ${fT(a.time)}${a.loc ? ` — ${a.loc}` : ''}`)
          .join('\n')
        const notesStr = notesForContext
          .map((n) => `- ${n.text}${n.medicationId ? ` (med link)` : ''}`)
          .join('\n')
        const adherenceStr = Object.entries(adherenceHistory)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, val]) => {
            const rec = val as { t?: number; d?: number }
            const pct = rec.t ? Math.round(((rec.d ?? 0) / rec.t) * 100) : 0
            return `- ${date}: ${pct}%`
          })
          .join('\n')
        const refillStr = refillPredictions
          .filter((p) => p.severity !== 'ok')
          .map((p) => `- ${p.medName}: ${p.daysLeft} day${p.daysLeft !== 1 ? 's' : ''} left (${p.severity})`)
          .join('\n')
        const context = `Today is ${todayLocal()}.

## Today's schedule (timeline)
${timelineStr || 'No items for today.'}

## Medications
${medsStr || 'No medications.'}

## Appointments
${apptsStr || 'No appointments.'}

## Notes
${notesStr || 'No notes.'}

## 7-day adherence (date: %)
${adherenceStr || 'No adherence data.'}

## Refill alerts
${refillStr || 'No urgent refills.'}`

        if (!canUseAi) {
          const msg = 'AI features require Basic or Pro. Upgrade in Profile \u2192 Subscription.'
          setVoiceBubble(msg)
          store.toast(msg, 'tw')
          return
        }
        if (!consented) {
          const msg = 'AI features require consent. Enable them in Profile \u2192 Data & Privacy.'
          setVoiceBubble(msg)
          store.toast(msg, 'tw')
          return
        }
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
              content: `You are MarinLoop's medication tracking assistant. Answer the user's question using ONLY the data below. Be concise (1-3 sentences). Cite specifics. Do not make up data. If the data doesn't contain the answer, say so clearly. Do not give medical advice. Do not provide clinical recommendations or interpret health data.`,
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
