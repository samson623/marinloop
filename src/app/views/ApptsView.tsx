import { useEffect, useState } from 'react'
import { useAppStore, fD, fT } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
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
      date: a.start_time.split('T')[0],
      time: a.start_time.split('T')[1].slice(0, 5),
      loc: a.location || '',
      notes: a.notes ? [a.notes] : [],
    }))

  const sorted = [...displayAppts].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())

  return (
    <div className="animate-view-in">
      <h2 className="text-xl font-extrabold tracking-[-0.02em] mb-4 pb-2.5 border-b-2 border-[var(--color-text-primary)] text-[var(--color-text-primary)]">
        Appointments
      </h2>

      <div className="stagger-children">
        {sorted.length === 0 && !isDemo && (
          <div className="py-5 text-center text-[var(--color-text-secondary)] border border-dashed border-[var(--color-border-secondary)] rounded-xl">
            No upcoming appointments.
          </div>
        )}

        {sorted.map((a, i) => {
          const past = new Date(`${a.date}T${a.time}`) < new Date()
          return (
            <button
              key={a.id}
              type="button"
              className="animate-slide-r card-interactive w-full text-left bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] border-l-[3px] border-l-[var(--color-text-primary)] rounded-[14px] p-3.5 mb-2 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              style={{ animationDelay: `${i * 0.04}s`, opacity: past ? 0.45 : 1 }}
              onClick={() => toast(`${a.title} - ${fD(a.date)}`, 'ts')}
            >
              <div className="text-[11px] text-[var(--color-text-tertiary)] mb-0.5 [font-family:var(--font-mono)]">
                {fD(a.date)} at {fT(a.time)}
              </div>
              <div className="text-[15px] font-bold mb-0.5 text-[var(--color-text-primary)]">{a.title}</div>
              <div className="text-xs text-[var(--color-text-secondary)]">{a.loc}</div>
            </button>
          )
        })}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={() => openAddApptModal(null)}
        className="mt-2.5 border-2 border-dashed border-[var(--color-border-primary)] text-[var(--color-text-tertiary)] flex items-center justify-center gap-1.5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
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
  const today = new Date().toISOString().split('T')[0]
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('14:00')
  const [loc, setLoc] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!initialDraft) return
    if (initialDraft.title) setTitle(initialDraft.title)
    if (initialDraft.date) setDate(initialDraft.date)
    if (initialDraft.time) setTime(initialDraft.time)
    if (initialDraft.loc) setLoc(initialDraft.loc)
    if (initialDraft.notes) setNotes(initialDraft.notes)
  }, [initialDraft])

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
        start_time: `${date}T${time}:00`,
        location: loc,
        notes,
        commute_minutes: 0,
        doctor: null,
      })
    }

    onClose()
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Add Appointment" variant="bottom">
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
      <label htmlFor={id} className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-[0.08em]">
        {label}
      </label>
      {children}
    </div>
  )
}
