import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'

type Notification = Database['public']['Tables']['notifications']['Row']

export const NotificationsService = {
  async getAll(): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  async markRead(id: string): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async create(input: {
    title: string
    message: string
    type?: Database['public']['Enums']['notification_type']
  }): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        title: input.title,
        message: input.message,
        type: input.type ?? 'info',
      })
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async sendPush(userId: string, payload: {
    title: string
    body: string
    url?: string
    tag?: string
  }): Promise<void> {
    const { error } = await supabase.functions.invoke('send-push', {
      body: {
        user_id: userId,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag,
      },
    })

    if (error) throw error
  },
}
