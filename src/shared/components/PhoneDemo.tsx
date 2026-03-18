import { useState, useRef, useEffect, useCallback } from 'react'
import {
  LogoIcon, ClockIcon, PillIcon, CalendarIcon, BarChartIcon,
  UsersIcon, MicIcon,
} from '@/shared/components/icons'
import '@/styles/phone-demo.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TabId = 'timeline' | 'meds' | 'appts' | 'health' | 'care'
type MedStatus = 'done' | 'late' | 'next' | 'pending' | 'missed'

interface MockMed {
  id: number
  name: string
  time: string
  status: MedStatus
  dosage: string
  freq: string
  freqNum: number
  times: string[]
  supply: string
  pills: number
  totalPills: number
  daysLeft: number
  refill: string
  adherence: number
  instructions: string
  icon: string
}

interface CursorState {
  x: number
  y: number
  visible: boolean
  clicking: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TABS: { id: TabId; label: string; icon: typeof ClockIcon }[] = [
  { id: 'timeline', label: 'Timeline', icon: ClockIcon },
  { id: 'meds', label: 'Meds', icon: PillIcon },
  { id: 'appts', label: 'Appts', icon: CalendarIcon },
  { id: 'health', label: 'Health', icon: BarChartIcon },
  { id: 'care', label: 'Care', icon: UsersIcon },
]

const INITIAL_MEDS: MockMed[] = [
  { id: 1, name: 'Ciprofloxacin', time: '12:07 AM', status: 'done', dosage: '500mg', freq: '2x daily', freqNum: 2, times: ['12:07 AM', '2:00 PM'], supply: '10 pills', pills: 10, totalPills: 10, daysLeft: 5, refill: 'Mar 25', adherence: 94, instructions: 'Take one pill by a month in the morning and one in the evening for five days', icon: '💊' },
  { id: 2, name: 'Gabapentin', time: '9:11 PM', status: 'late', dosage: '100 MG', freq: '1x daily', freqNum: 1, times: ['9:11 PM'], supply: '30 pills', pills: 30, totalPills: 30, daysLeft: 30, refill: 'Apr 20', adherence: 88, instructions: 'Take once daily at bedtime', icon: '💊' },
  { id: 3, name: 'Vitamin D3', time: '6:00 PM', status: 'next', dosage: '2000 IU', freq: '1x daily', freqNum: 1, times: ['6:00 PM'], supply: '60 pills', pills: 60, totalPills: 90, daysLeft: 60, refill: 'May 1', adherence: 76, instructions: 'Take with food', icon: '☀️' },
  { id: 4, name: 'Aspirin', time: '9:00 PM', status: 'pending', dosage: '81mg', freq: '1x daily', freqNum: 1, times: ['9:00 PM'], supply: '90 pills', pills: 90, totalPills: 90, daysLeft: 90, refill: 'Jun 10', adherence: 91, instructions: 'Take with food or milk', icon: '💊' },
  { id: 5, name: 'Metformin', time: '8:00 AM', status: 'missed', dosage: '500mg', freq: '2x daily', freqNum: 2, times: ['8:00 AM', '6:00 PM'], supply: '14 pills', pills: 14, totalPills: 60, daysLeft: 7, refill: 'Apr 5', adherence: 62, instructions: 'Take with meals', icon: '💊' },
]

const STATUS_CONFIG: Record<MedStatus, { label: string; color: string; bg: string }> = {
  done: { label: 'Done', color: 'var(--color-green)', bg: 'transparent' },
  late: { label: 'Late', color: 'var(--color-amber)', bg: 'transparent' },
  next: { label: 'Next', color: 'var(--color-amber)', bg: 'var(--color-amber-bg)' },
  pending: { label: 'Pending', color: 'var(--color-text-tertiary)', bg: 'transparent' },
  missed: { label: 'Missed', color: 'var(--color-red)', bg: 'var(--color-red-bg)' },
}

const STATUS_TO_BORDER: Record<MedStatus, string> = {
  done: 'var(--color-green)',
  late: 'var(--color-amber)',
  next: 'var(--color-amber)',
  pending: 'var(--color-text-tertiary)',
  missed: 'var(--color-red)',
}

const RING_R = 46
const RING_CIRC = 2 * Math.PI * RING_R

function computeStats(meds: MockMed[]) {
  let done = 0, late = 0, missed = 0
  for (const m of meds) {
    if (m.status === 'done') done++
    else if (m.status === 'late' || m.status === 'next') late++
    else if (m.status === 'missed') missed++
  }
  const pct = meds.length ? Math.round((done / meds.length) * 100) : 0
  return { done, late, missed, pct }
}

function getRingColor(pct: number) {
  if (pct >= 80) return 'var(--color-ring-green)'
  if (pct >= 50) return 'var(--color-ring-amber)'
  return 'var(--color-ring-red)'
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ---------------------------------------------------------------------------
// Cancelable delay with AbortSignal
// ---------------------------------------------------------------------------
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

// ---------------------------------------------------------------------------
// Demo step definitions
// ---------------------------------------------------------------------------
interface DemoContext {
  signal: AbortSignal
  pauseRef: React.MutableRefObject<boolean>
  phoneRef: React.RefObject<HTMLDivElement | null>
  setActiveTab: (tab: TabId) => void
  setMeds: React.Dispatch<React.SetStateAction<MockMed[]>>
  setCursor: React.Dispatch<React.SetStateAction<CursorState>>
  setCaption: React.Dispatch<React.SetStateAction<string>>
  setToast: React.Dispatch<React.SetStateAction<string>>
  setExpandedCard: React.Dispatch<React.SetStateAction<number | null>>
  setDetailMed: React.Dispatch<React.SetStateAction<number | null>>
}

async function waitWhilePaused(ctx: DemoContext) {
  while (ctx.pauseRef.current && !ctx.signal.aborted) {
    await delay(100, ctx.signal)
  }
}

function posOf(target: string, phoneEl: HTMLDivElement): { x: number; y: number } | null {
  const el = phoneEl.querySelector(`[data-demo-target="${target}"]`)
  if (!el) return null
  const fr = phoneEl.getBoundingClientRect()
  const er = el.getBoundingClientRect()
  return { x: er.left - fr.left + er.width / 2, y: er.top - fr.top + er.height / 2 }
}

async function moveTo(ctx: DemoContext, target: string) {
  const phone = ctx.phoneRef.current
  if (!phone) return
  const pos = posOf(target, phone)
  if (!pos) return
  ctx.setCursor(prev => ({ ...prev, x: pos.x, y: pos.y, visible: true }))
  await delay(450, ctx.signal) // wait for CSS transition
}

async function clickTarget(ctx: DemoContext, target: string) {
  await moveTo(ctx, target)
  ctx.setCursor(prev => ({ ...prev, clicking: true }))
  await delay(200, ctx.signal)
  ctx.setCursor(prev => ({ ...prev, clicking: false }))
}

function changeMedStatus(ctx: DemoContext, medId: number, newStatus: MedStatus) {
  ctx.setMeds(prev => prev.map(m => m.id === medId ? { ...m, status: newStatus } : m))
}

type DemoStep = {
  caption: string
  run: (ctx: DemoContext) => Promise<void>
}

const DEMO_STEPS: DemoStep[] = [
  // 1. Idle on timeline
  {
    caption: 'Your daily medication timeline',
    run: async (ctx) => {
      ctx.setCursor(prev => ({ ...prev, visible: true, x: 187, y: 300 }))
      await delay(2000, ctx.signal)
    },
  },
  // 2. Expand Vitamin D3 card to show detail
  {
    caption: 'Tap a dose for details',
    run: async (ctx) => {
      await clickTarget(ctx, 'med-3')
      ctx.setExpandedCard(3)
      await delay(1800, ctx.signal)
    },
  },
  // 3. Mark Vitamin D3 done via action button
  {
    caption: 'Marking a dose as taken',
    run: async (ctx) => {
      await clickTarget(ctx, 'action-done-3')
      changeMedStatus(ctx, 3, 'done')
      ctx.setExpandedCard(null)
      ctx.setToast('Vitamin D3 → Done')
      await delay(1800, ctx.signal)
    },
  },
  // 4. Expand Aspirin, mark done
  {
    caption: 'Completing another dose',
    run: async (ctx) => {
      await clickTarget(ctx, 'med-4')
      ctx.setExpandedCard(4)
      await delay(1200, ctx.signal)
      await clickTarget(ctx, 'action-done-4')
      changeMedStatus(ctx, 4, 'done')
      ctx.setExpandedCard(null)
      ctx.setToast('Aspirin 81mg → Done')
      await delay(1800, ctx.signal)
    },
  },
  // 5. Switch to Meds tab
  {
    caption: 'All your medications in one place',
    run: async (ctx) => {
      await clickTarget(ctx, 'tab-meds')
      ctx.setActiveTab('meds')
      await delay(1500, ctx.signal)
    },
  },
  // 6. Click into Lisinopril detail
  {
    caption: 'Viewing medication details',
    run: async (ctx) => {
      await clickTarget(ctx, 'medlist-2')
      ctx.setDetailMed(2)
      await delay(2500, ctx.signal)
    },
  },
  // 7. Go back from detail
  {
    caption: 'Dosage, schedule, and supply at a glance',
    run: async (ctx) => {
      await clickTarget(ctx, 'med-detail-back')
      ctx.setDetailMed(null)
      await delay(1200, ctx.signal)
    },
  },
  // 8. Switch to Health tab
  {
    caption: 'Track vitals and trends',
    run: async (ctx) => {
      await clickTarget(ctx, 'tab-health')
      ctx.setActiveTab('health')
      await delay(2200, ctx.signal)
    },
  },
  // 9. Switch to Appts tab
  {
    caption: 'Upcoming appointments at a glance',
    run: async (ctx) => {
      await clickTarget(ctx, 'tab-appts')
      ctx.setActiveTab('appts')
      await delay(2000, ctx.signal)
    },
  },
  // 10. Switch to Care tab
  {
    caption: 'Your care team, connected',
    run: async (ctx) => {
      await clickTarget(ctx, 'tab-care')
      ctx.setActiveTab('care')
      await delay(2000, ctx.signal)
    },
  },
  // 11. Back to timeline, reset
  {
    caption: '',
    run: async (ctx) => {
      await clickTarget(ctx, 'tab-timeline')
      ctx.setActiveTab('timeline')
      ctx.setCursor(prev => ({ ...prev, visible: false }))
      ctx.setExpandedCard(null)
      ctx.setDetailMed(null)
      ctx.setMeds(INITIAL_MEDS.map(m => ({ ...m })))
      await delay(2000, ctx.signal)
    },
  },
]

// ---------------------------------------------------------------------------
// useDemoSequencer — the core engine
// ---------------------------------------------------------------------------
function useDemoSequencer(phoneRef: React.RefObject<HTMLDivElement | null>) {
  const [activeTab, setActiveTab] = useState<TabId>('timeline')
  const [meds, setMeds] = useState<MockMed[]>(() => INITIAL_MEDS.map(m => ({ ...m })))
  const [cursor, setCursor] = useState<CursorState>({ x: 0, y: 0, visible: false, clicking: false })
  const [caption, setCaption] = useState('')
  const [toast, setToast] = useState('')
  const [expandedCard, setExpandedCard] = useState<number | null>(null)
  const [detailMed, setDetailMed] = useState<number | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const pauseRef = useRef(false)

  // Toast auto-clear
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  const runDemo = useCallback(async () => {
    // Abort any previous run
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setIsRunning(true)
    setIsPaused(false)
    pauseRef.current = false

    const ctx: DemoContext = {
      signal: ac.signal,
      pauseRef,
      phoneRef,
      setActiveTab,
      setMeds,
      setCursor,
      setCaption,
      setToast,
      setExpandedCard,
      setDetailMed,
    }

    try {
      for (;;) {
        if (ac.signal.aborted) break

        for (const step of DEMO_STEPS) {
          if (ac.signal.aborted) break
          await waitWhilePaused(ctx)
          if (ac.signal.aborted) break

          setCaption(step.caption)
          await step.run(ctx)
        }
      }
    } catch {
      // AbortError is expected on cleanup/pause — swallow it
    } finally {
      setIsRunning(false)
    }
  }, [phoneRef])

  const pause = useCallback(() => {
    pauseRef.current = true
    setIsPaused(true)
    setCursor(prev => ({ ...prev, visible: false }))
    setCaption('Paused — you\'re in control')
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsRunning(false)
    setIsPaused(false)
    pauseRef.current = false
    setCursor({ x: 0, y: 0, visible: false, clicking: false })
    setCaption('')
    setExpandedCard(null)
    setDetailMed(null)
  }, [])

  const resume = useCallback(() => {
    pauseRef.current = false
    setIsPaused(false)
  }, [])

  const restart = useCallback(() => {
    stop()
    setMeds(INITIAL_MEDS.map(m => ({ ...m })))
    setActiveTab('timeline')
    // Small tick to let state settle before starting
    setTimeout(() => runDemo(), 50)
  }, [stop, runDemo])

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  return {
    activeTab, setActiveTab,
    meds, setMeds,
    cursor,
    caption,
    toast,
    expandedCard, setExpandedCard,
    detailMed, setDetailMed,
    isPaused, isRunning,
    pause, resume, stop, restart, runDemo,
  }
}

// ---------------------------------------------------------------------------
// PhoneHeader
// ---------------------------------------------------------------------------
function PhoneHeader() {
  return (
    <div className="demo-phone__header">
      <div className="demo-phone__logo">
        <LogoIcon size={16} strokeWidth={2.5} aria-hidden="true" />
      </div>
      <span className="demo-phone__brand">MarinLoop</span>
      <span className="demo-phone__badge">BETA</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PhoneTabBar
// ---------------------------------------------------------------------------
function PhoneTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
  return (
    <div className="demo-phone__tabs" role="tablist" aria-label="App sections">
      {TABS.map((tab) => {
        const active = activeTab === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`demo-phone__tab${active ? ' demo-phone__tab--active' : ''}`}
            data-demo-target={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
          >
            {active && <span className="demo-phone__tab-indicator" aria-hidden="true" />}
            <Icon size={16} strokeWidth={active ? 2.2 : 1.6} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GhostCursor
// ---------------------------------------------------------------------------
function GhostCursor({ state }: { state: CursorState }) {
  const cls = [
    'demo-cursor',
    state.visible && 'demo-cursor--visible',
    state.clicking && 'demo-cursor--clicking',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cls}
      aria-hidden="true"
      style={{ left: state.x, top: state.y }}
    />
  )
}

// ---------------------------------------------------------------------------
// ToastNotification
// ---------------------------------------------------------------------------
function ToastNotification({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="demo-toast demo-toast--visible" aria-hidden="true">
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ClickRipple
// ---------------------------------------------------------------------------
function ClickRipple({ state }: { state: CursorState }) {
  if (!state.clicking || !state.visible) return null
  return (
    <div
      className="demo-ripple"
      aria-hidden="true"
      style={{ left: state.x, top: state.y }}
    />
  )
}

// ---------------------------------------------------------------------------
// TimelineScreen
// ---------------------------------------------------------------------------
function TimelineScreen({ meds, expandedCard, onExpandCard }: { meds: MockMed[]; expandedCard: number | null; onExpandCard: (id: number | null) => void }) {
  const stats = computeStats(meds)
  const ringOffset = RING_CIRC * (1 - stats.pct / 100)

  return (
    <div className="demo-screen demo-screen--timeline">
      {/* Date + Ring header */}
      <div className="demo-tl__header">
        <div>
          <div className="demo-tl__day">Today</div>
          <div className="demo-tl__date">{DAYS[new Date().getDay()]}</div>
        </div>
        <div className="demo-tl__ring-wrap">
          <svg
            width="80"
            height="80"
            viewBox="0 0 100 100"
            role="img"
            aria-label={`Adherence: ${stats.pct}%`}
          >
            <title>{stats.pct}% adherence today</title>
            <circle cx="50" cy="50" r={RING_R} className="demo-ring-track" />
            <circle
              cx="50" cy="50" r={RING_R}
              className="demo-ring-progress"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={ringOffset}
              style={{ stroke: getRingColor(stats.pct) }}
            />
          </svg>
          <div className="demo-tl__ring-pct">{stats.pct}%</div>
          <div className="demo-tl__ring-sub">Adherence</div>
        </div>
      </div>

      {/* Status pills */}
      <div className="demo-tl__pills">
        <span className="demo-pill demo-pill--green">
          <span className="demo-pill__dot" style={{ background: 'var(--color-green)' }} aria-hidden="true" />
          {stats.done} Done
        </span>
        <span className="demo-pill demo-pill--amber">
          <span className="demo-pill__dot" style={{ background: 'var(--color-amber)' }} aria-hidden="true" />
          {stats.late} Late
        </span>
        <span className="demo-pill demo-pill--red">
          <span className="demo-pill__dot" style={{ background: 'var(--color-red)' }} aria-hidden="true" />
          {stats.missed} Missed
        </span>
      </div>

      {/* Timeline cards */}
      <div className="demo-tl__list">
        <div className="demo-tl__line" aria-hidden="true" />
        {meds.map((med) => {
          const cfg = STATUS_CONFIG[med.status]
          const opacity = med.status === 'done' ? 0.55 : med.status === 'late' ? 0.6 : 1
          const isExpanded = expandedCard === med.id
          return (
            <div key={med.id} className="demo-tl__item" style={{ opacity }}>
              <div
                className="demo-tl__dot"
                style={{ background: STATUS_TO_BORDER[med.status] }}
                aria-hidden="true"
              />
              <div
                className={`demo-tl__card${isExpanded ? ' demo-tl__card--expanded' : ''}`}
                style={{ borderLeftColor: STATUS_TO_BORDER[med.status] }}
                data-demo-target={`med-${med.id}`}
                onClick={() => onExpandCard(isExpanded ? null : med.id)}
              >
                <div className="demo-tl__card-top">
                  <span className="demo-tl__card-name">{med.name}</span>
                  <span
                    className="demo-tl__card-status"
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {cfg.label}
                  </span>
                </div>
                <div className="demo-tl__card-time">{med.time}</div>
                {isExpanded && (
                  <div className="demo-tl__detail">
                    <div className="demo-tl__detail-row">
                      <span className="demo-tl__detail-label">Dosage</span>
                      <span className="demo-tl__detail-value">{med.dosage}</span>
                    </div>
                    <div className="demo-tl__detail-row">
                      <span className="demo-tl__detail-label">Frequency</span>
                      <span className="demo-tl__detail-value">{med.freq}</span>
                    </div>
                    <div className="demo-tl__detail-row">
                      <span className="demo-tl__detail-label">Supply</span>
                      <span className="demo-tl__detail-value">{med.supply}</span>
                    </div>
                    <div className="demo-tl__actions">
                      {med.status === 'done' ? (
                        <button className="demo-action-btn demo-action-btn--undo" data-demo-target={`action-undo-${med.id}`}>Undo</button>
                      ) : (
                        <>
                          <button className="demo-action-btn demo-action-btn--done" data-demo-target={`action-done-${med.id}`}>Done</button>
                          <button className="demo-action-btn demo-action-btn--late" data-demo-target={`action-late-${med.id}`}>Late</button>
                          <button className="demo-action-btn demo-action-btn--skip" data-demo-target={`action-skip-${med.id}`}>Skip</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MedsScreen
// ---------------------------------------------------------------------------
function supplyColor(pills: number, total: number) {
  const pct = total > 0 ? (pills / total) * 100 : 0
  if (pct > 50) return 'var(--color-green)'
  if (pct > 20) return 'var(--color-amber)'
  return 'var(--color-red)'
}

function MedsScreen({ meds, detailMed, onOpenDetail, onCloseDetail }: {
  meds: MockMed[]
  detailMed: number | null
  onOpenDetail: (id: number) => void
  onCloseDetail: () => void
}) {
  const detail = detailMed !== null ? meds.find(m => m.id === detailMed) : null

  if (detail) {
    const supPct = detail.totalPills > 0 ? Math.round((detail.pills / detail.totalPills) * 100) : 0
    const sc = supplyColor(detail.pills, detail.totalPills)
    return (
      <div className="demo-screen demo-screen--meds demo-med-detail" data-testid="med-detail-panel">
        {/* Header — name + close */}
        <div className="demo-med-detail__header">
          <span className="demo-med-detail__title">{detail.name}</span>
          <span className="demo-med-detail__close" data-demo-target="med-detail-back" onClick={onCloseDetail}>✕</span>
        </div>

        {/* Dosage */}
        <div className="demo-detail-dosage">{detail.dosage}</div>

        {/* Info rows — label / value pairs */}
        <div className="demo-detail-rows">
          <div className="demo-detail-row">
            <span className="demo-detail-row__label">Schedule</span>
            <span className="demo-detail-row__value">{detail.times.join(', ')}</span>
          </div>
          <div className="demo-detail-row">
            <span className="demo-detail-row__label">Frequency</span>
            <span className="demo-detail-row__value">{detail.freq}</span>
          </div>
          <div className="demo-detail-row">
            <span className="demo-detail-row__label">Supply</span>
            <span className="demo-detail-row__value">
              {detail.pills} of {detail.totalPills} pills · {detail.daysLeft} days left
              {detail.daysLeft <= 5 && <span className="demo-detail-refill"> — Refill soon</span>}
            </span>
          </div>
          <div className="demo-detail-row">
            <span className="demo-detail-row__label">Instructions</span>
            <span className="demo-detail-row__value">{detail.instructions}</span>
          </div>
        </div>

        {/* Side Effects */}
        <div className="demo-detail-section">
          <div className="demo-detail-section__head">
            <span className="demo-detail-section__title">Side Effects</span>
            <span className="demo-detail-section__action">+ Log</span>
          </div>
          <div className="demo-detail-section__empty">No side effects logged for this medication.</div>
        </div>

        {/* Supply bar */}
        <div className="demo-supply-bar-section">
          <div className="demo-supply-track">
            <div className="demo-supply-fill" style={{ width: `${supPct}%`, background: sc }} />
          </div>
          <div className="demo-supply-meta">
            <span>Supply remaining</span>
            <span>{supPct}%</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="demo-detail-actions">
          <button className="demo-detail-btn demo-detail-btn--edit">✎ Edit</button>
          <button className="demo-detail-btn demo-detail-btn--discontinue">Discontinue</button>
        </div>
        <button className="demo-detail-delete">Delete permanently</button>
      </div>
    )
  }

  return (
    <div className="demo-screen demo-screen--meds">
      <div className="demo-screen__title demo-screen__title--underline">Medications</div>

      {/* Active / Archived tabs */}
      <div className="demo-med-tabs">
        <button className="demo-med-tab demo-med-tab--active">Active</button>
        <button className="demo-med-tab">Archived</button>
      </div>

      {/* Medication cards */}
      {meds.map((med) => {
        const pct = med.totalPills > 0 ? (med.pills / med.totalPills) * 100 : 0
        const sc = supplyColor(med.pills, med.totalPills)
        return (
          <div key={med.id} className="demo-med-card" data-demo-target={`medlist-${med.id}`} onClick={() => onOpenDetail(med.id)}>
            {/* Row 1: name + dosage badge */}
            <div className="demo-med-card__top">
              <span className="demo-med-card__name">{med.name}</span>
              <span className="demo-med-card__dose">{med.dosage}</span>
            </div>
            {/* Row 2: time + frequency with icons */}
            <div className="demo-med-card__meta">
              <span className="demo-med-card__meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {med.times.join(', ')}
              </span>
              <span className="demo-med-card__meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                {med.freq}
              </span>
            </div>
            {/* Supply progress bar */}
            <div className="demo-med-card__bar">
              <div className="demo-med-card__bar-fill" style={{ width: `${pct}%`, background: sc }} />
            </div>
            {/* Supply text */}
            <div className="demo-med-card__supply">
              <span className="demo-med-card__pills">
                {med.pills} pills left
                {med.daysLeft <= 5 && <span className="demo-med-card__pulse" />}
              </span>
              <span className={med.daysLeft <= 5 ? 'demo-med-card__days demo-med-card__days--warn' : 'demo-med-card__days'}>
                {med.daysLeft} days{med.daysLeft <= 5 ? ' — Refill soon' : ''}
              </span>
            </div>
          </div>
        )
      })}

      <div className="demo-med-add">+ Add Medication</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HealthScreen
// ---------------------------------------------------------------------------
const HEALTH_CARDS = [
  { title: 'Blood Pressure', value: '128', unit: '/ 82 mmHg', trend: '↓ 4 from last week', trendClass: 'demo-trend--down' },
  { title: 'Heart Rate', value: '72', unit: 'bpm', trend: '— Stable', trendClass: 'demo-trend--stable' },
  { title: 'Weight', value: '174', unit: 'lbs', trend: '↓ 2 lbs this month', trendClass: 'demo-trend--down' },
  { title: 'Weekly Adherence', value: '82%', unit: '', trend: '↑ 5% from last week', trendClass: 'demo-trend--up' },
]

function HealthScreen() {
  return (
    <div className="demo-screen demo-screen--health">
      <div className="demo-screen__title">Health</div>
      <div className="demo-screen__subtitle">Vitals and trends</div>
      {HEALTH_CARDS.map((card) => (
        <div key={card.title} className="demo-health-card">
          <div className="demo-health-card__title">{card.title}</div>
          <div>
            <span className="demo-health-card__value">{card.value}</span>
            {card.unit && <span className="demo-health-card__unit"> {card.unit}</span>}
          </div>
          <div className={`demo-health-card__trend ${card.trendClass}`}>{card.trend}</div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ApptsScreen
// ---------------------------------------------------------------------------
function ApptsScreen() {
  return (
    <div className="demo-screen demo-screen--appts">
      <div className="demo-screen__title">Appointments</div>
      <div className="demo-screen__subtitle">Upcoming and past visits</div>
      <div className="demo-appt-month">March 2026</div>
      <div className="demo-appt-card">
        <div className="demo-appt-card__title">Dr. Patel — Cardiology</div>
        <div className="demo-appt-card__meta">Mar 22, 2026 · 10:00 AM · Kaiser SF</div>
        <span className="demo-appt-badge demo-appt-badge--upcoming">Upcoming</span>
      </div>
      <div className="demo-appt-card">
        <div className="demo-appt-card__title">Lab Work — Bloodwork</div>
        <div className="demo-appt-card__meta">Mar 28, 2026 · 8:30 AM · Quest Diagnostics</div>
        <span className="demo-appt-badge demo-appt-badge--upcoming">Upcoming</span>
      </div>
      <div className="demo-appt-month">February 2026</div>
      <div className="demo-appt-card">
        <div className="demo-appt-card__title">Dr. Lee — Primary Care</div>
        <div className="demo-appt-card__meta">Feb 15, 2026 · 2:00 PM · One Medical</div>
        <span className="demo-appt-badge demo-appt-badge--completed">Completed</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CareScreen
// ---------------------------------------------------------------------------
const CARE_CONTACTS = [
  { initials: 'SP', name: 'Dr. Sanjay Patel', role: 'Cardiologist · Kaiser SF', color: 'var(--color-accent)', status: 'Active' },
  { initials: 'MR', name: 'Maria Reyes', role: 'Caregiver · Family', color: 'var(--color-green)', status: 'Active' },
  { initials: 'JL', name: 'Dr. Jenny Lee', role: 'Primary Care · One Medical', color: 'var(--color-amber)', status: 'Active' },
  { initials: 'TW', name: 'Tom Wilson', role: 'Emergency Contact', color: 'var(--color-text-tertiary)', status: 'Pending' },
]

function CareScreen() {
  return (
    <div className="demo-screen demo-screen--care">
      <div className="demo-screen__title">Care Network</div>
      <div className="demo-screen__subtitle">People connected to your care</div>
      {CARE_CONTACTS.map((contact) => (
        <div key={contact.initials} className="demo-care-person">
          <div className="demo-care-avatar" style={{ background: contact.color }}>{contact.initials}</div>
          <div className="demo-care-info">
            <div className="demo-care-name">{contact.name}</div>
            <div className="demo-care-role">{contact.role}</div>
          </div>
          <span className={`demo-care-status demo-care-status--${contact.status.toLowerCase()}`}>
            {contact.status}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DemoCaption
// ---------------------------------------------------------------------------
function DemoCaption({ text }: { text: string }) {
  return (
    <p className={`demo-caption${text ? ' demo-caption--visible' : ''}`} aria-live="polite">
      {text}
    </p>
  )
}

// ---------------------------------------------------------------------------
// PhoneDemo — main exported component
// ---------------------------------------------------------------------------
export function PhoneDemo() {
  const phoneRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [userTookOver, setUserTookOver] = useState(false)

  const demo = useDemoSequencer(phoneRef)
  const reducedMotion = prefersReducedMotion()

  // Manual tab change — pause demo if running
  const handleTabChange = useCallback((tab: TabId) => {
    if (demo.isRunning) {
      demo.pause()
      setUserTookOver(true)
    }
    demo.setExpandedCard(null)
    demo.setDetailMed(null)
    demo.setActiveTab(tab)
  }, [demo])

  // Pause demo on any pointer interaction inside the phone
  const handlePhonePointerDown = useCallback(() => {
    if (demo.isRunning && !demo.isPaused) {
      demo.pause()
      setUserTookOver(true)
    }
  }, [demo])

  // IntersectionObserver: auto-start demo when phone enters viewport
  useEffect(() => {
    if (reducedMotion) return // respect reduced motion — no auto-demo
    const el = phoneRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !demo.isRunning && !userTookOver) {
          demo.runDemo()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [reducedMotion, demo, userTookOver])

  // Scroll content to top on tab switch
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [demo.activeTab])

  // Replay button handler
  const handleReplay = useCallback(() => {
    setUserTookOver(false)
    demo.restart()
  }, [demo])

  // Status badge text
  const statusText = demo.isRunning && !demo.isPaused
    ? 'Auto-demo playing'
    : demo.isPaused
    ? 'Paused — you\'re in control'
    : 'Interactive preview'

  const statusClass = demo.isPaused ? 'demo-status demo-status--paused' : 'demo-status'

  return (
    <section
      id="preview"
      className="landing-section"
      aria-labelledby="preview-heading"
    >
      <h2 id="preview-heading" className="landing-section__heading">See It in Action</h2>
      <p className="demo-subtitle">Watch it work — or tap to take over</p>

      <div className="demo-wrapper">
        <div className="demo-controls">
          <div className={statusClass} data-testid="demo-status">
            {statusText}
          </div>
          {(demo.isPaused || (!demo.isRunning && userTookOver)) && (
            <button
              type="button"
              className="demo-replay-btn"
              onClick={handleReplay}
              aria-label="Replay demo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Replay
            </button>
          )}
        </div>

        <div
          ref={phoneRef}
          className="demo-phone"
          role="img"
          aria-label="MarinLoop app preview showing a daily medication timeline with adherence tracking, five sample medications in various statuses, and bottom navigation tabs"
          onPointerDown={handlePhonePointerDown}
        >
          <GhostCursor state={demo.cursor} />
          <ClickRipple state={demo.cursor} />
          <ToastNotification message={demo.toast} />
          <PhoneHeader />

          <div className="demo-phone__content" ref={contentRef}>
            {demo.activeTab === 'timeline' && <TimelineScreen meds={demo.meds} expandedCard={demo.expandedCard} onExpandCard={demo.setExpandedCard} />}
            {demo.activeTab === 'meds' && <MedsScreen meds={demo.meds} detailMed={demo.detailMed} onOpenDetail={demo.setDetailMed} onCloseDetail={() => demo.setDetailMed(null)} />}
            {demo.activeTab === 'health' && <HealthScreen />}
            {demo.activeTab === 'appts' && <ApptsScreen />}
            {demo.activeTab === 'care' && <CareScreen />}
          </div>

          {/* Voice FAB mock */}
          <div className="demo-fab" aria-hidden="true">
            <MicIcon size={20} strokeWidth={2.5} aria-hidden="true" />
          </div>

          <PhoneTabBar activeTab={demo.activeTab} onTabChange={handleTabChange} />
        </div>

        <DemoCaption text={demo.caption} />
      </div>
    </section>
  )
}
