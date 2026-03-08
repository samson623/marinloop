import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

const AI_CONSENT_KEY = 'marinloop_ai_consent_given'
const AI_CONSENT_DECLINED_KEY = 'marinloop_ai_consent_declined'

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
    // Persist to Supabase (fire-and-forget; localStorage is the cache)
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const now = new Date().toISOString()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columns added in migration 040, ahead of generated types
        const db = supabase as any
        await db.from('profiles').update({ ai_consent_granted: true, ai_consent_granted_at: now }).eq('id', user.id)
        await db.from('ai_consent_audit').insert({ user_id: user.id, action: 'granted', created_at: now })
      } catch { /* ignore — localStorage is source of truth for UI */ }
    })()
  }

  const revoke = () => {
    try { localStorage.removeItem(AI_CONSENT_KEY) } catch { /* ignore */ }
    setConsented(false)
    // Persist revocation to Supabase (fire-and-forget)
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const now = new Date().toISOString()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columns added in migration 040, ahead of generated types
        const db = supabase as any
        await db.from('profiles').update({ ai_consent_granted: false }).eq('id', user.id)
        await db.from('ai_consent_audit').insert({ user_id: user.id, action: 'revoked', created_at: now })
      } catch { /* ignore */ }
    })()
  }

  return { consented, declined, setDeclined, consent, revoke }
}
