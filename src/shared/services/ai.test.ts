import { describe, it, expect, vi, afterEach } from 'vitest'

// vi.doMock + vi.resetModules lets each test load a fresh module with its own env mock.
afterEach(() => vi.resetModules())

function mockDeps(supabaseUrl?: string) {
  vi.doMock('@/shared/lib/env', () => ({ env: { supabaseUrl } }))
  vi.doMock('@/shared/lib/supabase', () => ({
    supabase: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      functions: { invoke: vi.fn() },
    },
  }))
}

describe('AIService', () => {
  describe('isConfigured', () => {
    it('returns true when supabaseUrl is set', async () => {
      mockDeps('https://test.supabase.co')
      const { AIService } = await import('@/shared/services/ai')
      expect(AIService.isConfigured()).toBe(true)
    })

    it('returns false when supabaseUrl is absent', async () => {
      mockDeps(undefined)
      const { AIService } = await import('@/shared/services/ai')
      expect(AIService.isConfigured()).toBe(false)
    })
  })
})
