/**
 * Pure auth guard for App routing: when to show login vs app.
 * Used by App.tsx; kept in lib for testability without React.
 */

export type AuthView = 'loading' | 'login' | 'app'

export function getAuthView(
  isLoading: boolean,
  session: unknown,
  isDemo: boolean
): AuthView {
  if (isLoading) return 'loading'
  if (!session && !isDemo) return 'login'
  return 'app'
}
