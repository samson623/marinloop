import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MedsService } from '@/shared/services/medications'
import type { Database } from '@/shared/types/database.types'
import type { MedicationBundleCreateInput, MedicationCreateInput } from '@/shared/types/contracts'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { handleMutationError } from '@/shared/lib/errors'
import { AuditService } from '@/shared/services/audit'

type Medication = Database['public']['Tables']['medications']['Row']

export function useMedications() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()
  const activeProfileId = useAuthStore((s) => s.activeProfileId)

  const { data, isLoading, error } = useQuery({
    queryKey: ['medications', activeProfileId],
    queryFn: () => MedsService.getAll(activeProfileId),
    staleTime: 1000 * 60 * 5,
  })

  const createMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (input: MedicationCreateInput) => MedsService.create({ ...input, profile_id: activeProfileId ?? null } as any),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      toast('Medication added', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Could not add medication', toast),
  })

  const createBundleMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (input: MedicationBundleCreateInput) => MedsService.createBundle(input, activeProfileId ?? null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
      void queryClient.invalidateQueries({ queryKey: ['refills'] })
      toast('Medication and schedule created', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Could not create medication bundle', toast),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Medication> }) => MedsService.update(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      toast('Medication updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Could not update medication', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: MedsService.delete,
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      AuditService.logAsync({ action: 'medication.deleted', entity_type: 'medication', entity_id: id })
      toast('Medication deleted', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Could not delete medication', toast),
  })

  const discontinueMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => MedsService.discontinue(id, reason),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      void queryClient.invalidateQueries({ queryKey: ['medications', 'archived'] })
      AuditService.logAsync({ action: 'medication.discontinued', entity_type: 'medication', entity_id: id })
      toast('Medication discontinued', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Could not discontinue medication', toast),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => MedsService.restore(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
      void queryClient.invalidateQueries({ queryKey: ['medications', 'archived'] })
      toast('Medication restored to active', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useMedications', 'Could not restore medication', toast),
  })

  return {
    meds: data ?? [],
    isLoading,
    error,
    addMed: createMutation.mutate,
    addMedBundle: createBundleMutation.mutate,
    addMedBundleAsync: createBundleMutation.mutateAsync,
    updateMed: updateMutation.mutate,
    deleteMed: deleteMutation.mutate,
    discontinueMed: discontinueMutation.mutate,
    discontinueMedAsync: discontinueMutation.mutateAsync,
    restoreMed: restoreMutation.mutate,
    isAdding: createMutation.isPending || createBundleMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDiscontinuing: discontinueMutation.isPending,
  }
}