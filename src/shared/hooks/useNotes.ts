import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NotesService } from '@/shared/services/notes'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { handleMutationError } from '@/shared/lib/errors'
import type { Database } from '@/shared/types/database.types'

type Note = Database['public']['Tables']['notes']['Row']
type NoteInsert = Database['public']['Tables']['notes']['Insert']

export function useNotes() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()
  const activeProfileId = useAuthStore((s) => s.activeProfileId)

  const { data, isLoading } = useQuery({
    queryKey: ['notes', activeProfileId],
    queryFn: () => NotesService.getAll(activeProfileId),
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (input: Pick<NoteInsert, 'content' | 'medication_id' | 'appointment_id'>) => NotesService.create({ ...input, profile_id: activeProfileId ?? null } as any),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
      toast('Note added', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useNotes', 'Could not add note', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => NotesService.update(id, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
      toast('Note updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useNotes', 'Could not update note', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => NotesService.delete(id),
    onMutate: (id: string) => {
      const cacheKey = ['notes', activeProfileId]
      const prev = queryClient.getQueryData<Note[]>(cacheKey)
      queryClient.setQueryData<Note[]>(cacheKey, (old) => old?.filter((n) => n.id !== id))
      return { prev }
    },
    onError: (_err: unknown, _id: string, context: { prev?: Note[] } | undefined) => {
      if (context?.prev) queryClient.setQueryData(['notes', activeProfileId], context.prev)
      handleMutationError(_err, 'useNotes', 'Could not delete note', toast)
    },
    onSuccess: () => toast('Note deleted', 'ts'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notes'] }),
  })

  return {
    notes: data ?? [],
    isLoading,
    addNote: createMutation.mutate,
    isAdding: createMutation.isPending,
    updateNote: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteNote: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  }
}