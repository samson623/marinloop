import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SymptomsService } from '@/shared/services/symptoms'
import type { Symptom, SymptomCreateInput, SymptomUpdateInput } from '@/shared/services/symptoms'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useSymptoms() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['symptoms'],
    queryFn: SymptomsService.getAll,
    staleTime: 1000 * 60 * 5,
  })

  const addMutation = useMutation({
    mutationFn: (input: SymptomCreateInput) => SymptomsService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['symptoms'] })
      toast('Symptom logged', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useSymptoms', 'Could not save symptom', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: SymptomUpdateInput }) =>
      SymptomsService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['symptoms'] })
      toast('Symptom updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useSymptoms', 'Could not save symptom', toast),
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => SymptomsService.resolve(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['symptoms'] })
      toast('Marked as resolved', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useSymptoms', 'Could not save symptom', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SymptomsService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['symptoms'] })
      toast('Symptom deleted', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useSymptoms', 'Could not save symptom', toast),
  })

  return {
    symptoms: data ?? [] as Symptom[],
    isLoading,
    error,
    addSymptom: addMutation.mutate,
    updateSymptom: updateMutation.mutate,
    resolveSymptom: resolveMutation.mutate,
    deleteSymptom: deleteMutation.mutate,
    isAdding: addMutation.isPending,
  }
}
