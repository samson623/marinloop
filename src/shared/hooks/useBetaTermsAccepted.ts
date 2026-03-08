import { useState } from 'react'

const STORAGE_KEY = 'marinloop_beta_terms_accepted'

export function useBetaTermsAccepted() {
  const [accepted, setAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Ignore storage errors and still update local UI state.
    }
    setAccepted(true)
  }

  return { accepted, accept }
}
