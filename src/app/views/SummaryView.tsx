import { useAppStore } from '@/shared/stores/app-store'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
import { useAuthStore } from '@/shared/stores/auth-store'
import { toLocalDateString } from '@/shared/lib/dates'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useNotes } from '@/shared/hooks/useNotes'
import { useMedications } from '@/shared/hooks/useMedications'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { Card } from '@/shared/components/ui'
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

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard n={dn} label="Completed" color="var(--color-green)" />
        <StatCard n={lt} label="Late" color="var(--color-amber)" />
        <StatCard n={ms} label="Missed" color="var(--color-red)" />
      </div>

      <Card className="mb-5">
        <h3 className="font-bold mb-4 text-[var(--color-text-primary)] text-base sm:[font-size:var(--text-label)]">7-Day Adherence</h3>
        <div className="flex items-end gap-2 h-[100px] pb-6 relative">
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[var(--color-text-primary)] text-base sm:[font-size:var(--text-label)]">Notes for your doctor</h3>
          <button
            type="button"
            onClick={openQuickCaptureModal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-bold hover:opacity-95 active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            aria-label="Add note"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add note
          </button>
        </div>
        {notes.length === 0 ? (
          <div className="py-6 px-4 text-center border-2 border-dashed border-[var(--color-border-secondary)] rounded-xl">
            <p className="text-[var(--color-text-secondary)] text-base sm:[font-size:var(--text-body)]">Jot down side effects or questions for your doctor</p>
            <p className="mt-1.5 text-[var(--color-text-tertiary)] text-sm sm:[font-size:var(--text-caption)]">Tap Add note or use voice</p>
            <button
              type="button"
              onClick={openQuickCaptureModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[var(--color-accent)] text-[var(--color-accent)] text-sm font-bold hover:bg-[var(--color-accent)] hover:text-[var(--color-text-inverse)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add your first note
            </button>
          </div>
        ) : (
          <>
            {notes.slice(0, 8).map((n) => (
              <div key={n.id} className="mb-3 pb-3 border-b border-[var(--color-border-secondary)] last:border-0 last:mb-0 last:pb-0">
                <div className="flex justify-between gap-2 mb-0.5">
                  <span className="font-semibold text-[var(--color-text-primary)] text-base sm:[font-size:var(--text-body)] shrink-0">{n.title}</span>
                  <span className="text-[var(--color-text-tertiary)] [font-family:var(--font-mono)] text-sm sm:[font-size:var(--text-caption)] shrink-0">
                    {new Date(n.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[var(--color-text-secondary)] text-sm sm:[font-size:var(--text-label)] break-words">{n.text}</div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const win = window.open('', '_blank', 'width=600,height=700')
                if (!win) return
                win.document.write(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Notes for Doctor Visit</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:2rem;max-width:600px;margin:0 auto;color:#1a1a1a;line-height:1.6}
h1{font-size:1.5rem;margin-bottom:0.5rem}
.sub{color:#666;font-size:0.875rem;margin-bottom:1.5rem}
.note{margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid #eee}
.note:last-child{border:0}
.note-title{font-weight:600;margin-bottom:0.25rem}
.note-meta{color:#888;font-size:0.75rem;margin-bottom:0.35rem}
.note-text{font-size:0.9375rem}
</style>
</head>
<body>
<h1>Notes for your doctor</h1>
<p class="sub">Generated ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
${notes.map((n) => `
<div class="note">
  <div class="note-title">${escapeHtml(n.title)}</div>
  <div class="note-meta">${new Date(n.created).toLocaleString()}</div>
  <div class="note-text">${escapeHtml(n.text)}</div>
</div>`).join('')}
</body>
</html>`)
                win.document.close()
                win.focus()
                setTimeout(() => { win.print(); win.close() }, 250)
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] text-sm font-semibold hover:bg-[var(--color-bg-secondary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>
              Print for visit
            </button>
          </>
        )}
      </Card>

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
    <Card className="text-center p-4">
      <div className="font-extrabold tracking-[-0.03em] text-2xl sm:[font-size:var(--text-subtitle)]" style={{ color }}>{n}</div>
      <div className="font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.08em] mt-0.5 text-sm sm:[font-size:var(--text-caption)]">{label}</div>
    </Card>
  )
}
