import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database.types'
import { env, isDemoApp } from '@/shared/lib/env'

const supabaseUrl = env.supabaseUrl
const supabaseAnonKey = env.supabaseAnonKey

if (!isDemoApp && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'Missing Supabase env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). ' +
    'Copy .env.example to .env and set them. See README "Works on Vercel but not locally".'
  )
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://demo.local.invalid',
  supabaseAnonKey ?? 'demo-anon-key',
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
  },
)