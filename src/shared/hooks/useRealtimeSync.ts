/**
 * useRealtimeSync — Supabase Realtime subscriptions for core data tables.
 *
 * Subscribes to INSERT/UPDATE/DELETE events on medications, dose_logs,
 * vitals, notes, and appointments for the current user, then invalidates
 * the corresponding react-query caches.
 *
 * NOTE: Realtime must be enabled for each table in the Supabase dashboard
 * (Table Editor → Realtime). This is a one-time manual step per table.
 *
 * Best practice: mount this hook once in AppShell so there is a single
 * channel for the authenticated lifetime of the session.
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/auth-store'

const TABLES = [
  { table: 'medications',   queryKey: ['medications'] },
  { table: 'dose_logs',     queryKey: ['dose_logs'] },
  { table: 'vitals',        queryKey: ['vitals'] },
  { table: 'notes',         queryKey: ['notes'] },
  { table: 'appointments',  queryKey: ['appointments'] },
  { table: 'reminders',     queryKey: ['reminders'] },
] as const

export function useRealtimeSync() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(`user-data-${userId}`)

    for (const { table, queryKey } of TABLES) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey })
        },
      )
    }

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, queryClient])
}
