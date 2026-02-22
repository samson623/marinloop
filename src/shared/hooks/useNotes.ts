import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NotesService } from '@/shared/services/notes'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'
import type { Database } from '@/shared/types/database.types'

type Note = Database['public']['Tables']['notes']['Row']

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

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => NotesService.update(id, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
      toast('Note updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useNotes', 'Failed to update note', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => NotesService.delete(id),
    onMutate: (id: string) => {
      const prev = queryClient.getQueryData<Note[]>(['notes'])
      queryClient.setQueryData<Note[]>(['notes'], (old) => old?.filter((n) => n.id !== id))
      return { prev }
    },
    onError: (_err: unknown, _id: string, context: { prev?: Note[] } | undefined) => {
      if (context?.prev) queryClient.setQueryData(['notes'], context.prev)
      handleMutationError(_err, 'useNotes', 'Failed to delete note', toast)
    },
    onSuccess: () => toast('Note deleted', 'ts'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notes'] }),
  })

  return {
    notes: data ?? [],
    isLoading: isLoading && !isDemo,
    addNote: createMutation.mutate,
    isAdding: createMutation.isPending,
    updateNote: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteNote: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  }
}