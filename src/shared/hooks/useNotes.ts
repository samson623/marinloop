import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NotesService } from '@/shared/services/notes'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useNotes() {
  const queryClient = useQueryClient()
  const { isDemo } = useAuthStore()
  const { toast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: NotesService.getAll,
    enabled: !isDemo,
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    mutationFn: NotesService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
      toast('Note added', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useNotes', 'Failed to add note', toast),
  })

  return {
    notes: data ?? [],
    isLoading: isLoading && !isDemo,
    addNote: createMutation.mutate,
    isAdding: createMutation.isPending,
  }
}