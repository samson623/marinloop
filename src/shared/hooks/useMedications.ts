import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MedsService } from '@/shared/services/medications'
import type { Database } from '@/shared/types/database.types'
import type { MedicationBundleCreateInput } from '@/shared/types/contracts'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

type Medication = Database['public']['Tables']['medications']['Row']

export function useMedications() {
  const queryClient = useQueryClient()
  const { isDemo } = useAuthStore()
  const { toast } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['medications'],
    queryFn: MedsService.getAll,
    enabled: !isDemo,
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    mutationFn: MedsService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      toast('Medication added', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Failed to add medication', toast),
  })

  const createBundleMutation = useMutation({
    mutationFn: (input: MedicationBundleCreateInput) => MedsService.createBundle(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
      void queryClient.invalidateQueries({ queryKey: ['refills'] })
      toast('Medication and schedule created', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Failed to create medication bundle', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Medication> }) => MedsService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      toast('Medication updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Failed to update medication', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: MedsService.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      toast('Medication deleted', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Failed to delete medication', toast),
  })

  return {
    meds: data ?? [],
    isLoading: isLoading && !isDemo,
    error,
    addMed: createMutation.mutate,
    addMedBundle: createBundleMutation.mutate,
    updateMed: updateMutation.mutate,
    deleteMed: deleteMutation.mutate,
    isAdding: createMutation.isPending || createBundleMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}