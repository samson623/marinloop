import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppointmentsService } from '@/shared/services/appointments'
import type { Database } from '@/shared/types/database.types'
import type { AppointmentCreateInput } from '@/shared/types/contracts'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { handleMutationError } from '@/shared/lib/errors'

type Appointment = Database['public']['Tables']['appointments']['Row']

export function useAppointments() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()
  const activeProfileId = useAuthStore((s) => s.activeProfileId)

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments', activeProfileId],
    queryFn: () => AppointmentsService.getAll(activeProfileId),
    staleTime: 1000 * 60 * 15,
  })

  const createMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (input: AppointmentCreateInput) => AppointmentsService.create({ ...input, profile_id: activeProfileId ?? null } as any),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast('Appointment added', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useAppointments', 'Could not add appointment', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Appointment> }) => AppointmentsService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast('Appointment updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useAppointments', 'Could not update appointment', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: AppointmentsService.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast('Appointment deleted', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useAppointments', 'Could not delete appointment', toast),
  })

  return {
    appts: data ?? [],
    isLoading,
    error,
    addAppt: createMutation.mutate,
    updateAppt: updateMutation.mutate,
    deleteAppt: deleteMutation.mutate,
    isAdding: createMutation.isPending,
  }
}