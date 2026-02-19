import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefillsService } from '@/shared/services/refills'
import type { RefillUpsertInput } from '@/shared/types/contracts'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useRefill(medId: string) {
  const queryClient = useQueryClient()
  const { isDemo } = useAuthStore()
  const { toast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['refills', medId],
    queryFn: () => RefillsService.getByMedication(medId),
    enabled: !isDemo && medId.length > 0,
    staleTime: 1000 * 60 * 30,
  })

  const upsertMutation = useMutation({
    mutationFn: (input: RefillUpsertInput) => RefillsService.upsert(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refills', medId] })
      void queryClient.invalidateQueries({ queryKey: ['refills'] })
      toast('Refill updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useRefill', 'Failed to update refill', toast),
  })

  return {
    refill: data,
    isLoading: isLoading && !isDemo,
    updateRefill: upsertMutation.mutate,
    isUpdating: upsertMutation.isPending,
  }
}