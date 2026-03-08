import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => vi.resetModules())

// Build a minimal File-like object (jsdom provides File/Blob, but no canvas/URL APIs,
// so we stub compressImage's dependencies at the browser-API level via the mock below).
function makeFile(name = 'label.jpg'): File {
  return new File(['img'], name, { type: 'image/jpeg' })
}

function mockDeps(invokeImpl?: () => Promise<{ data: unknown; error: unknown }>) {
  vi.doMock('@/shared/lib/env', () => ({ env: {} }))
  vi.doMock('@/shared/lib/supabase', () => ({
    supabase: {
      functions: {
        invoke: vi.fn().mockImplementation(invokeImpl ?? (() => Promise.resolve({ data: { name: 'Aspirin', dosage: '500mg' }, error: null }))),
      },
    },
  }))
}

// compressImage relies on HTMLImageElement + canvas; stub them for the consent/Supabase path tests.
function mockBrowserImageApis() {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  // Stub URL.createObjectURL / revokeObjectURL
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()

  // Stub document.createElement so canvas returns a working stub
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      const canvas = originalCreateElement('canvas')
      // Provide a stub toDataURL that returns a minimal data URL
      canvas.toDataURL = vi.fn(() => 'data:image/jpeg;base64,/9j/stub')
      // Provide a stub getContext that returns a drawing stub
      canvas.getContext = vi.fn(() => ({
        drawImage: vi.fn(),
      })) as unknown as typeof canvas.getContext
      return canvas
    }
    return originalCreateElement(tag)
  })

  // Stub Image so onload fires synchronously
  const OriginalImage = window.Image
  vi.stubGlobal('Image', class MockImage {
    onload?: () => void
    onerror?: () => void
    width = 100
    height = 100
    set src(_v: string) {
      // Fire onload on next tick to mimic real behaviour
      Promise.resolve().then(() => this.onload?.())
    }
  })

  return () => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.mocked(document.createElement).mockRestore?.()
    vi.stubGlobal('Image', OriginalImage)
  }
}

describe('extractFromImages', () => {
  it('throws immediately when passed an empty file list', async () => {
    mockDeps()
    const { extractFromImages } = await import('@/shared/services/label-extract')
    await expect(extractFromImages([])).rejects.toThrow('At least one image is required.')
  })

  // -------------------------------------------------------------------------
  // AI consent enforcement
  // -------------------------------------------------------------------------

  describe('consent enforcement', () => {
    it('throws "AI consent required" immediately when isConsented is false', async () => {
      mockDeps()
      const { extractFromImages } = await import('@/shared/services/label-extract')
      const file = makeFile()

      // The consent check happens before the empty-list check, so even a
      // non-empty file list should throw about consent first.
      await expect(extractFromImages([file], undefined, false))
        .rejects.toThrow('AI consent required')
    })

    it('does not call supabase.functions.invoke when isConsented is false', async () => {
      const invokeFn = vi.fn()
      vi.doMock('@/shared/lib/env', () => ({ env: {} }))
      vi.doMock('@/shared/lib/supabase', () => ({
        supabase: { functions: { invoke: invokeFn } },
      }))

      const { extractFromImages } = await import('@/shared/services/label-extract')
      const file = makeFile()

      await expect(extractFromImages([file], undefined, false)).rejects.toThrow()
      expect(invokeFn).not.toHaveBeenCalled()
    })

    it('calls supabase.functions.invoke when isConsented is true', async () => {
      const cleanup = mockBrowserImageApis()
      const invokeFn = vi.fn().mockResolvedValue({
        data: { name: 'Metformin', dosage: '500mg', confidence: 0.95 },
        error: null,
      })
      vi.doMock('@/shared/lib/env', () => ({ env: {} }))
      vi.doMock('@/shared/lib/supabase', () => ({
        supabase: { functions: { invoke: invokeFn } },
      }))

      try {
        const { extractFromImages } = await import('@/shared/services/label-extract')
        const file = makeFile()

        const result = await extractFromImages([file], undefined, true)

        expect(invokeFn).toHaveBeenCalledOnce()
        expect(invokeFn).toHaveBeenCalledWith('extract-label', expect.objectContaining({ body: expect.anything() }))
        expect(result.name).toBe('Metformin')
      } finally {
        cleanup()
      }
    })

    it('calls supabase.functions.invoke when isConsented is undefined (no enforcement)', async () => {
      const cleanup = mockBrowserImageApis()
      const invokeFn = vi.fn().mockResolvedValue({
        data: { name: 'Lisinopril', dosage: '10mg', confidence: 0.88 },
        error: null,
      })
      vi.doMock('@/shared/lib/env', () => ({ env: {} }))
      vi.doMock('@/shared/lib/supabase', () => ({
        supabase: { functions: { invoke: invokeFn } },
      }))

      try {
        const { extractFromImages } = await import('@/shared/services/label-extract')
        const file = makeFile()

        const result = await extractFromImages([file], undefined, undefined)

        expect(invokeFn).toHaveBeenCalledOnce()
        expect(result.name).toBe('Lisinopril')
      } finally {
        cleanup()
      }
    })

    it('throws "AI consent required" before the empty-file check when isConsented is false', async () => {
      mockDeps()
      const { extractFromImages } = await import('@/shared/services/label-extract')

      // Empty file list + isConsented: false → consent error takes priority
      await expect(extractFromImages([], undefined, false))
        .rejects.toThrow('AI consent required')
    })
  })
})
