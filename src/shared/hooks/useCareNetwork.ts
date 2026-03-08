import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CareConnectionsService } from '@/shared/services/care-network'
import type { CareConnection, CareConnectionCreateInput } from '@/shared/types/care-types'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useCareNetwork() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['care_connections'],
    queryFn: CareConnectionsService.getAll,
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    mutationFn: (input: CareConnectionCreateInput) => CareConnectionsService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care_connections'] })
      toast('Caregiver invited', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useCareNetwork', 'Could not invite caregiver', toast),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => CareConnectionsService.revoke(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care_connections'] })
      toast('Access revoked', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useCareNetwork', 'Could not revoke access', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => CareConnectionsService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care_connections'] })
      toast('Caregiver removed', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useCareNetwork', 'Could not remove caregiver', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CareConnection> }) =>
      CareConnectionsService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care_connections'] })
      toast('Updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useCareNetwork', 'Could not update connection', toast),
  })

  return {
    connections: data ?? [],
    isLoading,
    error,
    addConnection: createMutation.mutate,
    revokeConnection: revokeMutation.mutate,
    deleteConnection: deleteMutation.mutate,
    updateConnection: updateMutation.mutate,
    isAdding: createMutation.isPending,
  }
}
