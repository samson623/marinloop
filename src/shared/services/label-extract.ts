
import { supabase } from '@/shared/lib/supabase'

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
  const lower = msg.toLowerCase()
  if (lower.includes('daily limit') || lower.includes('tomorrow') || msg.includes('429')) {
    return 'Daily limit reached. Try again tomorrow.'
  }
  if (lower.includes('too large') || lower.includes('smaller') || msg.includes('6mb') || msg.includes('18mb')) {
    return 'Photos too large. Try smaller images.'
  }
  if (lower.includes('consent required') || lower.includes('enable ai')) {
    return 'AI features need to be enabled. Please go to Settings and enable AI consent.'
  }
  if (lower.includes('requires basic') || lower.includes('requires pro') || lower.includes('upgrade')) {
    return 'This feature requires a paid plan. Please upgrade to Basic or Pro.'
  }
  if (lower.includes('cors') || lower.includes('not allowed')) {
    return 'Connection error. Please try again or contact support.'
  }
  if (lower.includes('unauthorized') || lower.includes('authorization')) {
    return 'Session expired. Please sign out and sign back in.'
  }
  return msg || "Couldn't read the label. Please enter manually."
}

/**
 * Extract medication info from one or more prescription label photos.
 * Images are compressed client-side before sending to the Edge Function.
 */
export async function extractFromImages(files: File[], isConsented?: boolean): Promise<LabelExtractResult> {
  if (isConsented === false) {
    throw new Error('AI consent required')
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

  const { data, error, response: errResponse } = await Promise.race([invokePromise, timeoutPromise]) as
    { data: LabelExtractResult | null; error: Error | null; response?: Response }

  if (error) {
    let msg = ''
    if (error.name === 'FunctionsHttpError') {
      // Try to extract the JSON error body from the Response object
      // error.context is the raw Response; errResponse is also available
      const resp = (error as unknown as Record<string, unknown>).context ?? errResponse
      if (resp && typeof resp === 'object' && typeof (resp as Response).json === 'function') {
        try {
          const errBody = (await (resp as Response).json()) as { error?: string } | null
          msg = errBody?.error ?? ''
        } catch {
          // Body may have been consumed or CORS-blocked; try .text() as fallback
          try {
            if (typeof (resp as Response).text === 'function') {
              const text = await (resp as Response).text()
              msg = text || ''
            }
          } catch {
            // Response body inaccessible
          }
        }
      }
      const status = resp && typeof (resp as Response).status === 'number' ? (resp as Response).status : '?'
      console.error(`[label-extract] Edge Function returned ${status}: ${msg || '(no body)'}`)
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
export async function extractFromImage(file: File, isConsented?: boolean): Promise<LabelExtractResult> {
  return extractFromImages([file], isConsented)
}
