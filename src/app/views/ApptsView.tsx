import { useEffect, useState } from 'react'
import { useAppStore, fD, fT } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { todayLocal, isoToLocalDate, toLocalTimeString } from '@/shared/lib/dates'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { Modal } from '@/shared/components/Modal'
import { ConfirmDeleteModal } from '@/shared/components/ConfirmDeleteModal'
import { Button, Input } from '@/shared/components/ui'

type DisplayAppt = {
  id: string
  title: string
  date: string
  time: string
  loc: string
  notes: string[]
  doctor?: string | null
  start_time?: string
}

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
  const { appts: realAppts, addAppt, updateAppt, deleteAppt } = useAppointments()
  const [selectedAppt, setSelectedAppt] = useState<DisplayAppt | null>(null)

  const displayAppts: DisplayAppt[] = isDemo
    ? demoAppts
    : realAppts.map((a) => ({
      id: a.id,
      title: a.title,
      date: isoToLocalDate(a.start_time),
      time: toLocalTimeString(a.start_time),
      loc: a.location || '',
      notes: a.notes ? [a.notes] : [],
      doctor: a.doctor,
      start_time: a.start_time,
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
              onClick={() => setSelectedAppt(a)}
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

      {selectedAppt && (
        <ApptDetailModal
          appt={selectedAppt}
          isDemo={isDemo}
          onClose={() => setSelectedAppt(null)}
          onUpdate={(id, updates) => {
            if (isDemo) { toast('Sign in to edit records', 'ts'); return }
            updateAppt({ id, updates })
            setSelectedAppt(null)
          }}
          onDelete={(id) => {
            if (isDemo) { toast('Sign in to edit records', 'ts'); return }
            deleteAppt(id)
            setSelectedAppt(null)
          }}
        />
      )}

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

/* ────────────────────────────────────────────────────────
   Appointment Detail Modal — View, Edit, Delete
   ──────────────────────────────────────────────────────── */

function ApptDetailModal({
  appt,
  isDemo,
  onClose,
  onUpdate,
  onDelete,
}: {
  appt: DisplayAppt
  isDemo: boolean
  onClose: () => void
  onUpdate: (id: string, updates: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [title, setTitle] = useState(appt.title)
  const [date, setDate] = useState(appt.date)
  const [time, setTime] = useState(appt.time)
  const [loc, setLoc] = useState(appt.loc)
  const [notes, setNotes] = useState(appt.notes.join('\n'))

  const handleSave = () => {
    onUpdate(appt.id, {
      title,
      start_time: new Date(`${date}T${time}:00`).toISOString(),
      location: loc,
      notes,
    })
  }

  const past = new Date(`${appt.date}T${appt.time}`) < new Date()

  if (isEditing) {
    return (
      <Modal open onOpenChange={(o) => !o && setIsEditing(false)} title="Edit Appointment" variant="center">
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
          <FG label="Title" id="edit-appt-title">
            <Input id="edit-appt-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </FG>
          <div className="flex gap-2.5">
            <FG label="Date" id="edit-appt-date">
              <Input id="edit-appt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </FG>
            <FG label="Time" id="edit-appt-time">
              <Input id="edit-appt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </FG>
          </div>
          <FG label="Location" id="edit-appt-loc">
            <Input id="edit-appt-loc" value={loc} onChange={(e) => setLoc(e.target.value)} />
          </FG>
          <FG label="Notes" id="edit-appt-notes">
            <textarea
              id="edit-appt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="fi w-full h-20 py-3 px-3.5 resize-none"
              rows={3}
            />
          </FG>
          <div className="flex gap-3 mt-2">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    )
  }

  return (
    <>
      <Modal open onOpenChange={(o) => !o && onClose()} title={appt.title} variant="center" closeLabel="Close">
        <div className="rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] p-6 sm:p-8 -mt-2 -mx-2 sm:-mx-4">
          {past && (
            <div className="mb-4 py-1.5 px-3 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] font-semibold inline-block">
              Past appointment
            </div>
          )}

          <div className="space-y-4 [font-size:var(--text-body)]">
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-text-tertiary)] shrink-0 w-24">When</span>
              <span className="text-[var(--color-text-primary)] font-medium">
                {fD(appt.date)} at {fT(appt.time)}
              </span>
            </div>
            {appt.loc && (
              <div className="flex items-start gap-3">
                <span className="text-[var(--color-text-tertiary)] shrink-0 w-24">Where</span>
                <span className="text-[var(--color-text-primary)]">{appt.loc}</span>
              </div>
            )}
            {appt.doctor && (
              <div className="flex items-start gap-3">
                <span className="text-[var(--color-text-tertiary)] shrink-0 w-24">Doctor</span>
                <span className="text-[var(--color-text-primary)]">{appt.doctor}</span>
              </div>
            )}
            {appt.notes.length > 0 && (
              <div className="flex items-start gap-3">
                <span className="text-[var(--color-text-tertiary)] shrink-0 w-24">Notes</span>
                <div className="text-[var(--color-text-primary)] space-y-1">
                  {appt.notes.map((n, i) => (
                    <p key={i} className="leading-relaxed">{n}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-6 pt-5 border-t border-[var(--color-border-primary)] flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (isDemo) return
                setIsEditing(true)
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-[var(--color-accent)] bg-[var(--color-accent-bg)] border border-[var(--color-green-border)] cursor-pointer transition-all hover:brightness-105 active:scale-[0.97] [font-size:var(--text-body)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (isDemo) return
                setShowDeleteConfirm(true)
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)] border border-[color-mix(in_srgb,var(--color-red)_20%,transparent)] cursor-pointer transition-all hover:brightness-105 active:scale-[0.97] [font-size:var(--text-body)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemName={appt.title}
        description="This appointment will be permanently removed."
        onConfirm={() => onDelete(appt.id)}
      />
    </>
  )
}

/* ────────────────────────────────────────────────────────
   Add Appointment Modal (unchanged form, extracted)
   ──────────────────────────────────────────────────────── */

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
