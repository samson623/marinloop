import { useState } from 'react'
import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { toLocalDateString } from '@/shared/lib/dates'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useNotes } from '@/shared/hooks/useNotes'
import { useMedications } from '@/shared/hooks/useMedications'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { Card, Button } from '@/shared/components/ui'
import { QuickCaptureModal } from '@/shared/components/QuickCaptureModal'
import { ConfirmDeleteModal } from '@/shared/components/ConfirmDeleteModal'

export function SummaryView() {
  const { isDemo } = useAuthStore()
  const {
    sched: demoSched,
    notes: demoNotes,
    adherence: demoAdh,
    meds: demoMeds,
    appts: demoAppts,
    addNote: storeAddNote,
    showQuickCaptureModal,
    openQuickCaptureModal,
    closeQuickCaptureModal,
  } = useAppStore()
  const { adherence: realAdh } = useAdherenceHistory(7)
  const { timeline } = useTimeline()
  const { notes: realNotes, addNote: addNoteReal, isAdding, updateNote, deleteNote, isDeleting } = useNotes()
  const { meds: realMeds } = useMedications()
  const { appts: realAppts } = useAppointments()

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const [deleteNoteName, setDeleteNoteName] = useState('')

  const meds = isDemo ? demoMeds.map((m) => ({ id: m.id, name: m.name })) : realMeds.map((m) => ({ id: m.id, name: m.name }))
  const appts = isDemo
    ? demoAppts.map((a) => ({ id: a.id, title: a.title, start_time: `${a.date}T${a.time}:00` }))
    : realAppts.map((a) => ({ id: a.id, title: a.title, start_time: a.start_time }))

  const handleAddNote = (payload: { content: string; medication_id?: string | null; appointment_id?: string | null }) => {
    if (isDemo) {
      storeAddNote({ content: payload.content, medication_id: payload.medication_id ?? undefined, appointment_id: payload.appointment_id ?? undefined })
    } else {
      addNoteReal(payload)
    }
  }

  const sched = isDemo ? demoSched : timeline

  let dn = 0
  let lt = 0
  let ms = 0
  let total = 0

  sched.forEach((i) => {
    if (i.type !== 'med') return
    total += 1
    if (i.status === 'done') dn += 1
    else if (i.status === 'late') { dn += 1; lt += 1 }
    else if (i.status === 'missed') ms += 1
  })

  const adh = isDemo ? demoAdh : realAdh
  const days: { label: string; pct: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = toLocalDateString(d)
    const label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]
    const pct = isDemo
      ? (adh[key] ? Math.round((adh[key].d / adh[key].t) * 100) : i === 0 && total > 0 ? Math.round((dn / total) * 100) : 0)
      : (adh[key] && adh[key].t > 0 ? Math.round((adh[key].d / adh[key].t) * 100) : i === 0 && total > 0 ? Math.round((dn / total) * 100) : 0)
    days.push({ label, pct })
  }

  const notes = isDemo
    ? demoNotes.map((n) => ({
      id: n.id,
      title: n.medicationId ? (demoMeds.find((m) => m.id === n.medicationId)?.name ?? 'Note') : 'Note',
      text: n.text,
      created: n.time,
    }))
    : realNotes.map((n) => ({
      id: n.id,
      title: n.medication_id ? (realMeds.find((m) => m.id === n.medication_id)?.name ?? 'Note') : 'Note',
      text: n.content,
      created: n.created_at,
    }))

  return (
    <div className="animate-view-in w-full max-w-[480px] mx-auto">
      <h2 className="font-extrabold tracking-[-0.02em] mb-5 pb-3 border-b-2 border-[var(--color-text-primary)] text-[var(--color-text-primary)] text-xl sm:[font-size:var(--text-title)]">
        Daily Summary
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard n={dn} label="Completed" color="var(--color-green)" />
        <StatCard n={lt} label="Late" color="var(--color-amber)" />
        <StatCard n={ms} label="Missed" color="var(--color-red)" />
      </div>

      <Card className="mb-6">
        <h3 className="font-bold mb-5 text-[var(--color-text-primary)] [font-size:var(--text-label)]">7-Day Adherence</h3>
        <div className="flex items-end gap-3 h-[110px] pb-7 relative">
          {days.map((d, i) => {
            const bc = d.pct >= 80 ? 'var(--color-green)' : d.pct >= 50 ? 'var(--color-amber)' : d.pct > 0 ? 'var(--color-red)' : 'var(--color-ring-track)'
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1 relative">
                <div className="font-bold text-[var(--color-text-tertiary)] [font-family:var(--font-mono)] text-sm sm:[font-size:var(--text-caption)]">{d.pct}%</div>
                <div
                  className="w-full rounded-full min-h-[4px] transition-[width] duration-300"
                  style={{ background: bc, height: `${Math.max(d.pct * 0.7, 4)}%` }}
                />
                <div className={`absolute bottom-0 font-bold [font-family:var(--font-mono)] text-sm sm:[font-size:var(--text-caption)] ${i === 6 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'}`}>
                  {d.label}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="relative">
        <h3 className="font-bold mb-4 text-[var(--color-text-primary)] [font-size:var(--text-label)]">
          Notes for your doctor
        </h3>
        {notes.length === 0 ? (
          <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-body)]">
            Jot down side effects or questions for your doctor
          </p>
        ) : (
          notes.slice(0, 8).map((n) => (
            <div key={n.id} className="mb-4 pb-4 border-b border-[var(--color-border-secondary)] last:border-0 last:mb-0 last:pb-0 group">
              <div className="flex justify-between gap-3 mb-1">
                <span className="font-semibold text-[var(--color-text-primary)] [font-size:var(--text-body)] shrink-0">{n.title}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[var(--color-text-tertiary)] [font-family:var(--font-mono)] [font-size:var(--text-caption)]">
                    {new Date(n.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {!isDemo && (
                    <>
                      {/* Edit button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(n.id)
                          setEditingNoteText(n.text)
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Edit note: ${n.text.slice(0, 20)}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteNoteId(n.id)
                          setDeleteNoteName(n.text.slice(0, 30) + (n.text.length > 30 ? '…' : ''))
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-red)] hover:bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)] cursor-pointer transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Delete note: ${n.text.slice(0, 20)}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline edit mode */}
              {editingNoteId === n.id ? (
                <div className="mt-1">
                  <textarea
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    className="fi w-full resize-y min-h-[2.5rem] py-2 px-3 [font-size:var(--text-label)]"
                    rows={2}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingNoteId(null)
                    }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditingNoteId(null)}
                      className="py-1.5 px-3 rounded-lg text-[var(--color-text-secondary)] [font-size:var(--text-caption)] font-semibold cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingNoteText.trim()) {
                          updateNote({ id: n.id, content: editingNoteText.trim() })
                        }
                        setEditingNoteId(null)
                      }}
                      className="py-1.5 px-3 rounded-lg bg-[var(--color-accent)] text-white [font-size:var(--text-caption)] font-semibold cursor-pointer hover:brightness-110 transition-all"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[var(--color-text-secondary)] [font-size:var(--text-label)] break-words max-w-[60ch]">{n.text}</div>
              )}
            </div>
          ))
        )}
      </Card>

      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={openQuickCaptureModal}
        className="mt-4 py-4 text-lg font-bold border-2 border-dashed border-[var(--color-border-primary)] text-[var(--color-text-secondary)] flex items-center justify-center gap-2 min-h-[52px] sm:mt-2.5 sm:py-3.5 sm:text-base sm:font-semibold sm:min-h-0"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 sm:w-[18px] sm:h-[18px]">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Note
      </Button>

      <QuickCaptureModal
        open={showQuickCaptureModal}
        onOpenChange={(open) => { if (!open) closeQuickCaptureModal() }}
        meds={meds}
        appts={appts}
        onSubmit={handleAddNote}
        isSubmitting={isAdding}
      />

      {/* Delete note confirmation */}
      <ConfirmDeleteModal
        open={!!deleteNoteId}
        onOpenChange={(open) => { if (!open) setDeleteNoteId(null) }}
        itemName={deleteNoteName}
        description="This note will be permanently removed."
        onConfirm={() => {
          if (deleteNoteId) {
            deleteNote(deleteNoteId)
            setDeleteNoteId(null)
          }
        }}
        isPending={isDeleting}
      />
    </div>
  )
}

function StatCard({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <Card className="text-center p-5">
      <div className="font-extrabold tracking-[-0.03em] [font-size:var(--text-subtitle)]" style={{ color }}>{n}</div>
      <div className="font-semibold text-[var(--color-text-secondary)] mt-1.5 [font-size:var(--text-caption)]">{label}</div>
    </Card>
  )
}

