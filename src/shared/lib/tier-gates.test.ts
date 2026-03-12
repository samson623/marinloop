import { describe, it, expect } from 'vitest'
import {
  getTierLimits,
  canAddMedication,
  canUseBarcode,
  canUseOcr,
  getAiDailyLimit,
  canUseCaregiverMode,
  canUseSmartReminders,
  getMaxProfiles,
  getMedLimitDisplay,
  isAtMedLimit,
} from '@/shared/lib/tier-gates'
import { TIER_CONFIG } from '@/shared/types/subscription'

// ---------------------------------------------------------------------------
// getTierLimits
// ---------------------------------------------------------------------------

describe('getTierLimits', () => {
  it('returns the correct limits object for free', () => {
    expect(getTierLimits('free')).toEqual(TIER_CONFIG.free.limits)
  })

  it('returns the correct limits object for basic', () => {
    expect(getTierLimits('basic')).toEqual(TIER_CONFIG.basic.limits)
  })

  it('returns the correct limits object for pro', () => {
    expect(getTierLimits('pro')).toEqual(TIER_CONFIG.pro.limits)
  })
})

// ---------------------------------------------------------------------------
// canAddMedication
// ---------------------------------------------------------------------------

describe('canAddMedication', () => {
  // free — limit is 3
  it('free: returns true when under limit (2 of 3)', () => {
    expect(canAddMedication(2, 'free')).toBe(true)
  })

  it('free: returns false when exactly at limit (3 of 3)', () => {
    expect(canAddMedication(3, 'free')).toBe(false)
  })

  it('free: returns false when over limit (4 of 3)', () => {
    expect(canAddMedication(4, 'free')).toBe(false)
  })

  it('free: returns true when at zero', () => {
    expect(canAddMedication(0, 'free')).toBe(true)
  })

  // basic — limit is 8
  it('basic: returns true when one under limit (7 of 8)', () => {
    expect(canAddMedication(7, 'basic')).toBe(true)
  })

  it('basic: returns false when exactly at limit (8 of 8)', () => {
    expect(canAddMedication(8, 'basic')).toBe(false)
  })

  it('basic: returns false when over limit (9 of 8)', () => {
    expect(canAddMedication(9, 'basic')).toBe(false)
  })

  it('basic: returns true when at zero', () => {
    expect(canAddMedication(0, 'basic')).toBe(true)
  })

  // pro — limit is -1 (unlimited)
  it('pro: always returns true regardless of count (0)', () => {
    expect(canAddMedication(0, 'pro')).toBe(true)
  })

  it('pro: always returns true regardless of count (100)', () => {
    expect(canAddMedication(100, 'pro')).toBe(true)
  })

  it('pro: always returns true regardless of count (999)', () => {
    expect(canAddMedication(999, 'pro')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// canUseBarcode
// ---------------------------------------------------------------------------

describe('canUseBarcode', () => {
  it('returns false for free', () => {
    expect(canUseBarcode('free')).toBe(false)
  })

  it('returns true for basic', () => {
    expect(canUseBarcode('basic')).toBe(true)
  })

  it('returns true for pro', () => {
    expect(canUseBarcode('pro')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// canUseOcr
// ---------------------------------------------------------------------------

describe('canUseOcr', () => {
  it('returns false for free', () => {
    expect(canUseOcr('free')).toBe(false)
  })

  it('returns true for basic', () => {
    expect(canUseOcr('basic')).toBe(true)
  })

  it('returns true for pro', () => {
    expect(canUseOcr('pro')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getAiDailyLimit
// ---------------------------------------------------------------------------

describe('getAiDailyLimit', () => {
  it('returns 0 for free', () => {
    expect(getAiDailyLimit('free')).toBe(0)
  })

  it('returns 10 for basic', () => {
    expect(getAiDailyLimit('basic')).toBe(10)
  })

  it('returns 30 for pro', () => {
    expect(getAiDailyLimit('pro')).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// canUseCaregiverMode
// ---------------------------------------------------------------------------

describe('canUseCaregiverMode', () => {
  it('returns false for free', () => {
    expect(canUseCaregiverMode('free')).toBe(false)
  })

  it('returns false for basic', () => {
    expect(canUseCaregiverMode('basic')).toBe(false)
  })

  it('returns true for pro', () => {
    expect(canUseCaregiverMode('pro')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// canUseSmartReminders
// ---------------------------------------------------------------------------

describe('canUseSmartReminders', () => {
  it('returns false for free', () => {
    expect(canUseSmartReminders('free')).toBe(false)
  })

  it('returns true for basic', () => {
    expect(canUseSmartReminders('basic')).toBe(true)
  })

  it('returns true for pro', () => {
    expect(canUseSmartReminders('pro')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getMaxProfiles
// ---------------------------------------------------------------------------

describe('getMaxProfiles', () => {
  it('returns 1 for free', () => {
    expect(getMaxProfiles('free')).toBe(1)
  })

  it('returns 1 for basic', () => {
    expect(getMaxProfiles('basic')).toBe(1)
  })

  it('returns 3 for pro', () => {
    expect(getMaxProfiles('pro')).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// getMedLimitDisplay
// ---------------------------------------------------------------------------

describe('getMedLimitDisplay', () => {
  it('returns "3" for free', () => {
    expect(getMedLimitDisplay('free')).toBe('3')
  })

  it('returns "8" for basic', () => {
    expect(getMedLimitDisplay('basic')).toBe('8')
  })

  it('returns "Unlimited" for pro', () => {
    expect(getMedLimitDisplay('pro')).toBe('Unlimited')
  })

  it('returns a string (not a number) for free', () => {
    expect(typeof getMedLimitDisplay('free')).toBe('string')
  })

  it('returns a string (not a number) for basic', () => {
    expect(typeof getMedLimitDisplay('basic')).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// isAtMedLimit
// ---------------------------------------------------------------------------

describe('isAtMedLimit', () => {
  // free — limit is 3
  it('free: returns false when under limit (2 of 3)', () => {
    expect(isAtMedLimit(2, 'free')).toBe(false)
  })

  it('free: returns true when exactly at limit (3 of 3)', () => {
    expect(isAtMedLimit(3, 'free')).toBe(true)
  })

  it('free: returns true when over limit (4 of 3)', () => {
    expect(isAtMedLimit(4, 'free')).toBe(true)
  })

  // basic — limit is 8
  it('basic: returns false when one under limit (7 of 8)', () => {
    expect(isAtMedLimit(7, 'basic')).toBe(false)
  })

  it('basic: returns true when exactly at limit (8 of 8)', () => {
    expect(isAtMedLimit(8, 'basic')).toBe(true)
  })

  it('basic: returns true when over limit (9 of 8)', () => {
    expect(isAtMedLimit(9, 'basic')).toBe(true)
  })

  // pro — unlimited
  it('pro: always returns false regardless of count (0)', () => {
    expect(isAtMedLimit(0, 'pro')).toBe(false)
  })

  it('pro: always returns false regardless of count (999)', () => {
    expect(isAtMedLimit(999, 'pro')).toBe(false)
  })

  // isAtMedLimit is exactly the inverse of canAddMedication for all tiers
  it('is always the inverse of canAddMedication for free', () => {
    for (const count of [0, 1, 2, 3, 4, 5]) {
      expect(isAtMedLimit(count, 'free')).toBe(!canAddMedication(count, 'free'))
    }
  })

  it('is always the inverse of canAddMedication for basic', () => {
    for (const count of [0, 4, 7, 8, 9, 12]) {
      expect(isAtMedLimit(count, 'basic')).toBe(!canAddMedication(count, 'basic'))
    }
  })

  it('is always the inverse of canAddMedication for pro', () => {
    for (const count of [0, 1, 50, 100, 500]) {
      expect(isAtMedLimit(count, 'pro')).toBe(!canAddMedication(count, 'pro'))
    }
  })
})
