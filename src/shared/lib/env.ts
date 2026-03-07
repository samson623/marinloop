export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  oauthRedirectUrl: import.meta.env.VITE_OAUTH_REDIRECT_URL as string | undefined,
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined,
  openaiModel: (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-5-nano',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  adminUserId: import.meta.env.VITE_ADMIN_USER_ID as string | undefined,
} as const
