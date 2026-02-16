export type AppMode = 'demo' | 'prod'

const rawMode = import.meta.env.VITE_APP_MODE

export const appMode: AppMode = rawMode === 'demo' ? 'demo' : 'prod'
export const isDemoApp = appMode === 'demo'
export const isProdApp = appMode === 'prod'

export const env = {
  appMode,
  isDemoApp,
  isProdApp,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  oauthRedirectUrl: import.meta.env.VITE_OAUTH_REDIRECT_URL as string | undefined,
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined,
  openaiModel: (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-5-nano',
} as const
