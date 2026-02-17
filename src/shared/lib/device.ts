/**
 * Device and display-mode detection for Add-to-Home-Screen and push flows.
 */

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  const narrow = window.matchMedia('(max-width: 768px)').matches
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  return narrow || mobileUA
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(ua)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

export function needsAddToHomeScreenForPush(): boolean {
  return isIOS() && !isStandalone()
}
