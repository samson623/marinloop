import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database.types'
import type { AppointmentCreateInput } from '@/shared/types/contracts'

type Appointment = Database['public']['Tables']['appointments']['Row'] & {
  profile_id?: string | null
}

type Reminder = Database['public']['Tables']['reminders']['Row'] & {
  appointment_id?: string | null
  profile_id?: string | null
}

function getAppointmentReminderTitle(appt: Pick<Appointment, 'title'>) {
  return `Appointment: ${appt.title}`
}

function getAppointmentReminderBody(appt: Pick<Appointment, 'doctor' | 'location'>) {
  const details = [appt.doctor, appt.location].filter(Boolean).join(' • ')
  return details ? `Upcoming appointment: ${details}` : 'Upcoming appointment'
}

function getAppointmentReminderFireAt(appt: Pick<Appointment, 'start_time' | 'commute_minutes'>) {
  const leadMinutes = Math.max(0, appt.commute_minutes ?? 0)
  return new Date(new Date(appt.start_time).getTime() - leadMinutes * 60 * 1000).toISOString()
}

async function getAppointmentReminder(appointmentId: string): Promise<Reminder | null> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (error) throw error
  return data as Reminder | null
}

async function syncAppointmentReminder(appt: Appointment): Promise<void> {
  const fireAt = getAppointmentReminderFireAt(appt)
  const existingReminder = await getAppointmentReminder(appt.id)

  if (new Date(fireAt).getTime() <= Date.now()) {
    if (existingReminder) {
      const { error: deleteError } = await supabase
        .from('reminders')
        .delete()
        .eq('id', existingReminder.id)

      if (deleteError) throw deleteError
    }
    return
  }

  const payload = {
    user_id: appt.user_id,
    title: getAppointmentReminderTitle(appt),
    body: getAppointmentReminderBody(appt),
    fire_at: fireAt,
    appointment_id: appt.id,
    profile_id: appt.profile_id ?? null,
  }

  if (existingReminder) {
    const { error: updateError } = await supabase
      .from('reminders')
      .update(payload as never)
      .eq('id', existingReminder.id)

    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await supabase
    .from('reminders')
    .insert(payload as never)

  if (insertError) throw insertError
}

export const AppointmentsService = {
  async getAll(profileId?: string | null): Promise<Appointment[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('appointments')
      .select('*')
      .order('start_time')

    if (profileId === undefined) {
      // no filter
    } else if (profileId === null) {
      query = query.is('profile_id', null)
    } else {
      query = query.eq('profile_id', profileId)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async create(appt: AppointmentCreateInput): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appt)
      .select('*')
      .single()

    if (error) throw error
    await syncAppointmentReminder(data as Appointment)
    return data
  },

  async update(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    await syncAppointmentReminder(data as Appointment)
    return data
  },

  async delete(id: string): Promise<void> {
    const reminder = await getAppointmentReminder(id)
    if (reminder) {
      const { error: reminderDeleteError } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminder.id)

      if (reminderDeleteError) throw reminderDeleteError
    }

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
