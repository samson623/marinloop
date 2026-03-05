import { useQuery } from '@tanstack/react-query'
import { DoseLogsService } from '@/shared/services/dose-logs'

export function useAdherenceHistory(daysBack: number = 7) {
  const { data, isLoading } = useQuery({
    queryKey: ['adherence', daysBack],
    queryFn: () => DoseLogsService.getAdherenceByDay(daysBack),
  })

  return { adherence: data ?? {}, isLoading }
}
