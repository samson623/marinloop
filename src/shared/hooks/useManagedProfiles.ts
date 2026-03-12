import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/auth-store'
import type { ManagedProfile } from '@/shared/types/managed-profile'
import { useAppStore } from '@/shared/stores/app-store'
import { handleMutationError } from '@/shared/lib/errors'

export function useManagedProfiles() {
  const queryClient = useQueryClient()
  const { toast } = useAppStore()
  const refreshManagedProfiles = useAuthStore((s) => s.refreshManagedProfiles)

  const { data, isLoading } = useQuery({
    queryKey: ['managed_profiles'],
    queryFn: async (): Promise<ManagedProfile[]> => {
      const { data, error } = await supabase
        .from('managed_profiles')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data as ManagedProfile[]
    },
    staleTime: 1000 * 60 * 5,
  })

  const addMutation = useMutation({
    mutationFn: async (input: { name: string; relationship?: string; avatar_url?: string }): Promise<ManagedProfile> => {
      const { data, error } = await supabase
        .from('managed_profiles')
        .insert(input)
        .select('*')
        .single()
      if (error) throw error
      return data as ManagedProfile
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['managed_profiles'] })
      void refreshManagedProfiles()
      toast('Profile added', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useManagedProfiles', 'Could not add profile', toast),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<ManagedProfile, 'name' | 'relationship' | 'avatar_url'>> }): Promise<ManagedProfile> => {
      const { data, error } = await supabase
        .from('managed_profiles')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as ManagedProfile
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['managed_profiles'] })
      void refreshManagedProfiles()
      toast('Profile updated', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useManagedProfiles', 'Could not update profile', toast),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('managed_profiles')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['managed_profiles'] })
      void refreshManagedProfiles()
      toast('Profile removed', 'ts')
    },
    onError: (err: unknown) => handleMutationError(err, 'useManagedProfiles', 'Could not remove profile', toast),
  })

  return {
    profiles: data ?? [],
    isLoading,
    addProfile: addMutation.mutate,
    addProfileAsync: addMutation.mutateAsync,
    updateProfile: updateMutation.mutate,
    deleteProfile: deleteMutation.mutate,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
