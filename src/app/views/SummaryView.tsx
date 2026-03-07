import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useAppStore } from '@/shared/stores/app-store'
import { toLocalDateString } from '@/shared/lib/dates'
import { useTimeline } from '@/shared/hooks/useTimeline'
import { useNotes } from '@/shared/hooks/useNotes'
import { useMedications } from '@/shared/hooks/useMedications'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { useRefillPredictions } from '@/shared/hooks/useRefillPredictions'
import { useStreak } from '@/shared/hooks/useStreak'
import { useAdherenceInsights } from '@/shared/hooks/useAdherenceInsights'
import { useVitals } from '@/shared/hooks/useVitals'
import { useJournal } from '@/shared/hooks/useJournal'
import { getMissPatterns } from '@/shared/services/schedule-analysis'
import type { Vital } from '@/shared/services/vitals'
import type { JournalEntry } from '@/shared/services/journal'
import { Card, Button } from '@/shared/components/ui'
import { QuickCaptureModal } from '@/shared/components/QuickCaptureModal'
import { ConfirmDeleteModal } from '@/shared/components/ConfirmDeleteModal'
import { VitalEntryModal } from '@/app/components/VitalEntryModal'
import { JournalEntryModal } from '@/app/components/JournalEntryModal'
import {
  SkeletonStatCard,
  SkeletonChartBar,
  SkeletonNoteRow,
} from '@/shared/components/Skeleton'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISSED_KEY = 'marinloop-dismissed-insights'

type HealthTab = 'adherence' | 'vitals' | 'journal'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SummaryView() {
  const {
    showQuickCaptureModal,
    openQuickCaptureModal,
    closeQuickCaptureModal,
    openRemindersPanel,
  } = useAppStore()

  // Sub-tab state
  const [activeHealthTab, setActiveHealthTab] = useState<HealthTab>('adherence')

  // --- Adherence data ---
  const { adherence: adh30 } = useAdherenceHistory(30)
  const { timeline } = useTimeline()
  const { notes: realNotes, isLoading: notesLoading, addNote: addNoteReal, isAdding, updateNote, deleteNote, isDeleting } = useNotes()
  const { meds: realMeds } = useMedications()
  const { appts: realAppts } = useAppointments()

  // --- Phase 2 hooks ---
  const { predictions, isLoading: refillLoading } = useRefillPredictions()
  const { currentStreak, longestStreak, isLoading: streakLoading } = useStreak()
  const { insights, isLoading: insightsLoading } = useAdherenceInsights()

  // --- Vitals ---
  const { vitals, isLoading: vitalsLoading, addVital, isAdding: vitalsAdding } = useVitals()

  // --- Journal ---
  const { entries, isLoading: journalLoading, addEntry, isAdding: journalAdding } = useJournal()

  const { data: missPatterns = [] } = useQuery({
    queryKey: ['miss-patterns'],
    queryFn: () => getMissPatterns(28),
    staleTime: 60 * 60 * 1000, // 1 hour
  })

  // --- Modal state ---
  const [showVitalModal, setShowVitalModal] = useState(false)
  const [showJournalModal, setShowJournalModal] = useState(false)
  const [moodFilter, setMoodFilter] = useState<number | null>(null)

  // Dismissed insight card IDs
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getDismissed())

  const dismissInsight = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }

  const visibleInsights = useMemo(
    () => insights.filter((ins) => !dismissedIds.has(ins.id)),
    [insights, dismissedIds],
  )

  // Refill alerts: only critical (<=3) and warning (<=7)
  const alertPredictions = useMemo(
    () => predictions.filter((p) => p.severity === 'critical' || p.severity === 'warning'),
    [predictions],
  )

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const [deleteNoteName, setDeleteNoteName] = useState('')

  const meds = realMeds.map((m) => ({ id: m.id, name: m.name }))
  const appts = realAppts.map((a) => ({ id: a.id, title: a.title, start_time: a.start_time }))

  const sched = timeline

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

  const notes = realNotes.map((n) => ({
    id: n.id,
    title: n.medication_id ? (realMeds.find((m) => m.id === n.medication_id)?.name ?? 'Note') : 'Note',
    text: n.content,
    created: n.created_at,
  }))

  // 30-day chart data for Recharts
  const adherenceChartData = useMemo(() => {
    const result = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = toLocalDateString(d)
      const entry = adh30[key]
      const pct = entry && entry.t > 0 ? Math.round((entry.d / entry.t) * 100) : null
      result.push({
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        pct,
      })
    }
    return result
  }, [adh30])

  return (
    <div className="animate-view-in w-full max-w-[480px] mx-auto">
      <h2 className="font-extrabold tracking-[-0.02em] mb-5 pb-3 border-b-2 border-[var(--color-text-primary)] text-[var(--color-text-primary)] text-xl sm:[font-size:var(--text-title)]">
        Health
      </h2>

      {/* Sub-tab switcher */}
      <div className="flex gap-1 p-1 mb-6 rounded-xl bg-[var(--color-bg-secondary)]" role="tablist">
        {(['adherence', 'vitals', 'journal'] as HealthTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeHealthTab === tab}
            onClick={() => setActiveHealthTab(tab)}
            className={`flex-1 py-2.5 px-3 rounded-lg font-semibold capitalize transition-all [font-size:var(--text-caption)] ${
              activeHealthTab === tab
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-sm'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {tab === 'adherence' ? 'Adherence' : tab === 'vitals' ? 'Vitals' : 'Journal'}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ADHERENCE TAB                                                       */}
      {/* ------------------------------------------------------------------ */}
      {activeHealthTab === 'adherence' && (
        <div>
          {/* Today's stat cards */}
          <div
            className="grid grid-cols-3 gap-4 mb-6"
            {...(notesLoading ? { role: 'status' as const, 'aria-live': 'polite' as const, 'aria-label': "Loading today's statistics" } : {})}
          >
            {notesLoading ? (
              <>
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
              </>
            ) : (
              <>
                <StatCard n={dn} label="Completed" color="var(--color-green)" />
                <StatCard n={lt} label="Late" color="var(--color-amber)" />
                <StatCard n={ms} label="Missed" color="var(--color-red)" />
              </>
            )}
          </div>

          {/* A. Refill Alert Cards */}
          {!refillLoading && alertPredictions.length > 0 && (
            <div className="mb-5 flex flex-col gap-2">
              {alertPredictions.map((p) => {
                const isCritical = p.severity === 'critical'
                const borderColor = isCritical ? 'var(--color-red)' : 'var(--color-amber)'
                const textColor = isCritical ? 'var(--color-red)' : 'var(--color-amber)'
                const bgColor = isCritical
                  ? 'color-mix(in srgb, var(--color-red) 6%, var(--color-bg-secondary))'
                  : 'color-mix(in srgb, var(--color-amber) 6%, var(--color-bg-secondary))'
                return (
                  <div
                    key={p.medId}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 text-sm font-semibold"
                    style={{ borderLeftColor: borderColor, background: bgColor, color: textColor }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      Refill {p.medName} · {p.daysLeft} day{p.daysLeft === 1 ? '' : 's'} left
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* B. Streak Card */}
          {streakLoading ? (
            <div role="status" aria-live="polite" aria-label="Loading streak" className="mb-5 h-[88px] rounded-2xl bg-[var(--color-bg-secondary)] animate-pulse" />
          ) : (
            <Card className="mb-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <div
                    className="font-extrabold tracking-[-0.03em] [font-size:var(--text-subtitle)]"
                    style={{
                      color:
                        currentStreak > 7
                          ? 'var(--color-green)'
                          : currentStreak >= 1
                            ? 'var(--color-amber)'
                            : 'var(--color-text-tertiary)',
                    }}
                  >
                    {currentStreak}
                  </div>
                  <div className="font-semibold text-[var(--color-text-secondary)] mt-1 [font-size:var(--text-caption)]">
                    Current streak
                  </div>
                </div>
                <div className="w-px h-10 bg-[var(--color-border-secondary)] shrink-0" />
                <div className="flex-1 text-center">
                  <div className="font-extrabold tracking-[-0.03em] [font-size:var(--text-subtitle)] text-[var(--color-text-primary)]">
                    {longestStreak}
                  </div>
                  <div className="font-semibold text-[var(--color-text-secondary)] mt-1 [font-size:var(--text-caption)]">
                    Best streak
                  </div>
                </div>
              </div>
              {currentStreak === 0 && (
                <p className="mt-3 text-center text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] font-medium">
                  Start your streak today — take all your doses!
                </p>
              )}
            </Card>
          )}

          {/* C. AI Adherence Insights */}
          {insightsLoading ? (
            <div role="status" aria-live="polite" aria-label="Loading health insights" className="mb-5 flex flex-col gap-3">
              <div className="h-[64px] rounded-xl bg-[var(--color-bg-secondary)] animate-pulse" />
              <div className="h-[64px] rounded-xl bg-[var(--color-bg-secondary)] animate-pulse" />
            </div>
          ) : visibleInsights.length > 0 ? (
            <div className="mb-5 flex flex-col gap-3">
              {visibleInsights.slice(0, 3).map((ins) => (
                <Card key={ins.id} className="relative pr-10">
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5 shrink-0" aria-hidden>
                      {ins.type === 'pattern' ? '📊' : ins.type === 'praise' ? '⭐' : '💡'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-body)]">
                        {ins.title}
                      </div>
                      <div className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)] mt-1 leading-snug">
                        {ins.body}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissInsight(ins.id)}
                    aria-label={`Dismiss insight: ${ins.title}`}
                    className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </Card>
              ))}
            </div>
          ) : missPatterns.length > 0 ? (
            /* D. Miss Pattern Cards — shown when AI insights unavailable */
            <div className="mb-5 flex flex-col gap-3">
              {missPatterns.slice(0, 2).map((mp) => (
                <Card key={`${mp.scheduleId}-${mp.dayOfWeek}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5 shrink-0" aria-hidden>💡</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-body)]">
                        Missed dose pattern detected
                      </div>
                      <div className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)] mt-1 leading-snug">
                        You tend to miss {mp.medName} on {mp.dayLabel}s at {mp.scheduledTime} — want to add an earlier reminder?
                      </div>
                      <button
                        type="button"
                        onClick={() => openRemindersPanel()}
                        className="mt-2 text-[var(--color-accent)] [font-size:var(--text-caption)] font-semibold cursor-pointer hover:underline bg-transparent border-none p-0"
                      >
                        Add reminder
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}

          {/* E. 30-Day Adherence Chart (Recharts LineChart) */}
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-label)]">30-Day Adherence</h3>
            </div>
            {notesLoading ? (
              <div role="status" aria-live="polite" aria-label="Loading adherence chart" className="flex items-end gap-3 h-[110px] pb-7 relative">
                {Array.from({ length: 7 }).map((_, i) => <SkeletonChartBar key={i} />)}
              </div>
            ) : (
              <div role="img" aria-label="30-day medication adherence line chart. Shows percentage of doses taken each day over the past 30 days.">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={adherenceChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-secondary)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                      interval={6}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => value != null ? [`${value}%`, 'Adherence'] : ['-', 'Adherence']}
                      contentStyle={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 12, fontSize: 13 }}
                      labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pct"
                      stroke="var(--color-accent)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--color-accent)' }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* F. Notes for your doctor */}
          <Card className="relative">
            <h3 className="font-bold mb-4 text-[var(--color-text-primary)] [font-size:var(--text-label)]">
              Notes for your doctor
            </h3>
            {notesLoading ? (
              <div role="status" aria-live="polite" aria-label="Loading doctor notes">
                <SkeletonNoteRow />
                <SkeletonNoteRow />
                <SkeletonNoteRow />
              </div>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
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
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <line x1="9" y1="12" x2="15" y2="12" />
                  <line x1="9" y1="16" x2="13" y2="16" />
                </svg>
                <div>
                  <p className="text-[var(--color-text-primary)] font-semibold text-lg leading-snug">No notes yet</p>
                  <p className="text-[var(--color-text-secondary)] text-sm mt-1 max-w-xs">
                    Capture observations, questions for your doctor, or anything that matters.
                  </p>
                </div>
              </div>
            ) : (
              notes.slice(0, 8).map((n) => (
                <div key={n.id} className="mb-4 pb-4 border-b border-[var(--color-border-secondary)] last:border-0 last:mb-0 last:pb-0 group">
                  <div className="flex justify-between gap-3 mb-1">
                    <span className="font-semibold text-[var(--color-text-primary)] [font-size:var(--text-body)] shrink-0">{n.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[var(--color-text-tertiary)] [font-family:var(--font-mono)] [font-size:var(--text-caption)]">
                        {new Date(n.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
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
                    </div>
                  </div>

                  {/* Inline edit mode */}
                  {editingNoteId === n.id ? (
                    <div className="mt-1">
                      <textarea
                        value={editingNoteText}
                        onChange={(e) => setEditingNoteText(e.target.value)}
                        className="fi w-full resize-y min-h-[44px] py-2 px-3 [font-size:var(--text-label)]"
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
                          className="py-1.5 px-3 rounded-lg min-h-[44px] text-[var(--color-text-secondary)] [font-size:var(--text-caption)] font-semibold cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-colors"
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
                          className="py-1.5 px-3 rounded-lg min-h-[44px] bg-[var(--color-accent)] text-white [font-size:var(--text-caption)] font-semibold cursor-pointer hover:brightness-110 transition-all"
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
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VITALS TAB                                                          */}
      {/* ------------------------------------------------------------------ */}
      {activeHealthTab === 'vitals' && (
        <div>
          <Button
            variant="primary"
            size="md"
            className="w-full mb-5"
            onClick={() => setShowVitalModal(true)}
          >
            + Log Vitals
          </Button>

          {vitalsLoading ? (
            <div role="status" aria-live="polite" aria-label="Loading vitals" className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-[var(--color-bg-secondary)] animate-pulse" />
              ))}
            </div>
          ) : vitals.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-5xl mb-3">🩺</div>
              <p className="font-semibold text-[var(--color-text-primary)]">No vitals logged yet</p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">Track blood pressure, heart rate, glucose, and more.</p>
            </div>
          ) : (
            <>
              {vitals.length >= 2 && <VitalsTrendChart vitals={vitals} />}
              <div className="flex flex-col gap-3">
                {vitals.slice(0, 20).map((v) => <VitalCard key={v.id} vital={v} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* JOURNAL TAB                                                         */}
      {/* ------------------------------------------------------------------ */}
      {activeHealthTab === 'journal' && (
        <div>
          <Button variant="primary" size="md" className="w-full mb-5" onClick={() => setShowJournalModal(true)}>
            + New Entry
          </Button>

          {/* Mood filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1" role="group" aria-label="Filter by mood">
            <button
              type="button"
              onClick={() => setMoodFilter(null)}
              aria-label="Show all mood entries"
              aria-pressed={moodFilter === null}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${moodFilter === null ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-primary)]'}`}
            >
              All
            </button>
            {([1, 2, 3, 4, 5] as const).map((m) => {
              const emoji = ['😔', '😐', '🙂', '😊', '🤩'][m - 1]
              const moodLabel = ['Very sad', 'Sad', 'Neutral', 'Happy', 'Very happy'][m - 1]
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoodFilter(moodFilter === m ? null : m)}
                  aria-label={`Filter by mood: ${moodLabel}`}
                  aria-pressed={moodFilter === m}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${moodFilter === m ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border-primary)]'}`}
                >
                  {emoji}
                </button>
              )
            })}
          </div>

          {journalLoading ? (
            <div role="status" aria-live="polite" aria-label="Loading journal entries" className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-[var(--color-bg-secondary)] animate-pulse" />
              ))}
            </div>
          ) : (
            (() => {
              const filtered = moodFilter ? entries.filter((e) => e.mood === moodFilter) : entries
              return filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-5xl mb-3">📓</div>
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {moodFilter ? 'No entries with this mood' : 'No journal entries yet'}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    Track your daily health observations.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filtered.slice(0, 20).map((e) => <JournalCard key={e.id} entry={e} />)}
                </div>
              )
            })()
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modals (always rendered so state is preserved across tab switches)  */}
      {/* ------------------------------------------------------------------ */}
      <QuickCaptureModal
        open={showQuickCaptureModal}
        onOpenChange={(open) => { if (!open) closeQuickCaptureModal() }}
        meds={meds}
        appts={appts}
        onSubmit={addNoteReal}
        isSubmitting={isAdding}
      />

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

      <VitalEntryModal
        open={showVitalModal}
        onOpenChange={setShowVitalModal}
        onSubmit={(data) => { addVital(data); setShowVitalModal(false) }}
        isSubmitting={vitalsAdding}
      />

      <JournalEntryModal
        open={showJournalModal}
        onOpenChange={setShowJournalModal}
        onSubmit={(data) => { addEntry(data); setShowJournalModal(false) }}
        isSubmitting={journalAdding}
        meds={meds}
        appts={appts}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <Card className="text-center p-5">
      <div className="font-extrabold tracking-[-0.03em] [font-size:var(--text-subtitle)]" style={{ color }}>{n}</div>
      <div className="font-semibold text-[var(--color-text-secondary)] mt-1.5 [font-size:var(--text-caption)]">{label}</div>
    </Card>
  )
}

function VitalsTrendChart({ vitals }: { vitals: Vital[] }) {
  const data = vitals.slice(0, 10).reverse().map((v, i) => ({
    idx: i + 1,
    bp: v.bp_systolic ?? null,
    hr: v.heart_rate ?? null,
  }))
  if (!data.some((d) => d.bp != null || d.hr != null)) return null
  return (
    <Card className="mb-5">
      <h3 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-label)] mb-4">Vitals Trend — Last 10 Readings</h3>
      <div role="img" aria-label="Vitals trend chart showing blood pressure and heart rate over recent readings.">
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-secondary)" vertical={false} />
            <XAxis dataKey="idx" tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 12, fontSize: 13 }}
              labelStyle={{ color: 'var(--color-text-tertiary)' }}
            />
            <Line type="monotone" dataKey="bp" name="Systolic BP (mmHg)" stroke="var(--color-accent)" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="hr" name="Heart Rate (BPM)" stroke="var(--color-amber)" strokeWidth={2} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-3">
        <span className="flex items-center gap-1.5 [font-size:var(--text-caption)] text-[var(--color-text-secondary)]">
          <span className="w-3 h-0.5 rounded-full bg-[var(--color-accent)] inline-block" />Systolic BP
        </span>
        <span className="flex items-center gap-1.5 [font-size:var(--text-caption)] text-[var(--color-text-secondary)]">
          <span className="w-3 h-0.5 rounded-full bg-[var(--color-amber)] inline-block" />Heart Rate
        </span>
      </div>
    </Card>
  )
}

function VitalCard({ vital }: { vital: Vital }) {
  const metrics: { label: string; value: string; unit: string }[] = []
  if (vital.bp_systolic != null && vital.bp_diastolic != null) {
    metrics.push({ label: 'BP', value: `${vital.bp_systolic}/${vital.bp_diastolic}`, unit: 'mmHg' })
  }
  if (vital.heart_rate != null) metrics.push({ label: 'HR', value: String(vital.heart_rate), unit: 'BPM' })
  if (vital.glucose != null) metrics.push({ label: 'Glucose', value: String(vital.glucose), unit: 'mg/dL' })
  if (vital.weight != null) metrics.push({ label: 'Weight', value: String(vital.weight), unit: 'kg' })
  if (vital.temperature != null) metrics.push({ label: 'Temp', value: String(vital.temperature), unit: '°C' })
  if (vital.o2_saturation != null) metrics.push({ label: 'O₂', value: String(vital.o2_saturation), unit: '%' })

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] font-medium">
          {new Date(vital.recorded_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] font-semibold">{m.label}</div>
            <div className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-label)]">
              {m.value} <span className="font-normal text-[var(--color-text-tertiary)] text-xs">{m.unit}</span>
            </div>
          </div>
        ))}
      </div>
      {vital.notes && (
        <p className="mt-3 text-[var(--color-text-secondary)] [font-size:var(--text-caption)] italic">{vital.notes}</p>
      )}
    </Card>
  )
}

function JournalCard({ entry }: { entry: JournalEntry }) {
  const moodEmoji = entry.mood ? ['😔', '😐', '🙂', '😊', '🤩'][entry.mood - 1] : null
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          {entry.title && (
            <div className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-label)] mb-1">{entry.title}</div>
          )}
          <div className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] leading-snug line-clamp-3">
            {entry.content}
          </div>
        </div>
        {moodEmoji && (
          <span className="text-2xl shrink-0 mt-0.5" aria-label={`Mood: ${entry.mood}/5`}>{moodEmoji}</span>
        )}
      </div>
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {entry.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-xs font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] font-medium">
        {new Date(entry.entry_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
    </Card>
  )
}
