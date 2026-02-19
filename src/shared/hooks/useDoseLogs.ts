import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DoseLogsService } from '@/shared/services/dose-logs'
import type { DoseLogCreateInput } from '@/shared/types/contracts'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useDoseLogs() {
  const queryClient = useQueryClient()
  const { isDemo } = useAuthStore()
  const { toast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['dose_logs', 'today'],
    queryFn: DoseLogsService.getToday,
    enabled: !isDemo,
    staleTime: 1000 * 60,
  })

  const logMutation = useMutation({
    mutationFn: (input: DoseLogCreateInput) => DoseLogsService.logDose(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dose_logs'] })
      void queryClient.invalidateQueries({ queryKey: ['adherence'] })
      toast('Dose logged', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useDoseLogs', 'Failed to log dose', toast),
  })

  return {
    todayLogs: data ?? [],
    isLoading: isLoading && !isDemo,
    logDose: logMutation.mutate,
  }
}