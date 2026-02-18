import { useEffect, useState } from 'react'
import { useAppStore, fD, fT } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { Modal } from '@/shared/components/Modal'

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
      <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--color-text-primary)' }}>
        Appointments
      </h2>

      <div className="stagger-children">
        {sorted.length === 0 && !isDemo && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border-secondary)', borderRadius: 12 }}>
            No upcoming appointments.
          </div>
        )}

        {sorted.map((a, i) => {
          const past = new Date(`${a.date}T${a.time}`) < new Date()
          return (
            <div
              key={a.id}
              className="animate-slide-r card-interactive"
              onClick={() => toast(`${a.title} - ${fD(a.date)}`, 'ts')}
              style={{
                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-secondary)',
                borderLeft: '3px solid var(--color-text-primary)', borderRadius: 14, padding: 14,
                marginBottom: 8, cursor: 'pointer', opacity: past ? 0.45 : 1, animationDelay: `${i * 0.04}s`,
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 3 }}>
                {fD(a.date)} at {fT(a.time)}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{a.loc}</div>
            </div>
          )
        })}
      </div>

      <button onClick={() => openAddApptModal(null)} style={{
        width: '100%', padding: 14, background: 'transparent', border: '2px dashed var(--color-border-primary)',
        borderRadius: 14, fontSize: 14, fontWeight: 700, color: 'var(--color-text-tertiary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Add Appointment
      </button>

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
        <FG label="Title" id="appt-title"><input className="fi" id="appt-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></FG>
        <div style={{ display: 'flex', gap: 10 }}>
          <FG label="Date" id="appt-date"><input className="fi" id="appt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></FG>
          <FG label="Time" id="appt-time"><input className="fi" id="appt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></FG>
        </div>
        <FG label="Location" id="appt-loc"><input className="fi" id="appt-loc" value={loc} onChange={(e) => setLoc(e.target.value)} /></FG>
        <FG label="Notes" id="appt-notes">
          <textarea id="appt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', height: 80, padding: 12, background: 'var(--color-input-bg)', border: '1.5px solid var(--color-border-primary)', borderRadius: 10, fontSize: 13, color: 'var(--color-text-primary)', resize: 'none', outline: 'none' }} />
        </FG>
        <button type="submit" style={{ width: '100%', padding: 14, background: 'var(--color-accent)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', borderRadius: 12, marginTop: 6 }}>
          Add Appointment
        </button>
      </form>
    </Modal>
  )
}

function FG({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14, flex: 1 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
      {children}
    </div>
  )
}
