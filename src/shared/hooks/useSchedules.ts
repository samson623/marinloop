import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SchedulesService } from '@/shared/services/schedules'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { handleMutationError } from '@/shared/lib/errors'
import type { ScheduleCreateInput } from '@/shared/types/contracts'

export function useSchedules() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()
  const activeProfileId = useAuthStore((s) => s.activeProfileId)

  const { data, isLoading } = useQuery({
    queryKey: ['schedules', activeProfileId],
    queryFn: () => SchedulesService.getAll(activeProfileId),
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (input: ScheduleCreateInput) => SchedulesService.create({ ...input, profile_id: activeProfileId ?? null } as any),
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