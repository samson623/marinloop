import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from '@supabase/supabase-js'
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
  if (msg.toLowerCase().includes('too large') || msg.toLowerCase().includes('smaller') || msg.includes('6mb')) {
    return 'Photo too large. Try a smaller image.'
  }
  return msg || "Couldn't read the label. Please enter manually."
}

/**
 * Extract medication info from a prescription label photo.
 * Calls extract-label Edge Function with base64 image.
 */
export async function extractFromImage(file: File): Promise<LabelExtractResult> {
  if (isDemoApp) {
    throw new Error('Label extraction is not available in demo mode. Please sign in.')
  }

  const imageBase64 = await fileToBase64(file)

  const { data, error } = await supabase.functions.invoke<LabelExtractResult>('extract-label', {
    body: { imageBase64 },
  })

  if (error) {
    let msg = ''
    if (error instanceof FunctionsHttpError) {
      try {
        const errBody = (await error.context.json()) as { error?: string } | null
        msg = errBody?.error ?? ''
      } catch {
        msg = ''
      }
    } else if (error instanceof FunctionsRelayError) {
      msg = 'Network error. Please check your connection and try again.'
    } else if (error instanceof FunctionsFetchError) {
      msg = 'Could not reach the server. Please try again.'
    }
    throw new Error(mapApiError(msg || error.message || ''))
  }

  const parsed = data as LabelExtractResult | null | undefined
  if (!parsed || typeof parsed !== 'object') {
    throw new Error("Couldn't read enough from the label. Please enter manually.")
  }

  return parsed
}
