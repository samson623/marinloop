/**
 * Tests for useIdleTimeout — HIPAA §164.312(a)(2)(iii) automatic logoff.
 *
 * Uses Vitest fake timers so we can advance time without waiting for real wall
 * clock ms to elapse.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIdleTimeout } from '@/shared/hooks/useIdleTimeout'

// mockReset: true in vitest.config.ts clears implementations between tests.
// Declare the mock first, then restore the implementation in beforeEach.

vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}))

import { useAuthStore } from '@/shared/stores/auth-store'

const mockSignOut = vi.fn()
type AuthStoreSlice = { signOut: typeof mockSignOut }

const WARN_AT   = 13 * 60 * 1000 // 13 min
const LOGOUT_AT = 15 * 60 * 1000 // 15 min
const WARN_WINDOW_SECS = Math.round((LOGOUT_AT - WARN_AT) / 1000) // 120

describe('useIdleTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSignOut.mockReset()
    // Restore selector-based mock (mockReset: true clears the implementation).
    vi.mocked(useAuthStore).mockImplementation(
      ((selector: (s: AuthStoreSlice) => unknown) =>
        selector({ signOut: mockSignOut })) as typeof useAuthStore,
    )
    // Seed Date.now() at a known starting point so refs initialise correctly.
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('showWarning is false initially', () => {
    const { result } = renderHook(() => useIdleTimeout())
    expect(result.current.showWarning).toBe(false)
  })

  it('showWarning becomes true after warnAt ms of inactivity', () => {
    const { result } = renderHook(() => useIdleTimeout())

    act(() => {
      // Advance past warnAt and let the interval fire several times
      vi.advanceTimersByTime(WARN_AT + 2000)
    })

    expect(result.current.showWarning).toBe(true)
  })

  it('resetTimer clears the warning and resets the countdown', () => {
    const { result } = renderHook(() => useIdleTimeout())

    // Trigger the warning
    act(() => {
      vi.advanceTimersByTime(WARN_AT + 2000)
    })
    expect(result.current.showWarning).toBe(true)

    // Dismiss the warning
    act(() => {
      result.current.resetTimer()
    })
    expect(result.current.showWarning).toBe(false)
    expect(result.current.secondsRemaining).toBe(WARN_WINDOW_SECS)
  })

  it('a mousemove event resets the idle timer', () => {
    const { result } = renderHook(() => useIdleTimeout())

    // Advance almost to warnAt
    act(() => {
      vi.advanceTimersByTime(WARN_AT - 5000)
    })
    expect(result.current.showWarning).toBe(false)

    // Simulate user activity: fire a mousemove event
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove'))
      // Advance a bit more — still under warnAt from the new activity timestamp
      vi.advanceTimersByTime(5000)
    })

    // Warning should not appear because the timer was reset by the activity
    expect(result.current.showWarning).toBe(false)
  })

  it('signOut is called after logoutAt ms', () => {
    renderHook(() => useIdleTimeout())

    act(() => {
      vi.advanceTimersByTime(LOGOUT_AT + 1000)
    })

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('secondsRemaining counts down from 120 when warning is shown', () => {
    const { result } = renderHook(() => useIdleTimeout())

    // Enter warning window
    act(() => {
      vi.advanceTimersByTime(WARN_AT + 1000)
    })
    expect(result.current.showWarning).toBe(true)
    const firstReading = result.current.secondsRemaining

    // Advance a few more seconds and confirm it decreases
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.secondsRemaining).toBeLessThan(firstReading)
    expect(result.current.secondsRemaining).toBeGreaterThanOrEqual(0)
  })
})
