import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getErrorMessage, reportError, handleMutationError } from '@/shared/lib/errors'

describe('getErrorMessage', () => {
  it('returns Error message', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns string when given a non-empty string', () => {
    expect(getErrorMessage('failed')).toBe('failed')
  })

  it('returns fallback for empty string', () => {
    expect(getErrorMessage('', 'default')).toBe('default')
  })

  it('returns fallback for unknown types', () => {
    expect(getErrorMessage(null, 'oops')).toBe('oops')
    expect(getErrorMessage(42, 'oops')).toBe('oops')
  })

  it('uses default fallback when not provided', () => {
    expect(getErrorMessage(null)).toBe('Something went wrong')
  })
})

describe('reportError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('logs in dev', () => {
    reportError(new Error('test'), 'ctx')
    expect(console.error).toHaveBeenCalledWith('[ctx]', 'test', expect.any(String))
  })
})

describe('handleMutationError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('calls toast with message from error and reports', () => {
    const toast = vi.fn()
    handleMutationError(new Error('network failed'), 'useTest', 'Failed to save', toast)
    expect(toast).toHaveBeenCalledWith('network failed', 'te')
    expect(console.error).toHaveBeenCalled()
  })

  it('uses fallback when error is not Error', () => {
    const toast = vi.fn()
    handleMutationError(null, 'useTest', 'Failed to save', toast)
    expect(toast).toHaveBeenCalledWith('Failed to save', 'te')
  })
})
