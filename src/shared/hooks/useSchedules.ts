import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SchedulesService } from '@/shared/services/schedules'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useSchedules() {
  const queryClient = useQueryClient()
  const { isDemo } = useAuthStore()
  const { toast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: SchedulesService.getAll,
    enabled: !isDemo,
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    mutationFn: SchedulesService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast('Schedule updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useSchedules', 'Failed to update schedule', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) => SchedulesService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (err: unknown) => handleMutationError(err, 'useSchedules', 'Failed to update schedule', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: SchedulesService.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (err: unknown) => handleMutationError(err, 'useSchedules', 'Failed to delete schedule', toast),
  })

  return {
    scheds: data ?? [],
    isLoading: isLoading && !isDemo,
    addSched: createMutation.mutate,
    addSchedAsync: createMutation.mutateAsync,
    updateSched: updateMutation.mutate,
    deleteSched: deleteMutation.mutate,
    isAdding: createMutation.isPending,
  }
}