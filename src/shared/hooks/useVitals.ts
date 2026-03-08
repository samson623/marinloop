import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { VitalsService } from '@/shared/services/vitals'
import type { VitalCreateInput, VitalUpdateInput } from '@/shared/services/vitals'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useVitals() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['vitals'],
    queryFn: VitalsService.getAll,
    staleTime: 1000 * 60 * 5,
  })

  const addMutation = useMutation({
    mutationFn: (input: VitalCreateInput) => VitalsService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vitals'] })
      toast('Vitals logged', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useVitals', 'Could not save vitals', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: VitalUpdateInput }) =>
      VitalsService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vitals'] })
      toast('Vitals updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useVitals', 'Could not save vitals', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => VitalsService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vitals'] })
      toast('Entry deleted', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useVitals', 'Could not save vitals', toast),
  })

  return {
    vitals: data ?? [],
    isLoading,
    error,
    addVital: addMutation.mutate,
    updateVital: updateMutation.mutate,
    deleteVital: deleteMutation.mutate,
    isAdding: addMutation.isPending,
  }
}
