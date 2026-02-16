import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database.types'
import { env, isDemoApp } from '@/shared/lib/env'

const supabaseUrl = env.supabaseUrl
const supabaseAnonKey = env.supabaseAnonKey

// if (!isDemoApp && (!supabaseUrl || !supabaseAnonKey)) {
//   throw new Error('Missing required Supabase environment variables in production mode.')
// }

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://demo.local.invalid',
  supabaseAnonKey ?? 'demo-anon-key',
)