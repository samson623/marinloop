import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/shared/services/ai', () => ({ AIService: { chat: vi.fn(), isConfigured: vi.fn() } }))

import { coerceResult, heuristicParse, VoiceIntentService } from '@/shared/services/voice-intent'
import { AIService } from '@/shared/services/ai'

describe('coerceResult', () => {
  it('returns default for null or non-object', () => {
    expect(coerceResult(null).intent).toBe('unknown')
    expect(coerceResult(undefined).intent).toBe('unknown')
    expect(coerceResult('').intent).toBe('unknown')
    expect(coerceResult(42).intent).toBe('unknown')
  })

  it('accepts valid intent and passes through entities', () => {
    const out = coerceResult({
      intent: 'navigate',
      entities: { navigate: { target: 'meds' } },
      confidence: 0.9,
      missing: [],
      requires_confirmation: false,
    })
    expect(out.intent).toBe('navigate')
    expect(out.entities.navigate?.target).toBe('meds')
    expect(out.confidence).toBe(0.9)
    expect(out.requires_confirmation).toBe(false)
  })

  it('defaults invalid intent to unknown', () => {
    const out = coerceResult({ intent: 'invalid', entities: {}, confidence: 0.5 })
    expect(out.intent).toBe('unknown')
  })

  it('clamps confidence to [0, 1]', () => {
    expect(coerceResult({ intent: 'navigate', entities: {}, confidence: 1.5 }).confidence).toBe(1)
    expect(coerceResult({ intent: 'navigate', entities: {}, confidence: -0.1 }).confidence).toBe(0)
    expect(coerceResult({ intent: 'navigate', entities: {}, confidence: NaN }).confidence).toBe(0)
  })

  it('defaults requires_confirmation for log_dose and create_reminder', () => {
    const logDose = coerceResult({ intent: 'log_dose', entities: {}, confidence: 0.8 })
    expect(logDose.requires_confirmation).toBe(true)
    const reminder = coerceResult({ intent: 'create_reminder', entities: {}, confidence: 0.8 })
    expect(reminder.requires_confirmation).toBe(true)
  })

  it('filters missing to strings only', () => {
    const out = coerceResult({
      intent: 'open_add_med',
      entities: {},
      confidence: 0.8,
      missing: ['name', 1, null, 'dosage'],
    })
    expect(out.missing).toEqual(['name', 'dosage'])
  })

  it('passes assistant_message when string', () => {
    const out = coerceResult({
      intent: 'add_note',
      entities: {},
      confidence: 0.8,
      assistant_message: 'What should the note say?',
    })
    expect(out.assistant_message).toBe('What should the note say?')
  })
})

describe('heuristicParse', () => {
  it('parses "next dose" as query_next_dose', () => {
    const out = heuristicParse('what is my next dose')
    expect(out.intent).toBe('query_next_dose')
    expect(out.confidence).toBe(0.8)
  })

  it('parses "took" as log_dose taken', () => {
    const out = heuristicParse('I took my medicine')
    expect(out.intent).toBe('log_dose')
    expect(out.entities.dose?.status).toBe('taken')
    expect(out.requires_confirmation).toBe(true)
  })

  it('parses "missed" as log_dose missed', () => {
    const out = heuristicParse('I missed the morning dose')
    expect(out.intent).toBe('log_dose')
    expect(out.entities.dose?.status).toBe('missed')
  })

  it('parses "remind" with in N minutes', () => {
    const out = heuristicParse('remind me in 30 minutes')
    expect(out.intent).toBe('create_reminder')
    expect(out.entities.reminder?.in_minutes).toBe(30)
    expect(out.missing).toEqual([])
  })

  it('parses "remind" without time sets missing', () => {
    const out = heuristicParse('remind me to take medicine')
    expect(out.intent).toBe('create_reminder')
    expect(out.missing).toContain('reminder.time')
  })

  it('parses "add medication" as open_add_med', () => {
    const out = heuristicParse('add medication twice daily at 9am')
    expect(out.intent).toBe('open_add_med')
    expect(out.entities.medication?.freq).toBe(2)
  })

  it('parses "add medication by scanning" with entry_method scan', () => {
    const out = heuristicParse('add medication by scanning barcode')
    expect(out.intent).toBe('open_add_med')
    expect(out.entities.medication?.entry_method).toBe('scan')
  })

  it('parses "add medication from photo" with entry_method photo', () => {
    const out = heuristicParse('add medication from a photo of the label')
    expect(out.intent).toBe('open_add_med')
    expect(out.entities.medication?.entry_method).toBe('photo')
  })

  it('parses schedule/agenda questions as query', () => {
    const out = heuristicParse("what's my schedule for today")
    expect(out.intent).toBe('query')
    expect(out.entities.query?.question).toBe("what's my schedule for today")
  })

  it('parses "what meds do I have" as query', () => {
    const out = heuristicParse('what meds do I have')
    expect(out.intent).toBe('query')
  })

  it('parses "add appointment" as open_add_appt', () => {
    const out = heuristicParse('add appointment tomorrow at 3pm')
    expect(out.intent).toBe('open_add_appt')
  })

  it('parses "add note" with text', () => {
    const out = heuristicParse('add note felt dizzy today')
    expect(out.intent).toBe('add_note')
    expect(out.entities.note?.text).toMatch(/felt dizzy/)
    expect(out.missing).toEqual([])
  })

  it('parses "add note for X: content"', () => {
    const out = heuristicParse('add note for aspirin: with food')
    expect(out.intent).toBe('add_note')
    expect(out.entities.note?.medication_name).toBe('aspirin')
    expect(out.entities.note?.text).toBe('with food')
  })

  it('parses navigate to timeline', () => {
    const out = heuristicParse('go to timeline')
    expect(out.intent).toBe('navigate')
    expect(out.entities.navigate?.target).toBe('timeline')
  })

  it('parses navigate to meds', () => {
    const out = heuristicParse('show medications')
    expect(out.intent).toBe('navigate')
    expect(out.entities.navigate?.target).toBe('meds')
  })

  it('parses navigate to summary', () => {
    const out = heuristicParse('open summary')
    expect(out.intent).toBe('navigate')
    expect(out.entities.navigate?.target).toBe('summary')
  })

  it('returns unknown for unrecognized text', () => {
    const out = heuristicParse('hello world')
    expect(out.intent).toBe('unknown')
    expect(out.confidence).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// VoiceIntentService.parseTranscript — AI consent enforcement
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.clearAllMocks()
})

describe('VoiceIntentService.parseTranscript', () => {
  describe('when isConsented is false', () => {
    it('returns heuristic result without calling AIService.chat', async () => {
      vi.mocked(AIService.isConfigured).mockReturnValue(true)

      const result = await VoiceIntentService.parseTranscript('what is my next dose', false)

      expect(result.intent).toBe('query_next_dose')
      expect(AIService.chat).not.toHaveBeenCalled()
    })

    it('does not call AIService.isConfigured when isConsented is false', async () => {
      vi.mocked(AIService.isConfigured).mockReturnValue(true)

      await VoiceIntentService.parseTranscript('go to meds', false)

      expect(AIService.isConfigured).not.toHaveBeenCalled()
    })

    it('returns heuristic result for a log_dose phrase when not consented', async () => {
      const result = await VoiceIntentService.parseTranscript('I took my medicine', false)

      expect(result.intent).toBe('log_dose')
      expect(result.entities.dose?.status).toBe('taken')
      expect(AIService.chat).not.toHaveBeenCalled()
    })

    it('returns unknown intent for unrecognized text without calling AI', async () => {
      const result = await VoiceIntentService.parseTranscript('hello world', false)

      expect(result.intent).toBe('unknown')
      expect(AIService.chat).not.toHaveBeenCalled()
    })
  })

  describe('when isConsented is true', () => {
    it('calls AIService.chat when AIService is configured and heuristic returns unknown', async () => {
      vi.mocked(AIService.isConfigured).mockReturnValue(true)
      // Return a valid navigate JSON so the result is not 'unknown' (avoiding heuristic fallback)
      vi.mocked(AIService.chat).mockResolvedValue(
        JSON.stringify({ intent: 'navigate', entities: { navigate: { target: 'meds' } }, confidence: 0.9, missing: [], requires_confirmation: false })
      )

      const result = await VoiceIntentService.parseTranscript('hello world', true)

      expect(AIService.chat).toHaveBeenCalledOnce()
      expect(result.intent).toBe('navigate')
    })

    it('falls back to heuristic when AIService is not configured', async () => {
      vi.mocked(AIService.isConfigured).mockReturnValue(false)

      const result = await VoiceIntentService.parseTranscript('what is my next dose', true)

      expect(AIService.chat).not.toHaveBeenCalled()
      expect(result.intent).toBe('query_next_dose')
    })

    it('falls back to heuristic when AIService.chat throws', async () => {
      vi.mocked(AIService.isConfigured).mockReturnValue(true)
      vi.mocked(AIService.chat).mockRejectedValue(new Error('network failure'))

      const result = await VoiceIntentService.parseTranscript('what is my next dose', true)

      expect(result.intent).toBe('query_next_dose')
    })

    it('falls back to heuristic when AI returns unknown intent', async () => {
      vi.mocked(AIService.isConfigured).mockReturnValue(true)
      vi.mocked(AIService.chat).mockResolvedValue(
        JSON.stringify({ intent: 'unknown', entities: {}, confidence: 0, missing: [], requires_confirmation: false })
      )

      // "show medications" is recognized by heuristic as 'navigate'
      const result = await VoiceIntentService.parseTranscript('show medications', true)

      expect(result.intent).toBe('navigate')
    })

    it('falls back to heuristic when AI returns unparseable JSON', async () => {
      vi.mocked(AIService.isConfigured).mockReturnValue(true)
      vi.mocked(AIService.chat).mockResolvedValue('not json at all')

      const result = await VoiceIntentService.parseTranscript('what is my next dose', true)

      expect(result.intent).toBe('query_next_dose')
    })

    it('returns empty result for blank transcript regardless of consent', async () => {
      vi.mocked(AIService.isConfigured).mockReturnValue(true)

      const result = await VoiceIntentService.parseTranscript('   ', true)

      expect(result.intent).toBe('unknown')
      expect(AIService.chat).not.toHaveBeenCalled()
    })
  })

  describe('when isConsented is undefined (default)', () => {
    it('proceeds to call AIService when configured and transcript is unrecognized', async () => {
      vi.mocked(AIService.isConfigured).mockReturnValue(true)
      vi.mocked(AIService.chat).mockResolvedValue(
        JSON.stringify({ intent: 'navigate', entities: { navigate: { target: 'summary' } }, confidence: 0.95, missing: [], requires_confirmation: false })
      )

      const result = await VoiceIntentService.parseTranscript('hello world')

      expect(AIService.chat).toHaveBeenCalledOnce()
      expect(result.intent).toBe('navigate')
    })
  })
})
