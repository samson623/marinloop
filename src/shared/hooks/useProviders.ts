import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProvidersService } from '@/shared/services/care-network'
import type { Provider, ProviderCreateInput } from '@/shared/types/care-types'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useProviders() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['providers'],
    queryFn: ProvidersService.getAll,
    staleTime: 1000 * 60 * 15,
  })

  const createMutation = useMutation({
    mutationFn: (input: ProviderCreateInput) => ProvidersService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast('Provider added', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useProviders', 'Could not add provider', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Provider> }) =>
      ProvidersService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast('Provider updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useProviders', 'Could not update provider', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ProvidersService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast('Provider removed', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useProviders', 'Could not remove provider', toast),
  })

  return {
    providers: data ?? [],
    isLoading,
    error,
    addProvider: createMutation.mutate,
    updateProvider: updateMutation.mutate,
    deleteProvider: deleteMutation.mutate,
    isAdding: createMutation.isPending,
  }
}
