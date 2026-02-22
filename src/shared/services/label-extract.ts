
import { supabase } from '@/shared/lib/supabase'
import { isDemoApp } from '@/shared/lib/env'

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('Failed to read file as base64'))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
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
 * Sends all images to the extract-label Edge Function for merged extraction.
 */
export async function extractFromImages(files: File[]): Promise<LabelExtractResult> {
  if (isDemoApp) {
    throw new Error('Label extraction is not available in demo mode. Please sign in.')
  }
  if (files.length === 0) {
    throw new Error('At least one image is required.')
  }

  const images = await Promise.all(files.map(fileToBase64))

  const { data, error } = await supabase.functions.invoke<LabelExtractResult>('extract-label', {
    body: { images },
  })

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
