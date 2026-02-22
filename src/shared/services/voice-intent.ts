import { AIService } from '@/shared/services/ai'
import { todayLocal, dateOffset } from '@/shared/lib/dates'
import type {
  VoiceIntentResult,
  VoiceIntentType,
  VoiceNavigateTarget,
  VoiceAddMedEntryMethod,
} from '@/shared/types/contracts'

const DEFAULT_RESULT: VoiceIntentResult = {
  intent: 'unknown',
  entities: {},
  confidence: 0,
  missing: [],
  requires_confirmation: false,
}

const VOICE_INTENT_SYSTEM_PROMPT = `You are a clinical voice assistant for MedFlow Care. Convert the user's voice command into strict JSON.

Return only JSON with keys: intent, entities, confidence, missing, requires_confirmation, assistant_message.
Do not include markdown fences.

## Intents
- navigate: switch view (timeline, meds, appts, summary)
- open_add_med: add a new medication. Use entry_method "scan" if user wants to scan barcode, "photo" if they want to take/upload a label photo, "manual" otherwise.
- open_add_appt: add an appointment
- create_reminder: set a reminder in X minutes
- log_dose: mark a dose as taken or missed
- query_next_dose: when is the next dose
- add_note: add a note (standalone or for a medication)
- query: any question about the user's schedule, medications, appointments, notes, adherence, agenda. Use for: "what's my schedule?", "what meds do I have?", "where is my agenda?", "what are my notes?", "how's my adherence?"
- unknown: cannot determine intent

## Entity schemas
For open_add_med: entities.medication = { name?, dosage?, freq?, time?, instructions?, warnings?, supply?, entry_method? }
  - entry_method: "scan" | "photo" | "manual"
  - Extract medication name, dosage (e.g. "500mg"), frequency (1/2/3), time (HH:mm) from speech
For open_add_appt: entities.appointment = { title?, date? (YYYY-MM-DD), time?, location?, notes? }
For add_note: entities.note = { text, medication_name? }
For query: entities.query = { question: the user's exact question }
For navigate: entities.navigate = { target: "timeline"|"meds"|"appts"|"summary" }

## Rules
- confidence: 0-1. Use 0.9+ for clear commands, 0.6-0.8 for ambiguous.
- missing: array of required field names if intent needs more info.
- requires_confirmation: true for create_reminder, log_dose.
- Questions about user data (schedule, meds, agenda, notes, adherence) → intent: "query", entities.query.question.`

const NAV_TARGETS: Array<{ needles: string[]; target: VoiceNavigateTarget }> = [
  { needles: ['timeline', 'schedule'], target: 'timeline' },
  { needles: ['medication', 'medications', 'med', 'meds'], target: 'meds' },
  { needles: ['appointment', 'appointments', 'appt', 'appts'], target: 'appts' },
  { needles: ['summary'], target: 'summary' },
]

function clampConfidence(v: unknown): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function isIntent(value: unknown): value is VoiceIntentType {
  return typeof value === 'string'
    && ['navigate', 'open_add_med', 'open_add_appt', 'create_reminder', 'log_dose', 'query_next_dose', 'add_note', 'query', 'unknown'].includes(value)
}

export function coerceResult(raw: unknown): VoiceIntentResult {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_RESULT }
  const value = raw as Record<string, unknown>
  const intent = isIntent(value.intent) ? value.intent : 'unknown'
  const entities = value.entities && typeof value.entities === 'object'
    ? (value.entities as VoiceIntentResult['entities'])
    : {}
  const confidence = clampConfidence(value.confidence)
  const missing = Array.isArray(value.missing)
    ? value.missing.filter((x): x is string => typeof x === 'string')
    : []
  const requiresConfirmation = typeof value.requires_confirmation === 'boolean'
    ? value.requires_confirmation
    : (intent === 'create_reminder' || intent === 'log_dose')
  const assistantMessage = typeof value.assistant_message === 'string' ? value.assistant_message : undefined

  return {
    intent,
    entities,
    confidence,
    missing,
    requires_confirmation: requiresConfirmation,
    assistant_message: assistantMessage,
  }
}

function extractJsonObject(text: string): string | null {
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first < 0 || last <= first) return null
  return text.slice(first, last + 1)
}

function parseTimeFromText(lowered: string): string | undefined {
  const hhmm = lowered.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (hhmm) return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`

  const ampm = lowered.match(/\b(1[0-2]|0?[1-9])\s?(am|pm)\b/)
  if (!ampm) return undefined
  let hour = Number.parseInt(ampm[1], 10)
  const suffix = ampm[2]
  if (suffix === 'pm' && hour < 12) hour += 12
  if (suffix === 'am' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:00`
}

export function heuristicParse(text: string): VoiceIntentResult {
  const lowered = text.toLowerCase()

  if (lowered.includes('next dose')) {
    return {
      intent: 'query_next_dose',
      entities: {},
      confidence: 0.8,
      missing: [],
      requires_confirmation: false,
    }
  }

  if (lowered.includes('took') || lowered.includes('missed')) {
    return {
      intent: 'log_dose',
      entities: {
        dose: {
          status: lowered.includes('missed') ? 'missed' : 'taken',
        },
      },
      confidence: 0.75,
      missing: [],
      requires_confirmation: true,
    }
  }

  if (lowered.includes('remind')) {
    const minutesMatch = lowered.match(/\bin\s+(\d+)\s*(minute|minutes|min)\b/)
    const inMinutes = minutesMatch ? Number.parseInt(minutesMatch[1], 10) : undefined
    return {
      intent: 'create_reminder',
      entities: {
        reminder: {
          title: 'Medication reminder',
          message: text,
          in_minutes: Number.isFinite(inMinutes) ? inMinutes : undefined,
        },
      },
      confidence: 0.7,
      missing: inMinutes ? [] : ['reminder.time'],
      requires_confirmation: true,
    }
  }

  if (lowered.includes('add medication') || lowered.includes('new medication')) {
    const frequency = lowered.includes('twice') ? 2 : lowered.includes('three') ? 3 : lowered.includes('once') ? 1 : undefined
    const entryMethod: VoiceAddMedEntryMethod | undefined =
      (lowered.includes('scan') || lowered.includes('barcode')) ? 'scan'
        : (lowered.includes('photo') || lowered.includes('picture') || lowered.includes('upload') || lowered.includes('label')) ? 'photo'
          : 'manual'
    const medNameMatch = lowered.match(/(?:add|new)\s+medication\s+(?:called\s+)?([a-z][a-z0-9\s-]+?)(?:\s+\d|\s+twice|\s+at|$)/i)
    const doseMatch = lowered.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?))\b/i)
    return {
      intent: 'open_add_med',
      entities: {
        medication: {
          name: medNameMatch?.[1]?.trim(),
          dosage: doseMatch?.[1],
          freq: frequency,
          time: parseTimeFromText(lowered),
          entry_method: entryMethod,
        },
      },
      confidence: 0.78,
      missing: [],
      requires_confirmation: false,
    }
  }

  if (lowered.includes('add appointment') || lowered.includes('schedule appointment')) {
    const titleMatch = lowered.match(/(?:with|see)\s+(?:dr\.?|doctor)?\s*([a-z][a-z0-9\s.-]+?)(?:\s+at|\s+on|$)/i)
    const dateMatch = lowered.match(/\b(?:on|for)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/i)
    let date: string | undefined
    if (dateMatch) {
      const d = dateMatch[1].toLowerCase()
      date = d === 'today' ? todayLocal() : d === 'tomorrow' ? dateOffset(1) : undefined
    }
    return {
      intent: 'open_add_appt',
      entities: {
        appointment: {
          title: titleMatch?.[1]?.trim(),
          time: parseTimeFromText(lowered),
          date,
        },
      },
      confidence: 0.76,
      missing: [],
      requires_confirmation: false,
    }
  }

  if (lowered.includes('add') && (lowered.includes('note') || lowered.includes('note for'))) {
    const forMedMatch = lowered.match(/note\s+for\s+([^:.,]+):?\s*(.*)/)
    const simpleMatch = !forMedMatch ? lowered.match(/add\s+note:?\s*(.*)/) : null
    const medication_name = forMedMatch?.[1]?.trim()
    const noteText = (forMedMatch?.[2] ?? simpleMatch?.[1] ?? '').trim()
    return {
      intent: 'add_note',
      entities: { note: { medication_name: medication_name || undefined, text: noteText } },
      confidence: 0.75,
      missing: !noteText ? ['note.text'] : [],
      requires_confirmation: false,
    }
  }

  if (lowered.startsWith('note ') || lowered.startsWith('note:') || lowered === 'note') {
    const noteText = lowered.replace(/^note:?\s*/, '').trim()
    return {
      intent: 'add_note',
      entities: { note: { text: noteText } },
      confidence: 0.72,
      missing: !noteText ? ['note.text'] : [],
      requires_confirmation: false,
    }
  }

  if ((lowered.includes('question') || lowered.includes('ask doctor')) && (lowered.includes('add') || lowered.includes('remind') || lowered.includes('note'))) {
    const noteText = lowered
      .replace(/^(add\s+)?(question|ask\s+doctor|remind\s+me\s+to\s+ask):?\s*/i, '')
      .replace(/^(add\s+)?note:?\s*/i, '')
      .trim()
    return {
      intent: 'add_note',
      entities: { note: { text: noteText } },
      confidence: 0.72,
      missing: !noteText ? ['note.text'] : [],
      requires_confirmation: false,
    }
  }

  const questionPatterns = [
    /\b(what|where|when|how|show|tell|list|give)\b.*\b(schedule|agenda|meds?|medication|appointment|note|adherence|today)\b/i,
    /\b(what|do)\s+(i\s+have|meds)\b/i,
    /\b(my\s+)(schedule|agenda|meds|notes|appointments?)\b/i,
    /\bwhat('s| is)\s+on\s+(my\s+)?(schedule|agenda)\b/i,
    /\bwhen\s+is\s+my\s+next\b/i,
  ]
  if (questionPatterns.some((p) => p.test(lowered)) && !lowered.includes('add') && !lowered.includes('log') && !lowered.includes('remind')) {
    return {
      intent: 'query',
      entities: { query: { question: text.trim() } },
      confidence: 0.82,
      missing: [],
      requires_confirmation: false,
    }
  }

  for (const candidate of NAV_TARGETS) {
    if (candidate.needles.some((needle) => lowered.includes(needle))) {
      return {
        intent: 'navigate',
        entities: { navigate: { target: candidate.target } },
        confidence: 0.7,
        missing: [],
        requires_confirmation: false,
      }
    }
  }

  return { ...DEFAULT_RESULT }
}

export const VoiceIntentService = {
  async parseTranscript(transcript: string): Promise<VoiceIntentResult> {
    const clean = transcript.trim()
    if (!clean) return { ...DEFAULT_RESULT }

    try {
      if (!AIService.isConfigured()) return heuristicParse(clean)

      const response = await AIService.chat([
        { role: 'system', content: VOICE_INTENT_SYSTEM_PROMPT },
        { role: 'user', content: clean },
      ])

      const jsonText = extractJsonObject(response)
      if (!jsonText) return heuristicParse(clean)
      const parsed = JSON.parse(jsonText) as unknown
      const result = coerceResult(parsed)
      return result.intent === 'unknown' ? heuristicParse(clean) : result
    } catch {
      return heuristicParse(clean)
    }
  },
}
