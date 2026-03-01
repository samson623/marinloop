import { describe, it, expect, vi, afterEach } from 'vitest'

// vi.doMock + vi.resetModules lets each test load a fresh module with its own env mock.
afterEach(() => vi.resetModules())

function mockDeps(isDemoApp: boolean, supabaseUrl?: string) {
  vi.doMock('@/shared/lib/env', () => ({ isDemoApp, env: { supabaseUrl } }))
  vi.doMock('@/shared/lib/supabase', () => ({
    supabase: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      functions: { invoke: vi.fn() },
    },
  }))
}

describe('AIService', () => {
  describe('isConfigured', () => {
    it('returns true when in prod mode with a supabase URL', async () => {
      mockDeps(false, 'https://test.supabase.co')
      const { AIService } = await import('@/shared/services/ai')
      expect(AIService.isConfigured()).toBe(true)
    })

    it('returns false when supabaseUrl is absent', async () => {
      mockDeps(false, undefined)
      const { AIService } = await import('@/shared/services/ai')
      expect(AIService.isConfigured()).toBe(false)
    })

    it('returns false in demo mode even if supabaseUrl is set', async () => {
      mockDeps(true, 'https://test.supabase.co')
      const { AIService } = await import('@/shared/services/ai')
      expect(AIService.isConfigured()).toBe(false)
    })
  })

  describe('chat', () => {
    it('returns a demo placeholder in demo mode without hitting the network', async () => {
      mockDeps(true)
      const { AIService } = await import('@/shared/services/ai')
      const result = await AIService.chat([{ role: 'user', content: 'hi' }])
      expect(result).toContain('Demo mode')
    })
  })
})
