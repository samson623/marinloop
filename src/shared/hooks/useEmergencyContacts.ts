import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EmergencyContactsService } from '@/shared/services/care-network'
import type { EmergencyContact } from '@/shared/types/care-types'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useEmergencyContacts() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['emergency_contacts'],
    queryFn: EmergencyContactsService.getAll,
    staleTime: 1000 * 60 * 10,
  })

  const createMutation = useMutation({
    mutationFn: (contact: Omit<EmergencyContact, 'id'>) => EmergencyContactsService.add(contact),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['emergency_contacts'] })
      toast('Emergency contact added', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useEmergencyContacts', 'Could not add contact', toast),
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = await EmergencyContactsService.getAll()
      const updated = current.filter((c) => c.id !== id)
      return EmergencyContactsService.upsert(updated)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['emergency_contacts'] })
      toast('Contact removed', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useEmergencyContacts', 'Could not remove contact', toast),
  })

  return {
    contacts: data ?? [],
    isLoading,
    addContact: createMutation.mutate,
    removeContact: removeMutation.mutate,
    isAdding: createMutation.isPending,
  }
}
