import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: mockSupabase }))

import { AppointmentsService } from '@/shared/services/appointments'

const futureStart = new Date(Date.now() + 60 * 60 * 1000).toISOString()

const makeAppointment = (overrides: Record<string, unknown> = {}) => ({
  id: 'appt-1',
  user_id: 'user-1',
  title: 'Cardiology',
  doctor: 'Dr. Patel',
  location: 'City Clinic',
  commute_minutes: 0,
  start_time: futureStart,
  notes: null,
  created_at: '2026-04-04T00:00:00.000Z',
  updated_at: '2026-04-04T00:00:00.000Z',
  profile_id: null,
  ...overrides,
})

const makeReminder = (overrides: Record<string, unknown> = {}) => ({
  id: 'rem-1',
  user_id: 'user-1',
  title: 'Appointment: Cardiology',
  body: 'Upcoming appointment: Dr. Patel • City Clinic',
  fire_at: futureStart,
  fired: false,
  fired_at: null,
  created_at: '2026-04-04T00:00:00.000Z',
  appointment_id: 'appt-1',
  profile_id: null,
  ...overrides,
})

function createSelectSingleChain(result: unknown) {
  return {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
}

function createReminderLookupChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
}

function createMutationChain(result: unknown) {
  return {
    insert: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
  }
}

describe('AppointmentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an appointment reminder when a future appointment is added', async () => {
    const appointment = makeAppointment()
    const appointmentInsert = createSelectSingleChain({ data: appointment, error: null })
    const reminderLookup = createReminderLookupChain({ data: null, error: null })
    const reminderInsert = createMutationChain({ data: null, error: null })

    let reminderCall = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'appointments') return appointmentInsert
      if (table === 'reminders') {
        reminderCall += 1
        return reminderCall === 1 ? reminderLookup : reminderInsert
      }
      throw new Error(`Unexpected table ${table}`)
    })

    await AppointmentsService.create({
      title: 'Cardiology',
      doctor: 'Dr. Patel',
      location: 'City Clinic',
      commute_minutes: 0,
      start_time: futureStart,
      notes: null,
    })

    expect(reminderLookup.eq).toHaveBeenCalledWith('appointment_id', 'appt-1')
    expect(reminderInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      appointment_id: 'appt-1',
      user_id: 'user-1',
      title: 'Appointment: Cardiology',
    }))
  })

  it('updates the linked reminder when an appointment changes', async () => {
    const appointment = makeAppointment({ title: 'Updated Cardiology', commute_minutes: 15 })
    const existingReminder = makeReminder()
    const appointmentUpdate = createSelectSingleChain({ data: appointment, error: null })
    const reminderLookup = createReminderLookupChain({ data: existingReminder, error: null })
    const reminderUpdate = createMutationChain({ data: null, error: null })

    let reminderCall = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'appointments') return appointmentUpdate
      if (table === 'reminders') {
        reminderCall += 1
        return reminderCall === 1 ? reminderLookup : reminderUpdate
      }
      throw new Error(`Unexpected table ${table}`)
    })

    await AppointmentsService.update('appt-1', {
      title: 'Updated Cardiology',
      commute_minutes: 15,
    })

    expect(reminderUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      appointment_id: 'appt-1',
      title: 'Appointment: Updated Cardiology',
    }))
    expect(reminderUpdate.eq).toHaveBeenCalledWith('id', 'rem-1')
  })

  it('deletes the linked reminder when an appointment is removed', async () => {
    const reminderLookup = createReminderLookupChain({ data: makeReminder(), error: null })
    const reminderDelete = createMutationChain({ data: null, error: null })
    const appointmentDelete = createMutationChain({ data: null, error: null })

    let reminderCall = 0
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'appointments') return appointmentDelete
      if (table === 'reminders') {
        reminderCall += 1
        return reminderCall === 1 ? reminderLookup : reminderDelete
      }
      throw new Error(`Unexpected table ${table}`)
    })

    await AppointmentsService.delete('appt-1')

    expect(reminderDelete.delete).toHaveBeenCalled()
    expect(reminderDelete.eq).toHaveBeenCalledWith('id', 'rem-1')
    expect(appointmentDelete.delete).toHaveBeenCalled()
    expect(appointmentDelete.eq).toHaveBeenCalledWith('id', 'appt-1')
  })
})
