import { useLocation } from 'react-router-dom'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/auth-store'

type FeedbackType = 'bug' | 'feature' | 'general'

export function useFeedback() {
  const { user } = useAuthStore()
  const { pathname } = useLocation()

  const submitFeedback = async (type: FeedbackType, message: string) => {
    if (!user?.id) return { error: new Error('Not authenticated') }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('beta_feedback').insert({
      user_id: user.id,
      type,
      message: message.trim(),
      current_route: pathname,
      user_agent: navigator.userAgent.slice(0, 300),
      app_version: '1.0.0-beta',
    }) as { error: { message: string } | null }

    return { error: error ? new Error(error.message) : null }
  }

  return { submitFeedback }
}
