import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppointmentsService } from '@/shared/services/appointments'
import type { Database } from '@/shared/types/database.types'
import type { AppointmentCreateInput } from '@/shared/types/contracts'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

type Appointment = Database['public']['Tables']['appointments']['Row']

export function useAppointments() {
  const queryClient = useQueryClient()
  const { isDemo } = useAuthStore()
  const { toast } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments'],
    queryFn: AppointmentsService.getAll,
    enabled: !isDemo,
    staleTime: 1000 * 60 * 15,
  })

  const createMutation = useMutation({
    mutationFn: (input: AppointmentCreateInput) => AppointmentsService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast('Appointment added', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useAppointments', 'Failed to add appointment', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Appointment> }) => AppointmentsService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast('Appointment updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useAppointments', 'Failed to update appointment', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: AppointmentsService.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast('Appointment deleted', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useAppointments', 'Failed to delete appointment', toast),
  })

  return {
    appts: data ?? [],
    isLoading: isLoading && !isDemo,
    error,
    addAppt: createMutation.mutate,
    updateAppt: updateMutation.mutate,
    deleteAppt: deleteMutation.mutate,
    isAdding: createMutation.isPending,
  }
}