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

      <Card>
        <h3 className="font-bold mb-3 text-[var(--color-text-primary)] text-base sm:[font-size:var(--text-label)]">Recent Notes</h3>
        {notes.length === 0 ? (
          <p className="text-[var(--color-text-tertiary)] text-base sm:[font-size:var(--text-body)]">No notes yet.</p>
        ) : (
          notes.slice(0, 5).map((n) => (
            <div key={n.id} className="mb-3 pb-3 border-b border-[var(--color-border-secondary)] last:border-0 last:mb-0 last:pb-0">
              <div className="flex justify-between mb-0.5">
                <span className="font-semibold text-[var(--color-text-primary)] text-base sm:[font-size:var(--text-body)]">{n.title}</span>
                <span className="text-[var(--color-text-tertiary)] [font-family:var(--font-mono)] text-sm sm:[font-size:var(--text-caption)]">
                  {new Date(n.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-[var(--color-text-secondary)] text-sm sm:[font-size:var(--text-label)]">{n.text}</div>
            </div>
          ))
        )}
      </Card>
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
