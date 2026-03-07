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

const VOICE_INTENT_SYSTEM_PROMPT = `You are a clinical voice assistant for MarinLoop. Convert the user's voice command into strict JSON.

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
- adherence_summary: user wants to see their adherence overview or weekly report. Use for: "how am I doing?", "my adherence", "weekly summary", "adherence summary", "how'm I doing?"
- query: any question about the user's schedule, medications, appointments, notes, agenda. Use for: "what's my schedule?", "what meds do I have?", "where is my agenda?", "what are my notes?"
- unknown: cannot determine intent

## Entity schemas
For open_add_med: entities.medication = { name?, dosage?, freq?, time?, instructions?, warnings?, supply?, entry_method? }
  - entry_method: "scan" | "photo" | "manual"
  - Extract medication name, dosage (e.g. "500mg"), frequency (1/2/3), time (HH:mm) from speech
For open_add_appt: entities.appointment = { title?, date? (YYYY-MM-DD), time?, location?, notes? }
For create_reminder: entities.reminder = { title?, message?, in_minutes? }
  - title: short human label (e.g. "Take Metformin", "Call pharmacy"). Default "Reminder" if not specified.
  - in_minutes: integer minutes from now. Convert ALL word numbers ("five"→5, "ten"→10, "thirty"→30, "one hour"→60, "two hours"→120, "an hour"→60, "half an hour"→30, "fifteen minutes"→15). Required.
  - message: optional extra user-provided detail only; leave empty if the user did not provide one
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
    && ['navigate', 'open_add_med', 'open_add_appt', 'create_reminder', 'log_dose', 'query_next_dose', 'add_note', 'query', 'adherence_summary', 'unknown'].includes(value)
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

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90,
}

/** Parse "in X minutes/hours" from a lowercased reminder transcript, returns total minutes or null. */
function parseReminderMinutes(lowered: string): number | null {
  // "half an hour" → 30
  if (/half\s+an?\s+hour/.test(lowered)) return 30
  // "an hour" → 60
  if (/\ban\s+hour\b/.test(lowered)) return 60

  // Digit form: "in 5 minutes", "in 2 hours"
  const digitMin = lowered.match(/\bin\s+(\d+)\s*(?:minute|minutes|min|mins)\b/)
  if (digitMin) return Number.parseInt(digitMin[1], 10)
  const digitHr = lowered.match(/\bin\s+(\d+)\s*(?:hour|hours|hr|hrs)\b/)
  if (digitHr) return Number.parseInt(digitHr[1], 10) * 60

  // Word form: "in five minutes", "in two hours"
  const wordPattern = /\bin\s+([\w\s-]+?)\s*(?:minute|minutes|min|mins|hour|hours|hr|hrs)\b/
  const wordMatch = lowered.match(wordPattern)
  if (wordMatch) {
    const phrase = wordMatch[1].trim()
    const isHours = /\b(hour|hours|hr|hrs)\b/.test(lowered.slice(lowered.indexOf(phrase)))
    const num = WORD_NUMBERS[phrase] ?? null
    if (num != null) return isHours ? num * 60 : num
  }

  return null
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
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
    const inMinutes = parseReminderMinutes(lowered)
    // Extract a meaningful title: "remind me to TAKE MY MEDS in 5 minutes" → "Take my meds"
    const titleMatch = lowered.match(/remind\s+(?:me\s+)?(?:to\s+)(.+?)(?:\s+in\s+\d|\s+in\s+\w+\s+(?:minute|hour)|\s+after\s+|$)/i)
    const rawTitle = titleMatch?.[1]?.trim()
    // Reject titles that are just time references (e.g. "in 5 minutes") or too short
    const isTimeRef = rawTitle ? /^(?:in\s+)?\d+\s*(?:min|minute|hour|hr)/i.test(rawTitle) : true
    const title = rawTitle && rawTitle.length > 2 && rawTitle.length < 60 && !isTimeRef ? capitalize(rawTitle) : 'Reminder'
    return {
      intent: 'create_reminder',
      entities: {
        reminder: {
          title,
          message: text,
          in_minutes: inMinutes ?? undefined,
        },
      },
      confidence: 0.7,
      missing: inMinutes != null ? [] : ['reminder.time'],
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

  // Adherence summary intent — dedicated patterns
  const adherenceSummaryPattern = /(how am i doing|my adherence|weekly (summary|report)|adherence summary|how('?m| am) i doing)/i
  if (adherenceSummaryPattern.test(lowered)) {
    return {
      intent: 'adherence_summary',
      entities: {},
      confidence: 0.9,
      missing: [],
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
