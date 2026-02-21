import { useState } from 'react'
import { useAppStore, fD, fT } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { todayLocal, isoToLocalDate, toLocalTimeString } from '@/shared/lib/dates'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { Modal } from '@/shared/components/Modal'
import { Button, Input } from '@/shared/components/ui'

export function ApptsView() {
  const {
    appts: demoAppts,
    toast,
    showAddApptModal,
    draftAppt,
    openAddApptModal,
    closeAddApptModal,
  } = useAppStore()
  const { isDemo } = useAuthStore()
  const { appts: realAppts, addAppt } = useAppointments()

  const displayAppts = isDemo
    ? demoAppts
    : realAppts.map((a) => ({
      id: a.id,
      title: a.title,
      date: isoToLocalDate(a.start_time),
      time: toLocalTimeString(a.start_time),
      loc: a.location || '',
      notes: a.notes ? [a.notes] : [],
    }))

  const sorted = [...displayAppts].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())

  return (
    <div className="animate-view-in w-full max-w-[480px] mx-auto">
      <h2 className="font-extrabold tracking-[-0.02em] mb-5 pb-3 border-b-2 border-[var(--color-text-primary)] text-[var(--color-text-primary)] text-xl sm:[font-size:var(--text-title)]">
        Appointments
      </h2>

      <div className="stagger-children">
        {sorted.length === 0 && !isDemo && (
          <div className="py-8 px-5 text-center border-2 border-dashed border-[var(--color-border-secondary)] rounded-2xl sm:py-6 sm:px-4">
            <p className="text-[var(--color-text-secondary)] text-lg font-medium sm:text-base">No upcoming appointments.</p>
            <p className="mt-2 text-[var(--color-text-tertiary)] text-sm sm:[font-size:var(--text-caption)]">Tap the button below to add one</p>
          </div>
        )}

        {sorted.map((a, i) => {
          const past = new Date(`${a.date}T${a.time}`) < new Date()
          return (
            <button
              key={a.id}
              type="button"
              className="animate-slide-r card-interactive w-full text-left bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] border-l-4 border-l-[var(--color-text-primary)] rounded-2xl p-4 mb-3 min-h-[56px] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              style={{ animationDelay: `${i * 0.04}s`, opacity: past ? 0.45 : 1 }}
              onClick={() => toast(`${a.title} - ${fD(a.date)}`, 'ts')}
            >
              <div className="text-[var(--color-text-tertiary)] mb-1 [font-family:var(--font-mono)] text-sm sm:[font-size:var(--text-caption)]">
                {fD(a.date)} at {fT(a.time)}
              </div>
              <div className="font-bold mb-0.5 text-[var(--color-text-primary)] text-base sm:[font-size:var(--text-body)]">{a.title}</div>
              <div className="text-[var(--color-text-secondary)] text-sm sm:[font-size:var(--text-label)]">{a.loc}</div>
            </button>
          )
        })}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={() => openAddApptModal(null)}
        className="mt-4 py-4 text-lg font-bold border-2 border-dashed border-[var(--color-border-primary)] text-[var(--color-text-secondary)] flex items-center justify-center gap-2 min-h-[52px] sm:mt-2.5 sm:py-3.5 sm:text-base sm:font-semibold sm:min-h-0"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 sm:w-[18px] sm:h-[18px]"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Add Appointment
      </Button>

      {showAddApptModal && (
        <AddApptModal
          onClose={closeAddApptModal}
          isDemo={isDemo}
          createRealAppt={addAppt}
          initialDraft={draftAppt}
        />
      )}
    </div>
  )
}

function AddApptModal({
  onClose,
  createRealAppt,
  isDemo,
  initialDraft,
}: {
  onClose: () => void
  createRealAppt: (input: { title: string; start_time: string; location: string; notes: string; commute_minutes: number; doctor: string | null }) => void
  isDemo: boolean
  initialDraft: { title?: string; date?: string; time?: string; loc?: string; notes?: string } | null
}) {
  const { addAppt: addApptDemo } = useAppStore()
  const today = todayLocal()
  const [title, setTitle] = useState(initialDraft?.title ?? '')
  const [date, setDate] = useState(initialDraft?.date ?? today)
  const [time, setTime] = useState(initialDraft?.time ?? '14:00')
  const [loc, setLoc] = useState(initialDraft?.loc ?? '')
  const [notes, setNotes] = useState(initialDraft?.notes ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isDemo) {
      addApptDemo({
        title,
        date,
        time,
        loc,
        notes: notes.trim() ? notes.split('\n').filter(Boolean) : [],
      })
    } else {
      createRealAppt({
        title,
        start_time: new Date(`${date}T${time}:00`).toISOString(),
        location: loc,
        notes,
        commute_minutes: 0,
        doctor: null,
      })
    }

    onClose()
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Add Appointment" variant="center">
      <form onSubmit={handleSubmit}>
        <FG label="Title" id="appt-title">
          <Input id="appt-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </FG>
        <div className="flex gap-2.5">
          <FG label="Date" id="appt-date">
            <Input id="appt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </FG>
          <FG label="Time" id="appt-time">
            <Input id="appt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </FG>
        </div>
        <FG label="Location" id="appt-loc">
          <Input id="appt-loc" value={loc} onChange={(e) => setLoc(e.target.value)} />
        </FG>
        <FG label="Notes" id="appt-notes">
          <textarea
            id="appt-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="fi w-full h-20 py-3 px-3.5 resize-none"
            rows={3}
          />
        </FG>
        <Button type="submit" variant="primary" size="md" className="mt-1.5">
          Add Appointment
        </Button>
      </form>
    </Modal>
  )
}

function FG({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex-1">
      <label htmlFor={id} className="block font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-[0.08em] [font-size:var(--text-label)]">
        {label}
      </label>
      {children}
    </div>
  )
}
