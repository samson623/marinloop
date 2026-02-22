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

export function SummaryView() {
  const { isDemo } = useAuthStore()
  const {
    sched: demoSched,
    notes: demoNotes,
    adh: demoAdh,
    meds: demoMeds,
    appts: demoAppts,
    addNote: storeAddNote,
    showQuickCaptureModal,
    openQuickCaptureModal,
    closeQuickCaptureModal,
  } = useAppStore()
  const { adh: realAdh } = useAdherenceHistory(7)
  const { timeline } = useTimeline()
  const { notes: realNotes, addNote: addNoteReal, isAdding } = useNotes()
  const { meds: realMeds } = useMedications()
  const { appts: realAppts } = useAppointments()

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
    if (i.tp !== 'med') return
    total += 1
    if (i.st === 'done') dn += 1
    else if (i.st === 'late') { dn += 1; lt += 1 }
    else if (i.st === 'missed') ms += 1
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
        title: n.mid ? (demoMeds.find((m) => m.id === n.mid)?.name ?? 'Note') : 'Note',
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
            <div key={n.id} className="mb-4 pb-4 border-b border-[var(--color-border-secondary)] last:border-0 last:mb-0 last:pb-0">
              <div className="flex justify-between gap-3 mb-1">
                <span className="font-semibold text-[var(--color-text-primary)] [font-size:var(--text-body)] shrink-0">{n.title}</span>
                <span className="text-[var(--color-text-tertiary)] [font-family:var(--font-mono)] [font-size:var(--text-caption)] shrink-0">
                  {new Date(n.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-[var(--color-text-secondary)] [font-size:var(--text-label)] break-words max-w-[60ch]">{n.text}</div>
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
