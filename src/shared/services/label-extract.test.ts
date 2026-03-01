import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => vi.resetModules())

function mockDeps(isDemoApp: boolean) {
  vi.doMock('@/shared/lib/env', () => ({ isDemoApp, env: {} }))
  vi.doMock('@/shared/lib/supabase', () => ({
    supabase: { functions: { invoke: vi.fn() } },
  }))
}

describe('extractFromImages', () => {
  it('throws immediately when passed an empty file list', async () => {
    mockDeps(false)
    const { extractFromImages } = await import('@/shared/services/label-extract')
    await expect(extractFromImages([])).rejects.toThrow('At least one image is required.')
  })

  it('throws a demo-mode error when isDemoApp is true', async () => {
    mockDeps(true)
    const { extractFromImages } = await import('@/shared/services/label-extract')
    const file = new File(['x'], 'label.jpg', { type: 'image/jpeg' })
    await expect(extractFromImages([file])).rejects.toThrow('not available in demo mode')
  })
})
