import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DoseLogsService } from '@/shared/services/dose-logs'
import type { DoseLogCreateInput } from '@/shared/types/contracts'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useDoseLogs(date?: string) {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: date ? ['dose_logs', 'date', date] : ['dose_logs', 'today'],
    queryFn: date ? () => DoseLogsService.getForDate(date) : DoseLogsService.getToday,
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
    isLoading,
    logDose: logMutation.mutate,
  }
}
