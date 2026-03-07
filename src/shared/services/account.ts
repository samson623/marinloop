import { supabase } from '../lib/supabase'

export const AccountService = {
  /**
   * Deletes all health data for the current user via SECURITY DEFINER RPC.
   * Does NOT delete the auth account — the caller must sign out after.
   */
  async deleteAllData(): Promise<void> {
    const { error } = await supabase.rpc('delete_account_and_data')
    if (error) throw error
  },

  /**
   * Exports all user data as a JSON Blob for download.
   */
  async exportData(): Promise<Blob> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const uid = user.id

    const [
      medsRes, schedulesRes, doseLogsRes, appointmentsRes,
      notesRes, vitalsRes, journalRes, symptomsRes,
      remindersRes, profileRes,
    ] = await Promise.all([
      supabase.from('medications').select('*').eq('user_id', uid),
      supabase.from('schedules').select('*').eq('user_id', uid),
      supabase.from('dose_logs').select('*').eq('user_id', uid),
      supabase.from('appointments').select('*').eq('user_id', uid),
      supabase.from('notes').select('*').eq('user_id', uid),
      supabase.from('vitals').select('*').eq('user_id', uid),
      supabase.from('journal_entries').select('*').eq('user_id', uid),
      supabase.from('symptoms').select('*').eq('user_id', uid),
      supabase.from('reminders').select('*').eq('user_id', uid),
      supabase.from('profiles').select('name, timezone, plan').eq('id', uid).single(),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      app: 'marinloop',
      version: '1.0.0-beta',
      profile: profileRes.data,
      medications: medsRes.data ?? [],
      schedules: schedulesRes.data ?? [],
      dose_logs: doseLogsRes.data ?? [],
      appointments: appointmentsRes.data ?? [],
      notes: notesRes.data ?? [],
      vitals: vitalsRes.data ?? [],
      journal_entries: journalRes.data ?? [],
      symptoms: symptomsRes.data ?? [],
      reminders: remindersRes.data ?? [],
    }

    return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  },
}
