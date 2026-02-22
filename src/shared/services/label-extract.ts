
import { supabase } from '@/shared/lib/supabase'
import { isDemoApp } from '@/shared/lib/env'

const EXTRACT_TIMEOUT_MS = 60_000 // 60s max for label extraction
const MAX_IMAGE_DIMENSION = 1024  // px — more than enough for OCR
const JPEG_QUALITY = 0.80

export interface LabelExtractResult {
  name?: string
  dosage?: string
  freq?: number
  time?: string
  quantity?: number
  instructions?: string
  warnings?: string
  confidence?: number
}

/**
 * Load a File into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')) }
    img.src = url
  })
}

/**
 * Compress and resize an image to JPEG at max 1024px, returning a data URL.
 * Phone photos (3-8MB) become ~50-200KB — dramatically faster to upload and process.
 */
async function compressImage(file: File): Promise<string> {
  const img = await loadImage(file)

  let { width, height } = img
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

function mapApiError(msg: string): string {
  if (msg.toLowerCase().includes('daily limit') || msg.includes('tomorrow') || msg.includes('429')) {
    return 'Daily limit reached. Try again tomorrow.'
  }
  if (msg.toLowerCase().includes('too large') || msg.toLowerCase().includes('smaller') || msg.includes('6mb') || msg.includes('18mb')) {
    return 'Photos too large. Try smaller images.'
  }
  return msg || "Couldn't read the label. Please enter manually."
}

/**
 * Extract medication info from one or more prescription label photos.
 * Images are compressed client-side before sending to the Edge Function.
 */
export async function extractFromImages(files: File[]): Promise<LabelExtractResult> {
  if (isDemoApp) {
    throw new Error('Label extraction is not available in demo mode. Please sign in.')
  }
  if (files.length === 0) {
    throw new Error('At least one image is required.')
  }

  // Compress images before sending (phone photos 5MB → ~100KB each)
  const images = await Promise.all(files.map(compressImage))

  // Race between the actual call and a timeout
  const invokePromise = supabase.functions.invoke<LabelExtractResult>('extract-label', {
    body: { images },
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out. Please try again or enter details manually.')), EXTRACT_TIMEOUT_MS)
  })

  const { data, error } = await Promise.race([invokePromise, timeoutPromise])

  if (error) {
    let msg = ''
    if (error.name === 'FunctionsHttpError') {
      try {
        const errObj = error as Record<string, unknown>
        if (typeof errObj.context === 'object' && errObj.context !== null) {
          const ctx = errObj.context as Record<string, unknown>
          if (typeof ctx.json === 'function') {
            const errBody = (await ctx.json()) as { error?: string } | null
            msg = errBody?.error ?? ''
          }
        }
      } catch {
        msg = ''
      }
    } else if (error.name === 'FunctionsRelayError') {
      msg = 'Network error. Please check your connection and try again.'
    } else if (error.name === 'FunctionsFetchError') {
      msg = 'Could not reach the server. Check your connection and try again. If the problem continues, the app administrator may need to add this site to allowed origins.'
    }
    throw new Error(mapApiError(msg || error.message || ''))
  }

  const parsed = data as LabelExtractResult | null | undefined
  if (!parsed || typeof parsed !== 'object') {
    throw new Error("Couldn't read enough from the label. Please enter manually.")
  }

  return parsed
}

/** Single-file convenience wrapper (backwards compatible). */
export async function extractFromImage(file: File): Promise<LabelExtractResult> {
  return extractFromImages([file])
}
