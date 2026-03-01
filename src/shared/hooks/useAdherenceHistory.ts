import { useQuery } from '@tanstack/react-query'
import { DoseLogsService } from '@/shared/services/dose-logs'
import { useAuthStore } from '@/shared/stores/auth-store'

export function useAdherenceHistory(daysBack: number = 7) {
  const { isDemo } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['adherence', daysBack],
    queryFn: () => DoseLogsService.getAdherenceByDay(daysBack),
    enabled: !isDemo,
  })

  if (isDemo || isLoading) {
    return { adherence: {} as Record<string, { t: number; d: number }>, isLoading }
  }

  return { adherence: data ?? {}, isLoading: false }
}
