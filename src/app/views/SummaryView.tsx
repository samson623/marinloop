import { useAppStore } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useNotes } from '@/shared/hooks/useNotes'
import { Card } from '@/shared/components/ui'

export function SummaryView() {
  const { isDemo } = useAuthStore()
  const { sched: demoSched, notes: demoNotes, adh } = useAppStore()
  const { timeline } = useTimeline()
  const { notes: realNotes } = useNotes()

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

  const days: { label: string; pct: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    const label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]
    const pct = isDemo
      ? (adh[key] ? Math.round((adh[key].d / adh[key].t) * 100) : i === 0 && total > 0 ? Math.round((dn / total) * 100) : 0)
      : (i === 0 && total > 0 ? Math.round((dn / total) * 100) : 0)
    days.push({ label, pct })
  }

  const notes = isDemo
    ? demoNotes.map((n) => ({ id: n.id, title: n.mid, text: n.text, created: n.time }))
    : realNotes.map((n) => ({ id: n.id, title: 'Note', text: n.content, created: n.created_at }))

  return (
    <div className="animate-view-in">
      <h2 className="text-xl font-extrabold tracking-[-0.02em] mb-4 pb-2.5 border-b-2 border-[var(--color-text-primary)] text-[var(--color-text-primary)]">
        Daily Summary
      </h2>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <StatCard n={dn} label="Completed" color="var(--color-green)" />
        <StatCard n={lt} label="Late" color="var(--color-amber)" />
        <StatCard n={ms} label="Missed" color="var(--color-red)" />
      </div>

      <Card className="mb-4">
        <h3 className="text-sm font-bold mb-3.5 text-[var(--color-text-primary)]">7-Day Adherence</h3>
        <div className="flex items-end gap-1.5 h-[100px] pb-5 relative">
          {days.map((d, i) => {
            const bc = d.pct >= 80 ? 'var(--color-green)' : d.pct >= 50 ? 'var(--color-amber)' : d.pct > 0 ? 'var(--color-red)' : 'var(--color-ring-track)'
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1 relative">
                <div className="text-[9px] font-bold text-[var(--color-text-tertiary)] [font-family:var(--font-mono)]">{d.pct}%</div>
                <div
                  className="w-full rounded min-h-[3px] transition-[width] duration-300"
                  style={{ background: bc, height: `${Math.max(d.pct * 0.7, 3)}%` }}
                />
                <div className={`absolute bottom-0 text-[10px] font-bold [font-family:var(--font-mono)] ${i === 6 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'}`}>
                  {d.label}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-bold mb-2.5 text-[var(--color-text-primary)]">Recent Notes</h3>
        {notes.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-tertiary)]">No notes yet.</p>
        ) : (
          notes.slice(0, 5).map((n) => (
            <div key={n.id} className="mb-2 pb-2 border-b border-[var(--color-border-secondary)] last:border-0 last:mb-0 last:pb-0">
              <div className="flex justify-between mb-0.5">
                <span className="font-semibold text-[13px] text-[var(--color-text-primary)]">{n.title}</span>
                <span className="text-[11px] text-[var(--color-text-tertiary)] [font-family:var(--font-mono)]">
                  {new Date(n.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">{n.text}</div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function StatCard({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <Card className="text-center">
      <div className="text-[28px] font-extrabold tracking-[-0.03em]" style={{ color }}>{n}</div>
      <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.08em]">{label}</div>
    </Card>
  )
}
