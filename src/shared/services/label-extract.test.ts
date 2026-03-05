import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => vi.resetModules())

function mockDeps() {
  vi.doMock('@/shared/lib/env', () => ({ env: {} }))
  vi.doMock('@/shared/lib/supabase', () => ({
    supabase: { functions: { invoke: vi.fn() } },
  }))
}

describe('extractFromImages', () => {
  it('throws immediately when passed an empty file list', async () => {
    mockDeps()
    const { extractFromImages } = await import('@/shared/services/label-extract')
    await expect(extractFromImages([])).rejects.toThrow('At least one image is required.')
  })
})
