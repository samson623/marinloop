/**
 * useVoiceIntent — AI consent enforcement tests
 *
 * These tests focus on the two consent-gated paths inside useVoiceIntent:
 *
 * 1. parseTranscript receives the `consented` flag from useAIConsent so the
 *    service can skip AI when consent has not been granted.
 *
 * 2. The `query` case inside processVoice calls AIService.chat directly only
 *    when `consented` is true. When `consented` is false it short-circuits
 *    with a "consent required" message without touching AIService.
 *
 * The hook has many internal data dependencies (timeline, meds, schedules,
 * appointments, notes, adherence, refills). All of them are mocked to return
 * empty arrays so the tests stay focused on the consent surface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import type { VoiceIntentResult } from '@/shared/types/contracts'

// ---------------------------------------------------------------------------
// Mocks — declared before any import of the module under test
// ---------------------------------------------------------------------------

vi.mock('@/shared/components/AIConsentModal', () => ({
  useAIConsent: vi.fn(),
}))

vi.mock('@/shared/services/ai', () => ({
  AIService: {
    chat: vi.fn(),
    isConfigured: vi.fn(),
  },
}))

vi.mock('@/shared/stores/app-store', () => ({
  useAppStore: vi.fn(),
  fT: vi.fn((t: string) => t),
  fD: vi.fn((d: string) => d),
}))

vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('@/shared/hooks/useTimeline', () => ({ useTimeline: vi.fn() }))
vi.mock('@/shared/hooks/useMedications', () => ({ useMedications: vi.fn() }))
vi.mock('@/shared/hooks/useSchedules', () => ({ useSchedules: vi.fn() }))
vi.mock('@/shared/hooks/useAppointments', () => ({ useAppointments: vi.fn() }))
vi.mock('@/shared/hooks/useNotes', () => ({ useNotes: vi.fn() }))
vi.mock('@/shared/hooks/useAdherenceHistory', () => ({ useAdherenceHistory: vi.fn() }))
vi.mock('@/shared/hooks/useRefillPredictions', () => ({ useRefillPredictions: vi.fn() }))

// ---------------------------------------------------------------------------
// Deferred imports (must come AFTER vi.mock declarations)
// ---------------------------------------------------------------------------

import { useAIConsent } from '@/shared/hooks/useAIConsent'
import { AIService } from '@/shared/services/ai'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useNotes } from '@/shared/hooks/useNotes'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { useRefillPredictions } from '@/shared/hooks/useRefillPredictions'
import { useVoiceIntent } from '@/shared/hooks/useVoiceIntent'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockToast = vi.fn()
const mockOpenAddMedModal = vi.fn()
const mockOpenAddApptModal = vi.fn()
const mockSetAssistantPendingIntent = vi.fn()
const mockClearAssistantState = vi.fn()

function setupStoreMocks({ consented }: { consented: boolean }) {
  vi.mocked(useAIConsent).mockReturnValue({
    consented,
    declined: false,
    setDeclined: vi.fn(),
    consent: vi.fn(),
    revoke: vi.fn(),
  })

  vi.mocked(useAppStore).mockReturnValue({
    toast: mockToast,
    openAddMedModal: mockOpenAddMedModal,
    openAddApptModal: mockOpenAddApptModal,
    assistantState: { pendingIntent: null, missing: [] },
    setAssistantPendingIntent: mockSetAssistantPendingIntent,
    clearAssistantState: mockClearAssistantState,
  } as ReturnType<typeof useAppStore>)

  // Allow getState() pattern used inside processVoice
  const storeState = { toast: mockToast, openAddMedModal: mockOpenAddMedModal, openAddApptModal: mockOpenAddApptModal }
  vi.mocked(useAppStore).getState = vi.fn().mockReturnValue(storeState)

  vi.mocked(useAuthStore).mockReturnValue({
    session: { user: { id: 'user-1' } },
  } as ReturnType<typeof useAuthStore>)

  vi.mocked(useTimeline).mockReturnValue({ timeline: [] } as unknown as ReturnType<typeof useTimeline>)
  vi.mocked(useMedications).mockReturnValue({ meds: [] } as unknown as ReturnType<typeof useMedications>)
  vi.mocked(useSchedules).mockReturnValue({ scheds: [] } as unknown as ReturnType<typeof useSchedules>)
  vi.mocked(useAppointments).mockReturnValue({ appts: [] } as unknown as ReturnType<typeof useAppointments>)
  vi.mocked(useNotes).mockReturnValue({ notes: [] } as unknown as ReturnType<typeof useNotes>)
  vi.mocked(useAdherenceHistory).mockReturnValue({ adherence: {} } as unknown as ReturnType<typeof useAdherenceHistory>)
  vi.mocked(useRefillPredictions).mockReturnValue({ predictions: [] } as unknown as ReturnType<typeof useRefillPredictions>)
}

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    )
  }
}

function makeOptions() {
  return {
    logDose: vi.fn(),
    addNoteReal: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useVoiceIntent — AI consent enforcement', () => {
  describe('parseTranscript is called with the consented flag', () => {
    it('passes consented=false to voiceIntentService.parseTranscript when consent not granted', async () => {
      setupStoreMocks({ consented: false })

      const mockParseTranscript = vi.fn().mockResolvedValue({
        intent: 'unknown',
        entities: {},
        confidence: 0,
        missing: [],
        requires_confirmation: false,
      } as VoiceIntentResult)

      const { result } = renderHook(
        () => useVoiceIntent({ ...makeOptions(), voiceIntentService: { parseTranscript: mockParseTranscript } }),
        { wrapper: wrapper() },
      )

      await act(async () => {
        await result.current.processVoice('go to meds')
      })

      expect(mockParseTranscript).toHaveBeenCalledWith(
        expect.any(String),
        false, // consented flag forwarded
      )
    })

    it('passes consented=true to voiceIntentService.parseTranscript when consent is granted', async () => {
      setupStoreMocks({ consented: true })

      const mockParseTranscript = vi.fn().mockResolvedValue({
        intent: 'navigate',
        entities: { navigate: { target: 'meds' as const } },
        confidence: 0.9,
        missing: [],
        requires_confirmation: false,
      } as VoiceIntentResult)

      const { result } = renderHook(
        () => useVoiceIntent({ ...makeOptions(), voiceIntentService: { parseTranscript: mockParseTranscript } }),
        { wrapper: wrapper() },
      )

      await act(async () => {
        await result.current.processVoice('go to meds')
      })

      expect(mockParseTranscript).toHaveBeenCalledWith(
        expect.any(String),
        true,
      )
    })
  })

  describe('query intent — consent gating of AIService.chat', () => {
    it('shows consent-required message and does NOT call AIService.chat when consented=false', async () => {
      setupStoreMocks({ consented: false })
      vi.mocked(AIService.isConfigured).mockReturnValue(true)
      vi.mocked(AIService.chat).mockResolvedValue('should not be called')

      // Stub parseTranscript to immediately return a 'query' intent so we
      // reach the query branch inside processVoice.
      const mockParseTranscript = vi.fn().mockResolvedValue({
        intent: 'query',
        entities: { query: { question: "what's on my schedule?" } },
        confidence: 0.9,
        missing: [],
        requires_confirmation: false,
      } as VoiceIntentResult)

      const { result } = renderHook(
        () => useVoiceIntent({ ...makeOptions(), voiceIntentService: { parseTranscript: mockParseTranscript } }),
        { wrapper: wrapper() },
      )

      await act(async () => {
        await result.current.processVoice("what's on my schedule?")
      })

      // AIService.chat must NOT be called
      expect(AIService.chat).not.toHaveBeenCalled()
      // A toast with a consent message should have been emitted
      expect(mockToast).toHaveBeenCalledWith(
        expect.stringMatching(/consent/i),
        'tw',
      )
    })

    it('calls AIService.chat when consented=true and AIService is configured', async () => {
      setupStoreMocks({ consented: true })
      vi.mocked(AIService.isConfigured).mockReturnValue(true)
      vi.mocked(AIService.chat).mockResolvedValue('You have Aspirin scheduled at 9am.')

      const mockParseTranscript = vi.fn().mockResolvedValue({
        intent: 'query',
        entities: { query: { question: "what's on my schedule?" } },
        confidence: 0.9,
        missing: [],
        requires_confirmation: false,
      } as VoiceIntentResult)

      const { result } = renderHook(
        () => useVoiceIntent({ ...makeOptions(), voiceIntentService: { parseTranscript: mockParseTranscript } }),
        { wrapper: wrapper() },
      )

      await act(async () => {
        await result.current.processVoice("what's on my schedule?")
      })

      expect(AIService.chat).toHaveBeenCalledOnce()
      expect(mockToast).toHaveBeenCalledWith('You have Aspirin scheduled at 9am.', 'ts')
    })

    it('shows fallback text when consented=true but AIService is NOT configured', async () => {
      setupStoreMocks({ consented: true })
      vi.mocked(AIService.isConfigured).mockReturnValue(false)

      const mockParseTranscript = vi.fn().mockResolvedValue({
        intent: 'query',
        entities: { query: { question: "what's on my schedule?" } },
        confidence: 0.9,
        missing: [],
        requires_confirmation: false,
      } as VoiceIntentResult)

      const { result } = renderHook(
        () => useVoiceIntent({ ...makeOptions(), voiceIntentService: { parseTranscript: mockParseTranscript } }),
        { wrapper: wrapper() },
      )

      await act(async () => {
        await result.current.processVoice("what's on my schedule?")
      })

      expect(AIService.chat).not.toHaveBeenCalled()
      // Should emit some kind of toast (fallback text, not consent error)
      expect(mockToast).toHaveBeenCalledOnce()
    })
  })
})
