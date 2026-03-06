import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { JournalService } from '@/shared/services/journal'
import type { JournalEntry, JournalEntryCreateInput, JournalEntryUpdateInput } from '@/shared/services/journal'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useJournal() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['journal_entries'],
    queryFn: JournalService.getAll,
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    mutationFn: (input: JournalEntryCreateInput) => JournalService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal_entries'] })
      toast('Journal entry saved', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useJournal', 'Failed to save entry', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: JournalEntryUpdateInput }) =>
      JournalService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal_entries'] })
      toast('Entry updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useJournal', 'Failed to save entry', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => JournalService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal_entries'] })
      toast('Entry deleted', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useJournal', 'Failed to save entry', toast),
  })

  return {
    entries: (data ?? []) as JournalEntry[],
    isLoading,
    error,
    addEntry: createMutation.mutate,
    isAdding: createMutation.isPending,
    updateEntry: updateMutation.mutate,
    deleteEntry: deleteMutation.mutate,
  }
}
