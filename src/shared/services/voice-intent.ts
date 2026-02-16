import { AIService } from '@/shared/services/ai'
import type {
  VoiceIntentResult,
  VoiceIntentType,
  VoiceNavigateTarget,
} from '@/shared/types/contracts'

const DEFAULT_RESULT: VoiceIntentResult = {
  intent: 'unknown',
  entities: {},
  confidence: 0,
  missing: [],
  requires_confirmation: false,
}

const VOICE_INTENT_SYSTEM_PROMPT = [
  'You convert a voice command into strict JSON.',
  'Return only JSON with keys:',
  'intent, entities, confidence, missing, requires_confirmation, assistant_message.',
  'intent must be one of: navigate, open_add_med, open_add_appt, create_reminder, log_dose, query_next_dose, unknown.',
  'confidence must be a number in [0,1].',
  'missing must be an array of field names that are required to complete the intent.',
  'requires_confirmation should be true for write actions (create_reminder, log_dose).',
  'Do not include markdown fences.',
].join(' ')

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
    && ['navigate', 'open_add_med', 'open_add_appt', 'create_reminder', 'log_dose', 'query_next_dose', 'unknown'].includes(value)
}

function coerceResult(raw: unknown): VoiceIntentResult {
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

function heuristicParse(text: string): VoiceIntentResult {
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
    const frequency = lowered.includes('twice') ? 2 : lowered.includes('three') ? 3 : undefined
    return {
      intent: 'open_add_med',
      entities: {
        medication: {
          freq: frequency,
          time: parseTimeFromText(lowered),
        },
      },
      confidence: 0.76,
      missing: [],
      requires_confirmation: false,
    }
  }

  if (lowered.includes('add appointment') || lowered.includes('schedule appointment')) {
    return {
      intent: 'open_add_appt',
      entities: {
        appointment: {
          time: parseTimeFromText(lowered),
        },
      },
      confidence: 0.76,
      missing: parseTimeFromText(lowered) ? [] : ['appointment.time'],
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
