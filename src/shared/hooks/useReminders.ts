import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RemindersService, type ReminderCreateInput } from '@/shared/services/reminders'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useReminders() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['reminders'],
    queryFn: RemindersService.getAll,
    staleTime: 1000 * 30, // 30s — reminders are time-sensitive
  })

  const createMutation = useMutation({
    mutationFn: (input: ReminderCreateInput) => RemindersService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
    onError: (err: unknown) => handleMutationError(err, 'useReminders', 'Failed to create reminder', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<import('@/shared/services/reminders').Reminder, 'title' | 'body' | 'fire_at'>> }) =>
      RemindersService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast('Reminder updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useReminders', 'Failed to update reminder', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: RemindersService.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast('Reminder deleted', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useReminders', 'Failed to delete reminder', toast),
  })

  const snoozeMutation = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes?: number }) =>
      RemindersService.snooze(id, minutes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast('Snoozed 10 min', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useReminders', 'Failed to snooze reminder', toast),
  })

  return {
    reminders: data ?? [],
    isLoading,
    error,
    addReminder: createMutation.mutate,
    updateReminder: updateMutation.mutate,
    deleteReminder: deleteMutation.mutate,
    snoozeReminder: snoozeMutation.mutate,
    isAdding: createMutation.isPending,
  }
}
