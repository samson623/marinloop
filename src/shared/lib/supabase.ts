import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database.types'
import { env } from '@/shared/lib/env'

const supabaseUrl = env.supabaseUrl
const supabaseAnonKey = env.supabaseAnonKey

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). ' +
    'Copy .env.example to .env and set them. See README "Works on Vercel but not locally".'
  )
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Implicit flow returns tokens directly in the URL hash — no PKCE
      // code_verifier in localStorage needed. PKCE was failing on mobile
      // because the verifier was lost between the OAuth redirect out and
      // the callback back (iOS Safari ITP, PWA context switches, etc.).
      flowType: 'implicit',
      detectSessionInUrl: true,
    },
  },
)