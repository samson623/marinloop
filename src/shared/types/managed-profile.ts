/** Mirrors the `managed_profiles` table row returned by Supabase. */
export interface ManagedProfile {
  id: string
  owner_user_id: string
  name: string
  relationship: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}
