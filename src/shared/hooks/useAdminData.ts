import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import type {
  AdminOverviewStats,
  AdminUserRow,
  AdminFeedbackRow,
  AdminAIUsageRow,
  AdminUserListParams,
  AdminFeedbackParams,
  AdminAIUsageParams,
} from '@/shared/types/admin'

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Minimal interface for a Supabase client that can call arbitrary RPC
 * functions. Used to bypass the generated database.types constraint for
 * admin RPCs that exist in migration 041 but have not yet been regenerated
 * into database.types.ts. We cast through `unknown` exactly once here.
 */
interface UntypedSupabaseClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

const adminRpc = (supabase as unknown as UntypedSupabaseClient).rpc.bind(
  supabase as unknown as UntypedSupabaseClient,
)

// ---------------------------------------------------------------------------
// useAdminOverviewStats
// ---------------------------------------------------------------------------

/** Fetches aggregate platform stats for the admin Overview tab. */
export function useAdminOverviewStats(): {
  stats: AdminOverviewStats | null
  isLoading: boolean
  isError: boolean
  error: Error | null
} {
  const { data, isLoading, isError, error } = useQuery<AdminOverviewStats | null>({
    queryKey: ['admin', 'overview-stats'],
    queryFn: async (): Promise<AdminOverviewStats | null> => {
      const { data: rpcData, error: rpcError } = await adminRpc('get_admin_overview_stats')
      if (rpcError) throw new Error(rpcError.message)
      // RPC returns null when the caller is not an admin — treat gracefully.
      if (rpcData === null) return null
      return rpcData as AdminOverviewStats
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  return {
    stats: data ?? null,
    isLoading,
    isError,
    error: error as Error | null,
  }
}

// ---------------------------------------------------------------------------
// useAdminUserList
// ---------------------------------------------------------------------------

/** Fetches a paginated list of users for the admin Users tab. */
export function useAdminUserList(params: AdminUserListParams = {}): {
  users: AdminUserRow[]
  isLoading: boolean
  isError: boolean
  error: Error | null
} {
  const { data, isLoading, isError, error } = useQuery<AdminUserRow[]>({
    queryKey: ['admin', 'user-list', params],
    queryFn: async (): Promise<AdminUserRow[]> => {
      const { data: rpcData, error: rpcError } = await adminRpc('get_admin_user_list', {
        p_limit: params.limit ?? 50,
        p_offset: params.offset ?? 0,
      })
      if (rpcError) throw new Error(rpcError.message)
      // Non-admin callers receive null; return empty array gracefully.
      if (rpcData === null) return []
      return rpcData as AdminUserRow[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  return {
    users: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
  }
}

// ---------------------------------------------------------------------------
// useAdminFeedback
// ---------------------------------------------------------------------------

/** Fetches filtered beta feedback rows for the admin Feedback tab. */
export function useAdminFeedback(params: AdminFeedbackParams = {}): {
  feedback: AdminFeedbackRow[]
  isLoading: boolean
  isError: boolean
  error: Error | null
} {
  const { data, isLoading, isError, error } = useQuery<AdminFeedbackRow[]>({
    queryKey: ['admin', 'feedback', params],
    queryFn: async (): Promise<AdminFeedbackRow[]> => {
      const { data: rpcData, error: rpcError } = await adminRpc('search_admin_feedback', {
        p_type: params.type ?? null,
        p_since: params.since ?? null,
        p_limit: params.limit ?? 50,
        p_offset: params.offset ?? 0,
      })
      if (rpcError) throw new Error(rpcError.message)
      if (rpcData === null) return []
      return rpcData as AdminFeedbackRow[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  return {
    feedback: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
  }
}

// ---------------------------------------------------------------------------
// useAdminAIUsage
// ---------------------------------------------------------------------------

/** Fetches per-user AI usage for a given date for the admin AI Usage tab. */
export function useAdminAIUsage(params: AdminAIUsageParams = {}): {
  usage: AdminAIUsageRow[]
  isLoading: boolean
  isError: boolean
  error: Error | null
} {
  const { data, isLoading, isError, error } = useQuery<AdminAIUsageRow[]>({
    queryKey: ['admin', 'ai-usage', params],
    queryFn: async (): Promise<AdminAIUsageRow[]> => {
      const { data: rpcData, error: rpcError } = await adminRpc('get_admin_ai_usage', {
        p_date: params.date ?? null,
      })
      if (rpcError) throw new Error(rpcError.message)
      if (rpcData === null) return []
      return rpcData as AdminAIUsageRow[]
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  return {
    usage: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
  }
}
