import { useQuery } from '@tanstack/react-query'
import { DoseLogsService } from '@/shared/services/dose-logs'
import { useAuthStore } from '@/shared/stores/auth-store'

export function useAdherenceHistory(daysBack: number = 7) {
  const activeProfileId = useAuthStore((s) => s.activeProfileId)

  const { data, isLoading } = useQuery({
    queryKey: ['adherence', daysBack, activeProfileId],
    queryFn: () => DoseLogsService.getAdherenceByDay(daysBack, activeProfileId),
  })

  return { adherence: data ?? {}, isLoading }
}
