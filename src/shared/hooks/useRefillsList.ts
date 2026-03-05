import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefillsService } from '@/shared/services/refills'
import type { RefillUpsertInput } from '@/shared/types/contracts'
import type { Database } from '@/shared/types/database.types'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

type Refill = Database['public']['Tables']['refills']['Row']

export function useRefills() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['refills'],
    queryFn: RefillsService.getAll,
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

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Refill> }) => RefillsService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refills'] })
      toast('Supply updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useRefillsList', 'Failed to update supply', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: RefillsService.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refills'] })
      toast('Refill deleted', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useRefillsList', 'Failed to delete refill', toast),
  })

  return {
    refills: data ?? [],
    isLoading,
    upsertRefill: upsertMutation.mutate,
    updateRefill: updateMutation.mutate,
    deleteRefill: deleteMutation.mutate,
    isUpdating: upsertMutation.isPending || updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}