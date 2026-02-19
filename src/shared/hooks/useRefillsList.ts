import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefillsService } from '@/shared/services/refills'
import type { RefillUpsertInput } from '@/shared/types/contracts'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useRefills() {
  const queryClient = useQueryClient()
  const { isDemo } = useAuthStore()
  const { toast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['refills'],
    queryFn: RefillsService.getAll,
    enabled: !isDemo,
    staleTime: 1000 * 60 * 5,
  })

  const upsertMutation = useMutation({
    mutationFn: (input: RefillUpsertInput) => RefillsService.upsert(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refills'] })
      toast('Refill updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useRefillsList', 'Failed to update refill', toast),
  })

  return {
    refills: data ?? [],
    isLoading: isLoading && !isDemo,
    upsertRefill: upsertMutation.mutate,
    isUpdating: upsertMutation.isPending,
  }
}