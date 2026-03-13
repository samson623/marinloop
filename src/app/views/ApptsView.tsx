import { useMemo, useState } from 'react'
import { useAppStore, fD, fT } from '@/shared/stores/app-store'
import { todayLocal, isoToLocalDate, toLocalTimeString } from '@/shared/lib/dates'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { Modal } from '@/shared/components/Modal'
import { ConfirmDeleteModal } from '@/shared/components/ConfirmDeleteModal'
import { Button, Input, Pill } from '@/shared/components/ui'
import { SkeletonApptCard } from '@/shared/components/Skeleton'

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
    showAddApptModal,
    draftAppt,
    openAddApptModal,
    closeAddApptModal,
  } = useAppStore()
  const { appts: realAppts, isLoading: apptsLoading, addAppt, updateAppt, deleteAppt } = useAppointments()
  const [selectedAppt, setSelectedAppt] = useState<DisplayAppt | null>(null)

  const displayAppts: DisplayAppt[] = realAppts.map((a) => ({
    id: a.id,
    title: a.title,
    date: isoToLocalDate(a.start_time),
    time: toLocalTimeString(a.start_time),
    loc: a.location || '',
    notes: a.notes ? [a.notes] : [],
    doctor: a.doctor,
    start_time: a.start_time,
  }))

  const sortedAppts = useMemo(
    () => [...displayAppts].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()),
    [realAppts], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="animate-view-in w-full max-w-[480px] mx-auto">
      <h2 className="page-header text-xl sm:[font-size:var(--text-title)]">
        Appointments
      </h2>

      <div className="stagger-children space-y-3 mb-6" role="list">
        {apptsLoading ? (
          <>
            <SkeletonApptCard />
            <SkeletonApptCard />
            <SkeletonApptCard />
          </>
        ) : sortedAppts.length === 0 ? (
          <div className="empty-state rounded-2xl border-2 border-dashed border-[var(--color-border-secondary)] py-8 px-5 text-center flex flex-col items-center gap-3 sm:py-6 sm:px-4">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <div>
              <p className="text-[var(--color-text-primary)] font-semibold text-lg leading-snug">No appointments scheduled</p>
              <p className="mt-1 text-[var(--color-text-secondary)] text-sm max-w-xs">
                Stay on top of your care — add upcoming visits, tests, or check-ins.
              </p>
            </div>
          </div>
        ) : (
          sortedAppts.map((a, i) => {
            const past = new Date(`${a.date}T${a.time}`) < new Date()
            const formattedDate = `${fD(a.date)} at ${fT(a.time)}`
            return (
              <button
                key={a.id}
                type="button"
                role="listitem"
                aria-label={`${a.title} on ${formattedDate}`}
                className="animate-slide-r card-interactive w-full text-left bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] border-l-4 border-l-[var(--color-text-primary)] rounded-2xl p-5 min-h-[56px] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                style={{ animationDelay: `${i * 0.04}s`, opacity: past ? 0.45 : 1 }}
                onClick={() => setSelectedAppt(a)}
              >
                <div className="text-[var(--color-text-tertiary)] mb-1 [font-family:var(--font-mono)] [font-size:var(--text-caption)]">
                  {formattedDate}
                </div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-body)]">{a.title}</span>
                  {past && (
                    <Pill variant="neutral" className="rounded-full py-1.5 px-3 min-h-0 font-semibold [font-size:var(--text-caption)]">Past</Pill>
                  )}
                </div>
                <div className="[font-size:var(--text-caption)] text-[var(--color-text-secondary)]">{a.loc}</div>
              </button>
            )
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => openAddApptModal(null)}
        className="w-full mt-2 py-4 text-lg font-bold border-2 border-dashed border-[var(--color-border-primary)] text-[var(--color-text-secondary)] rounded-2xl flex items-center justify-center gap-2 min-h-[52px] bg-transparent cursor-pointer transition-all hover:brightness-105 active:scale-[0.98]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Add Appointment
      </button>

      {selectedAppt && (
        <ApptDetailModal
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onUpdate={(id, updates) => {
            updateAppt({ id, updates })
            setSelectedAppt(null)
          }}
          onDelete={(id) => {
            deleteAppt(id)
            setSelectedAppt(null)
          }}
        />
      )}

      {showAddApptModal && (
        <AddApptModal
          key={draftAppt?.title ?? 'new'}
          onClose={closeAddApptModal}
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
  onClose,
  onUpdate,
  onDelete,
}: {
  appt: DisplayAppt
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
        <div className="rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] p-5 -mt-2 -mx-2 sm:-mx-4">
          {past && (
            <div className="mb-4 rounded-full py-1.5 px-3 bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] font-semibold inline-block">
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
  initialDraft,
}: {
  onClose: () => void
  createRealAppt: (input: { title: string; start_time: string; location: string; notes: string; commute_minutes: number; doctor: string | null }) => void
  initialDraft: { title?: string; date?: string; time?: string; loc?: string; notes?: string } | null
}) {
  const today = todayLocal()
  const [title, setTitle] = useState(initialDraft?.title ?? '')
  const [date, setDate] = useState(initialDraft?.date ?? today)
  const [time, setTime] = useState(initialDraft?.time ?? '14:00')
  const [loc, setLoc] = useState(initialDraft?.loc ?? '')
  const [notes, setNotes] = useState(initialDraft?.notes ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    createRealAppt({
      title,
      start_time: new Date(`${date}T${time}:00`).toISOString(),
      location: loc,
      notes,
      commute_minutes: 0,
      doctor: null,
    })

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
    <div className="mb-4 flex-1">
      <label htmlFor={id} className="block font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-[0.08em] [font-size:var(--text-label)]">
        {label}
      </label>
      {children}
    </div>
  )
}
