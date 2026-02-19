/**
 * Device and display-mode detection for Add-to-Home-Screen and push flows.
 */

function getUA(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : ''
}

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  const narrow = window.matchMedia('(max-width: 768px)').matches
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(getUA())
  return narrow || mobileUA
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(getUA())
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

export function needsAddToHomeScreenForPush(): boolean {
  return isIOS() && !isStandalone()
}

/** Best-effort platform label for push/install UX */
export function getPlatformLabel(): 'iOS' | 'Android' | 'Desktop' {
  if (typeof navigator === 'undefined') return 'Desktop'
  const ua = getUA()
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  return 'Desktop'
}
