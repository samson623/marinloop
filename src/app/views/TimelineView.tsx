import { useEffect, useRef, useState } from 'react'
import { Check, Clock, XCircle } from 'lucide-react'
import { useAppStore, fT, type SchedItem } from '@/shared/stores/app-store'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { useAuthStore } from '@/shared/stores/auth-store'
import { Modal } from '@/shared/components/Modal'
import { Pill, Button } from '@/shared/components/ui'

const CIRC = 2 * Math.PI * 46

export function TimelineView() {
  const { timeline: sched } = useTimeline()
  const { buildSched } = useAppStore()
  const [, setTick] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => {
      buildSched()
      setTick((t) => t + 1)
    }, 60000)
    return () => clearInterval(iv)
  }, [buildSched])

  const now = new Date()
  const nM = now.getHours() * 60 + now.getMinutes()

  let dn = 0
  let lt = 0
  let ms = 0
  let total = 0

  sched.forEach((i) => {
    if (i.tp !== 'med') return
    total += 1
    if (i.st === 'done') dn += 1
    else if (i.st === 'late') {
      dn += 1
      lt += 1
    } else if (i.st === 'missed') ms += 1
  })

  const pct = total > 0 ? Math.round((dn / total) * 100) : 0
  const ringColor = pct >= 80 ? 'var(--color-ring-green)' : pct >= 50 ? 'var(--color-ring-amber)' : 'var(--color-ring-red)'
  const offset = CIRC - (pct / 100) * CIRC

  return (
    <div className="animate-view-in w-full max-w-[480px] mx-auto">
      <div className="flex items-stretch justify-between gap-3 mb-6">
        <div className="shrink-0">
          <div className="font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)] text-lg sm:[font-size:var(--text-title)]">
            {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          <div className="text-[var(--color-text-secondary)] font-medium text-base sm:[font-size:var(--text-label)]">
            {now.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">
          {sched.length === 0 ? (
            <p className="text-center text-[var(--color-text-secondary)] text-base sm:[font-size:var(--text-body)] font-medium py-1">
              No items for today
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <Pill variant="green">{dn} Done</Pill>
              <Pill variant="amber">{lt} Late</Pill>
              <Pill variant="red">{ms} Missed</Pill>
            </div>
          )}
        </div>

        <div className="shrink-0 text-center" role="img" aria-label={`Adherence ${pct}%`}>
          <svg width="120" height="120" viewBox="0 0 100 100" className="-rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-ring-track)" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              stroke={ringColor}
              strokeDasharray={CIRC}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset,stroke] duration-300"
              style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1), stroke .3s' }}
            />
          </svg>
          <div className="font-extrabold tracking-[-0.03em] -mt-[82px] relative z-[1] text-[var(--color-text-primary)] text-xl sm:[font-size:var(--text-subtitle)]">{pct}%</div>
          <div className="text-[var(--color-text-tertiary)] font-medium uppercase tracking-[0.08em] mt-0.5 text-xs sm:[font-size:var(--text-caption)]">Adherence</div>
        </div>
      </div>

      {sched.length > 0 && (
        <div className="relative pl-6">
          <div className="absolute left-1 top-3 bottom-3 w-[2px] rounded-full bg-gradient-to-b from-[var(--color-border-primary)] to-transparent" aria-hidden />
          <div className="stagger-children">{sched.map((it) => <TimelineItem key={it.id} item={it} nowMin={nM} />)}</div>
        </div>
      )}
    </div>
  )
}

function TimelineItem({ item: it, nowMin }: { item: SchedItem; nowMin: number }) {
  const { toast, setTab } = useAppStore()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  let bg = 'var(--color-bg-secondary)'
  let dotColor = 'var(--color-text-tertiary)'
  let dotRadius = '50%'
  let tag: React.ReactNode = null
  let opacity = 1

  if (it.tp === 'med') {
    if (it.st === 'done') { dotColor = 'var(--color-green)'; opacity = 0.55; tag = <Tag bg="var(--color-green-bg)" color="var(--color-green)" border="var(--color-green-border)" label="Done" icon={<Check size={10} aria-hidden />} /> }
    else if (it.st === 'late') { dotColor = 'var(--color-amber)'; opacity = 0.6; tag = <Tag bg="var(--color-amber-bg)" color="var(--color-amber)" border="var(--color-amber-border)" label="Late" icon={<Clock size={10} aria-hidden />} /> }
    else if (it.st === 'missed') { dotColor = 'var(--color-red)'; bg = 'var(--color-red-bg)'; tag = <Tag bg="var(--color-red-bg)" color="var(--color-red)" border="var(--color-red-border)" label="Missed" icon={<XCircle size={10} aria-hidden />} /> }
    else if (it.nx) { dotColor = 'var(--color-amber)'; bg = 'var(--color-amber-bg)'; tag = <Tag bg="var(--color-amber-bg)" color="var(--color-amber)" border="var(--color-amber-border)" label="Next" /> }
  } else if (it.tp === 'food') {
    dotColor = 'var(--color-amber)'
    bg = 'var(--color-amber-bg)'
    dotRadius = '1px'
    tag = <Tag bg="var(--color-amber-bg)" color="var(--color-amber)" border="var(--color-amber-border)" label="Food" dashed />
  } else if (it.tp === 'appt') {
    dotColor = 'var(--color-text-primary)'
    dotRadius = '2px'
    tag = <Tag bg="var(--color-bg-tertiary)" color="var(--color-text-secondary)" border="var(--color-border-primary)" label="Appt" />
  }

  const borderLeft = it.st === 'done'
    ? '3px solid var(--color-green)'
    : it.st === 'late'
      ? '3px solid var(--color-amber)'
      : it.st === 'missed'
        ? '3px solid var(--color-red)'
        : it.nx
          ? '3px solid var(--color-amber)'
          : it.tp === 'food'
            ? '3px dashed var(--color-amber-border)'
            : it.tp === 'appt'
              ? '3px solid var(--color-text-primary)'
              : 'none'

  const handleClick = () => {
    if (it.tp === 'med' && (it.st === 'pending' || it.nx)) setOpen(true)
    else if (it.tp === 'appt') setTab('appts')
    else if (it.st === 'done' || it.st === 'late') toast(`${it.name} - already confirmed`, 'ts')
  }

  const statusText = it.tp === 'med' && it.st ? `, ${it.st}` : it.tp === 'appt' ? ', appointment' : it.tp === 'food' ? ', food' : ''
  const ariaLabel = `${it.name}, ${fT(it.time)}${statusText}`

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="animate-slide-r card-interactive relative mb-2 min-h-[56px] py-4 px-4 w-full text-left rounded-xl cursor-pointer border border-[var(--color-border-secondary)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        style={{ background: bg, borderLeft, opacity }}
        onClick={handleClick}
        aria-label={ariaLabel}
      >
        <div
          className="absolute -left-6 top-5 w-[10px] h-[10px] border-2 border-[var(--color-bg-primary)] z-[1]"
          style={{ background: dotColor, borderRadius: dotRadius }}
          aria-hidden
        />
        <div className="flex items-start gap-3">
          <span className="text-[var(--color-text-secondary)] font-bold min-w-[64px] pt-0.5 [font-family:var(--font-mono)] text-sm sm:[font-size:var(--text-caption)]">{fT(it.time)}</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold mb-0.5 truncate text-[var(--color-text-primary)] text-base sm:[font-size:var(--text-body)]">{it.name}</div>
            <div className="text-[var(--color-text-secondary)] truncate text-sm sm:[font-size:var(--text-label)]">{it.inst || ''}</div>
          </div>
          {tag}
        </div>
      </button>
      {open && <DoseModal item={it} onClose={() => setOpen(false)} nowMin={nowMin} triggerRef={triggerRef} />}
    </>
  )
}

function Tag({ bg, color, border, label, dashed, icon }: { bg: string; color: string; border: string; label: string; dashed?: boolean; icon?: React.ReactNode }) {
  return (
    <span
      className="font-bold uppercase tracking-[0.08em] py-1 px-2.5 rounded-lg whitespace-nowrap shrink-0 self-start inline-flex items-center gap-1.5 [font-size:var(--text-caption)]"
      style={{ background: bg, color, border: `1px ${dashed ? 'dashed' : 'solid'} ${border}` }}
    >
      {icon}
      {label}
    </span>
  )
}

function DoseModal({ item: it, onClose, nowMin, triggerRef }: { item: SchedItem; onClose: () => void; nowMin: number; triggerRef?: React.RefObject<HTMLElement | null> }) {
  const { isDemo } = useAuthStore()
  const { markDone: markDoneDemo, markMissed: markMissedDemo, toast } = useAppStore()
  const { logDose } = useDoseLogs()

  const markDone = () => {
    if (isDemo) {
      markDoneDemo(it.id)
      return
    }
    if (!it.mid) return

    const late = nowMin > it.tm + 15
    logDose({
      medication_id: it.mid,
      schedule_id: it.id,
      taken_at: new Date().toISOString(),
      status: late ? 'late' : 'taken',
      notes: null,
    })
  }

  const markMissed = () => {
    if (isDemo) {
      markMissedDemo(it.id)
      return
    }
    if (!it.mid) return

    logDose({
      medication_id: it.mid,
      schedule_id: it.id,
      taken_at: new Date().toISOString(),
      status: 'missed',
      notes: null,
    })
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Medication"
      variant="bottom"
      triggerRef={triggerRef}
    >
      <div className="text-[var(--color-text-tertiary)] mb-1 [font-family:var(--font-mono)] [font-size:var(--text-caption)]">{fT(it.time)}</div>
      <div className="font-extrabold tracking-[-0.02em] mb-1 text-[var(--color-text-primary)] [font-size:var(--text-subtitle)]">{it.name} {it.dose || ''}</div>
      <div className="text-[var(--color-text-secondary)] mb-4 [font-size:var(--text-body)]">{it.inst || ''}</div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="primary"
          size="md"
          className="!bg-[var(--color-green)]"
          onClick={() => { markDone(); onClose() }}
        >
          Mark Done
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={() => { toast(`${it.name} snoozed`, 'tw'); onClose() }}>
          Snooze
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[var(--color-red)] font-semibold"
          onClick={() => { markMissed(); onClose() }}
        >
          Mark as Missed
        </Button>
      </div>
    </Modal>
  )
}
