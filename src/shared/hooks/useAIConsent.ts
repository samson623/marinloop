import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

const AI_CONSENT_KEY = 'marinloop_ai_consent_given'
const AI_CONSENT_DECLINED_KEY = 'marinloop_ai_consent_declined'

/**
 * Persist consent to Supabase via SECURITY DEFINER RPC (migration 047).
 * Retries once on failure. Returns true if the DB was updated successfully.
 */
async function persistConsent(action: 'grant' | 'revoke'): Promise<boolean> {
  const rpcName = action === 'grant' ? 'grant_ai_consent' : 'revoke_ai_consent'
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.rpc(rpcName)
    if (!error) return true
    if (attempt === 0) await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

export function useAIConsent() {
  const [consented, setConsented] = useState<boolean>(() => {
    try { return localStorage.getItem(AI_CONSENT_KEY) === '1' } catch { return false }
  })
  const [declined, setDeclinedState] = useState<boolean>(() => {
    try { return localStorage.getItem(AI_CONSENT_DECLINED_KEY) === '1' } catch { return false }
  })

  const setDeclined = (val: boolean) => {
    try { localStorage.setItem(AI_CONSENT_DECLINED_KEY, val ? '1' : '0') } catch { /* ignore */ }
    setDeclinedState(val)
  }

  const consent = () => {
    try { localStorage.setItem(AI_CONSENT_KEY, '1') } catch { /* ignore */ }
    try { localStorage.removeItem(AI_CONSENT_DECLINED_KEY) } catch { /* ignore */ }
    setConsented(true)
    setDeclinedState(false)
    // Persist to Supabase via RPC — awaited with retry, not fire-and-forget
    void (async () => {
      const ok = await persistConsent('grant')
      if (!ok) {
        console.error('[useAIConsent] Failed to persist consent grant to database after 2 attempts')
      }
    })()
  }

  const revoke = () => {
    try { localStorage.removeItem(AI_CONSENT_KEY) } catch { /* ignore */ }
    setConsented(false)
    void (async () => {
      const ok = await persistConsent('revoke')
      if (!ok) {
        console.error('[useAIConsent] Failed to persist consent revocation to database after 2 attempts')
      }
    })()
  }

  return { consented, declined, setDeclined, consent, revoke }
}
