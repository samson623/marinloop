import type { ToastType } from '@/shared/stores/app-store'

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.length > 0) return error
  return fallback
}

/** Normalize error for reporting: extract message and stack, no PII. */
function normalizeForReport(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack }
  }
  if (typeof error === 'string' && error.length > 0) return { message: error }
  return { message: String(error) }
}

/**
 * Report an error for diagnostics. In dev logs to console; in prod can forward to an external service.
 * Call from global handlers, ErrorBoundary, and mutation onError callbacks.
 */
export function reportError(error: unknown, context?: string): void {
  const { message, stack } = normalizeForReport(error)
  const prefix = context ? `[${context}]` : '[error]'
  if (import.meta.env.DEV) {
    console.error(prefix, message, stack ?? '')
  }
  // Production: optionally send to external service (e.g. Sentry). No PII.
  // if (import.meta.env.PROD && window.__REPORT_ERROR__) window.__REPORT_ERROR__({ message, stack, context })
}

/**
 * Report and show toast for a mutation error. Use in React Query mutation onError callbacks.
 */
export function handleMutationError(
  error: unknown,
  context: string,
  toastFallback: string,
  toast: (msg: string, cls?: ToastType) => void
): void {
  reportError(error, context)
  toast(getErrorMessage(error, toastFallback), 'te')
}