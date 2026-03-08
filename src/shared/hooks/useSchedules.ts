import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SchedulesService } from '@/shared/services/schedules'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useSchedules() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: SchedulesService.getAll,
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    mutationFn: SchedulesService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast('Schedule updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useSchedules', 'Could not update schedule', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) => SchedulesService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (err: unknown) => handleMutationError(err, 'useSchedules', 'Could not update schedule', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: SchedulesService.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (err: unknown) => handleMutationError(err, 'useSchedules', 'Could not delete schedule', toast),
  })

  return {
    scheds: data ?? [],
    isLoading,
    addSched: createMutation.mutate,
    addSchedAsync: createMutation.mutateAsync,
    updateSched: updateMutation.mutate,
    deleteSched: deleteMutation.mutate,
    isAdding: createMutation.isPending,
  }
}