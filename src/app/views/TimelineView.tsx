import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toLocalDateString } from '@/shared/lib/dates'

import { useAppStore, fT, type SchedItem } from '@/shared/stores/app-store'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useDoseLogs } from '@/shared/hooks/useDoseLogs'
import { getCatchUpGuidance } from '@/shared/services/rxnorm'
import { supabase } from '@/shared/lib/supabase'

import { Modal } from '@/shared/components/Modal'
import { Pill, Button } from '@/shared/components/ui'

const CIRC = 2 * Math.PI * 46

// ─── Skeleton ───────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4" aria-busy="true" aria-label="Loading today's schedule">
      {/* Adherence ring skeleton */}
      <div className="flex justify-center py-4">
        <div
          className="w-28 h-28 rounded-full animate-pulse"
          style={{ background: 'var(--color-skeleton)' }}
        />
      </div>
      {/* Status pills skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-6 w-20 rounded-full animate-pulse"
            style={{ background: 'var(--color-skeleton)' }}
          />
        ))}
      </div>
      {/* Timeline cards skeleton */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 items-start">
          <div
            className="w-12 h-4 rounded animate-pulse mt-1 flex-shrink-0"
            style={{ background: 'var(--color-skeleton)' }}
          />
          <div
            className="flex-1 rounded-xl p-4 animate-pulse"
            style={{
              border: '1px solid var(--color-border-primary)',
              background: 'var(--color-skeleton)',
            }}
          >
            <div
              className="h-4 w-1/2 rounded mb-2"
              style={{ background: 'var(--color-bg-tertiary)' }}
            />
            <div
              className="h-3 w-1/3 rounded"
              style={{ background: 'var(--color-bg-tertiary)' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        className="mb-4 opacity-60"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M12 8v8M8 12h8" />
      </svg>
      <p className="font-semibold text-lg mb-1" style={{ color: 'var(--color-text-primary)' }}>
        No doses today
      </p>
      <p
        className="text-sm mb-4 max-w-xs"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Add a medication with a schedule to start tracking your adherence.
      </p>
      <button
        onClick={() => navigate('/meds')}
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{
          background: 'var(--color-accent)',
          color: 'var(--color-text-inverse)',
        }}
      >
        Add medication
      </button>
    </div>
  )
}

// ─── Error State ─────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-red)"
        strokeWidth="1.5"
        className="mb-3"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        Couldn't load your schedule
      </p>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        Check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-primary)',
        }}
      >
        Retry
      </button>
    </div>
  )
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function TimelineView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date')
  const validDateParam = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined
  const todayStr = toLocalDateString(new Date())
  const targetDate = validDateParam ?? todayStr
  const isToday = targetDate === todayStr
  const displayDate = new Date(targetDate + 'T12:00:00')

  const goToDate = (offset: number) => {
    const d = new Date(targetDate + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    const newDate = toLocalDateString(d)
    if (newDate === todayStr) {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ date: newDate }, { replace: true })
    }
  }

  const { timeline: sched, isLoading, error, refetch } = useTimeline(validDateParam)
  const [, setTick] = useState(0)

  // Ref attached to the card for the "next" item
  const nextItemRef = useRef<HTMLButtonElement>(null)
  const [showJumpButton, setShowJumpButton] = useState(false)

  // Refresh timeline data and clock display every minute
  useEffect(() => {
    const iv = setInterval(() => {
      refetch()
      setTick((t) => t + 1)
    }, 60000)
    return () => clearInterval(iv)
  }, [refetch])

  // Track whether the "next" item is in the viewport
  useEffect(() => {
    const el = nextItemRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowJumpButton(!entry.isIntersecting),
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [sched]) // re-run when timeline data loads / changes

  const now = new Date()
  const nM = now.getHours() * 60 + now.getMinutes()

  let dn = 0
  let lt = 0
  let ms = 0
  let total = 0

  sched.forEach((i) => {
    if (i.type !== 'med') return
    total += 1
    if (i.status === 'done') dn += 1
    else if (i.status === 'late') {
      dn += 1
      lt += 1
    } else if (i.status === 'missed') ms += 1
  })

  const pct = total > 0 ? Math.round((dn / total) * 100) : 0
  const ringColor =
    pct >= 80
      ? 'var(--color-ring-green)'
      : pct >= 50
        ? 'var(--color-ring-amber)'
        : 'var(--color-ring-red)'
  const offset = CIRC - (pct / 100) * CIRC

  // Derive accessible status label from adherence percentage
  const statusLabel = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : 'Needs attention'

  return (
    <div className="animate-view-in w-full max-w-[480px] mx-auto">
      {/* ── Date navigation row ── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => goToDate(-1)}
          aria-label="Previous day"
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="flex-1 text-center">
          <span className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-label)]">
            {isToday ? 'Today' : displayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        {!isToday && (
          <button
            type="button"
            onClick={() => setSearchParams({}, { replace: true })}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-none cursor-pointer"
          >
            Today
          </button>
        )}
        <button
          type="button"
          onClick={() => goToDate(1)}
          aria-label="Next day"
          disabled={isToday}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* ── Header row: date + pills + adherence ring ── */}
      <div className="flex items-stretch justify-between gap-3 mb-6">
        <div className="shrink-0">
          <div className="font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)] text-lg sm:[font-size:var(--text-title)]">
            {displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          <div className="text-[var(--color-text-secondary)] font-medium text-base sm:[font-size:var(--text-label)]">
            {displayDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
          {isToday && (
            <div className="text-[var(--color-text-tertiary)] [font-family:var(--font-mono)] [font-size:var(--text-caption)] mt-0.5">
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">
          {sched.length === 0 && !isLoading ? (
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

        {/* Adherence ring — accessible SVG */}
        <div className="shrink-0 text-center">
          <svg
            width="120"
            height="120"
            viewBox="0 0 100 100"
            className="-rotate-90"
            role="img"
            aria-label={`Adherence: ${pct}% — ${statusLabel}`}
          >
            <title>{pct}% adherence today — {statusLabel}</title>
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="var(--color-ring-track)"
              strokeWidth="6"
            />
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
          <div className="font-extrabold tracking-[-0.03em] -mt-[82px] relative z-[1] text-[var(--color-text-primary)] text-xl sm:[font-size:var(--text-subtitle)]">
            {pct}%
          </div>
          <div className="text-[var(--color-text-tertiary)] font-medium mt-0.5 [font-size:var(--text-caption)]">
            Adherence
          </div>
        </div>
      </div>

      {/* ── Body: skeleton / error / empty / timeline list ── */}
      {isLoading ? (
        <TimelineSkeleton />
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : sched.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="relative pl-6"
          role="feed"
          aria-label={isToday ? "Today's medication schedule" : `Schedule for ${displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          aria-busy={isLoading}
        >
          <div
            className="absolute left-1 top-3 bottom-3 w-[2px] rounded-full bg-gradient-to-b from-[var(--color-border-primary)] to-transparent"
            aria-hidden="true"
          />
          <div className="stagger-children">
            {sched.map((it) => (
              <TimelineItem
                key={it.id}
                item={it}
                nowMin={nM}
                nextItemRef={it.isNext ? nextItemRef : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Jump-to-Now floating button ── */}
      {isToday && showJumpButton && !isLoading && !error && sched.length > 0 && (
        <button
          onClick={() =>
            nextItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          className="fixed bottom-[calc(160px+env(safe-area-inset-bottom))] right-[max(4.5rem,calc(env(safe-area-inset-right)+4.5rem))] z-50 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium shadow-lg transition-all duration-200 animate-fade-in"
          style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
          aria-label="Jump to current dose"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Now
        </button>
      )}
    </div>
  )
}

// ─── Timeline Item ────────────────────────────────────────────────────────────

function TimelineItem({
  item: it,
  nowMin,
  nextItemRef,
}: {
  item: SchedItem
  nowMin: number
  nextItemRef?: React.RefObject<HTMLButtonElement | null>
}) {
  const { toast } = useAppStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  let bg = 'var(--color-bg-secondary)'
  let dotColor = 'var(--color-text-tertiary)'
  let dotRadius = '50%'
  let tag: React.ReactNode = null
  let opacity = 1

  if (it.type === 'med') {
    if (it.status === 'done') {
      dotColor = 'var(--color-green)'
      opacity = 0.55
      tag = (
        <Tag
          bg="var(--color-green-bg)"
          color="var(--color-green)"
          border="var(--color-green-border)"
          label="Done"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          }
        />
      )
    } else if (it.status === 'late') {
      dotColor = 'var(--color-amber)'
      opacity = 0.6
      tag = (
        <Tag
          bg="var(--color-amber-bg)"
          color="var(--color-amber)"
          border="var(--color-amber-border)"
          label="Late"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
          }
        />
      )
    } else if (it.status === 'missed') {
      dotColor = 'var(--color-red)'
      bg = 'var(--color-red-bg)'
      tag = (
        <Tag
          bg="var(--color-red-bg)"
          color="var(--color-red)"
          border="var(--color-red-border)"
          label="Missed"
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          }
        />
      )
    } else if (it.isNext) {
      dotColor = 'var(--color-amber)'
      bg = 'var(--color-amber-bg)'
      tag = (
        <Tag
          bg="var(--color-amber-bg)"
          color="var(--color-amber)"
          border="var(--color-amber-border)"
          label="Next"
        />
      )
    }
  } else if (it.type === 'food') {
    dotColor = 'var(--color-amber)'
    bg = 'var(--color-amber-bg)'
    dotRadius = '1px'
    tag = (
      <Tag
        bg="var(--color-amber-bg)"
        color="var(--color-amber)"
        border="var(--color-amber-border)"
        label="Food"
        dashed
      />
    )
  } else if (it.type === 'appt') {
    dotColor = 'var(--color-text-primary)'
    dotRadius = '2px'
    tag = (
      <Tag
        bg="var(--color-bg-tertiary)"
        color="var(--color-text-secondary)"
        border="var(--color-border-primary)"
        label="Appt"
      />
    )
  }

  const borderLeft =
    it.status === 'done'
      ? '3px solid var(--color-green)'
      : it.status === 'late'
        ? '3px solid var(--color-amber)'
        : it.status === 'missed'
          ? '3px solid var(--color-red)'
          : it.isNext
            ? '3px solid var(--color-amber)'
            : it.type === 'food'
              ? '3px dashed var(--color-amber-border)'
              : it.type === 'appt'
                ? '3px solid var(--color-text-primary)'
                : 'none'

  const handleClick = () => {
    if (it.type === 'med' && (it.status === 'pending' || it.isNext)) setOpen(true)
    else if (it.type === 'appt') navigate('/appts')
    else if (it.status === 'done' || it.status === 'late')
      toast(`${it.name} - already confirmed`, 'ts')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  // Build a comprehensive aria-label: "{name}, {dosage}, scheduled at {time}, status: {status}"
  const statusText =
    it.type === 'med' && it.status
      ? it.isNext && it.status === 'pending'
        ? 'next dose'
        : it.status
      : it.type === 'appt'
        ? 'appointment'
        : it.type === 'food'
          ? 'food window'
          : ''
  const dosagePart = it.dose ? `, ${it.dose}` : ''
  const ariaLabel = `${it.name}${dosagePart}, scheduled at ${fT(it.time)}, status: ${statusText}`

  // Merge the nextItemRef onto the same ref as triggerRef when this is the "next" item
  const setRefs = (el: HTMLButtonElement | null) => {
    ;(triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
    if (nextItemRef) {
      ;(nextItemRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
    }
  }

  return (
    <>
      <button
        type="button"
        ref={setRefs}
        role="article"
        className="animate-slide-r card-interactive relative mb-3 min-h-[64px] py-5 px-5 w-full text-left rounded-xl cursor-pointer border border-[var(--color-border-secondary)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        style={{ background: bg, borderLeft, opacity }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label={ariaLabel}
      >
        <div
          className="absolute -left-6 top-6 w-[10px] h-[10px] border-2 border-[var(--color-bg-primary)] z-[1]"
          style={{ background: dotColor, borderRadius: dotRadius }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-4">
          <span className="text-[var(--color-text-secondary)] font-bold min-w-[64px] pt-0.5 [font-family:var(--font-mono)] [font-size:var(--text-caption)]">
            {fT(it.time)}
          </span>
          <div className="flex-1 min-w-0 max-w-[60ch]">
            <div className="font-bold mb-1 truncate text-[var(--color-text-primary)] [font-size:var(--text-body)]">
              {it.name}
            </div>
            <div className="text-[var(--color-text-secondary)] truncate [font-size:var(--text-label)]">
              {it.instructions || ''}
            </div>
          </div>
          {tag}
        </div>
      </button>
      {open && (
        <DoseModal item={it} onClose={() => setOpen(false)} nowMin={nowMin} triggerRef={triggerRef} />
      )}
    </>
  )
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

function Tag({
  bg,
  color,
  border,
  label,
  dashed,
  icon,
}: {
  bg: string
  color: string
  border: string
  label: string
  dashed?: boolean
  icon?: React.ReactNode
}) {
  return (
    <span
      className="font-bold py-1.5 px-3 rounded-lg whitespace-nowrap shrink-0 self-start inline-flex items-center gap-2 [font-size:var(--text-caption)]"
      style={{ background: bg, color, border: `1px ${dashed ? 'dashed' : 'solid'} ${border}` }}
    >
      {icon}
      {label}
    </span>
  )
}

// ─── Dose Modal ───────────────────────────────────────────────────────────────

function DoseModal({
  item: it,
  onClose,
  nowMin,
  triggerRef,
}: {
  item: SchedItem
  onClose: () => void
  nowMin: number
  triggerRef?: React.RefObject<HTMLElement | null>
}) {
  const { logDose } = useDoseLogs()
  const minutesLate = nowMin - it.timeMinutes
  const hoursLate = minutesLate / 60

  // Fetch rxcui for this medication (needed for OpenFDA catch-up guidance)
  const { data: rxcui } = useQuery({
    queryKey: ['med-rxcui', it.medicationId],
    queryFn: async () => {
      if (!it.medicationId) return null
      const { data } = await supabase.from('medications').select('rxcui').eq('id', it.medicationId).single()
      return data?.rxcui ?? null
    },
    enabled: !!it.medicationId && minutesLate > 30,
    staleTime: 60 * 60 * 1000,
  })

  // Fetch OpenFDA catch-up guidance when late
  const { data: fdaGuidance } = useQuery({
    queryKey: ['catchup', rxcui],
    queryFn: () => getCatchUpGuidance(rxcui!),
    enabled: !!rxcui && minutesLate > 30,
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  // Standard catch-up guidance based on elapsed time
  const catchUpGuidance = (() => {
    if (minutesLate < 30) return null
    if (fdaGuidance) return fdaGuidance
    // Standard rule of thumb (not medical advice):
    if (hoursLate < 4) return `You're ${Math.round(hoursLate * 10) / 10}h late. Generally safe to take now, but check with your pharmacist if unsure.`
    if (hoursLate < 8) return `You're ${Math.round(hoursLate)}h late. For many medications you can still take it — skip only if your next dose is soon.`
    return `You're ${Math.round(hoursLate)}h late. Consider skipping this dose and resuming your normal schedule. Ask your pharmacist to be sure.`
  })()

  const markDone = () => {
    if (!it.medicationId) return
    const late = nowMin > it.timeMinutes + 15
    logDose({
      medication_id: it.medicationId,
      schedule_id: it.id,
      taken_at: new Date().toISOString(),
      status: late ? 'late' : 'taken',
      notes: null,
    })
  }

  const markMissed = () => {
    if (!it.medicationId) return
    logDose({
      medication_id: it.medicationId,
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
      variant="responsive"
      triggerRef={triggerRef}
    >
      <div className="text-[var(--color-text-tertiary)] mb-1 [font-family:var(--font-mono)] [font-size:var(--text-caption)]">
        {fT(it.time)}
      </div>
      <div className="font-extrabold tracking-[-0.02em] mb-1 text-[var(--color-text-primary)] [font-size:var(--text-subtitle)]">
        {it.name} {it.dose || ''}
      </div>
      <div className="text-[var(--color-text-secondary)] mb-4 [font-size:var(--text-body)]">
        {it.instructions || ''}
      </div>

      {/* Catch-up guidance for late/missed doses */}
      {catchUpGuidance && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[color-mix(in_srgb,var(--color-amber,#d97706)_8%,transparent)] border border-[color-mix(in_srgb,var(--color-amber,#d97706)_25%,transparent)]" role="note">
          <p className="font-bold text-[#d97706] [font-size:var(--text-label)] mb-0.5">Catch-up Guidance</p>
          <p className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)] leading-relaxed">
            {catchUpGuidance}
          </p>
          <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mt-1">
            Always follow your healthcare provider's instructions.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="primary"
          size="md"
          className="!bg-[var(--color-green)]"
          onClick={() => {
            markDone()
            onClose()
          }}
        >
          Mark Done
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[var(--color-red)] font-semibold"
          onClick={() => {
            markMissed()
            onClose()
          }}
        >
          Mark as Missed
        </Button>
      </div>
    </Modal>
  )
}
