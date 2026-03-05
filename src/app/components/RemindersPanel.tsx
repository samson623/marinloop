import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/shared/components/Modal'
import { useAppStore } from '@/shared/stores/app-store'
import { useReminders } from '@/shared/hooks/useReminders'
import type { Reminder } from '@/shared/services/reminders'
import { AddReminderModal } from '@/app/components/AddReminderModal'
import { ReminderDetailModal } from '@/app/components/ReminderDetailModal'

function formatCountdown(fireAt: string): string {
  const diffMs = new Date(fireAt).getTime() - Date.now()
  if (diffMs <= 0) return 'overdue'
  const totalMin = Math.floor(diffMs / 60_000)
  if (totalMin < 60) return `in ${totalMin} min`
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  return mins === 0 ? `in ${hours} h` : `in ${hours} h ${mins} min`
}

function formatFiredAt(firedAt: string): string {
  return new Date(firedAt).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export function RemindersPanel() {
  const { showRemindersPanel, closeRemindersPanel } = useAppStore()
  const { reminders, isLoading } = useReminders()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)
  const [showRecent, setShowRecent] = useState(false)
  const [tick, setTick] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const now = Date.now()
  const upcoming = reminders.filter((r) => !r.fired && new Date(r.fire_at).getTime() > now)
  const overdue = reminders.filter((r) => !r.fired && new Date(r.fire_at).getTime() <= now)
  const recent = reminders.filter((r) => r.fired && r.fired_at && Date.now() - new Date(r.fired_at).getTime() < 7 * 24 * 60 * 60 * 1000)

  // Adaptive poll: 10s if any reminder is within 5 minutes, else 30s
  const hasImminent = upcoming.some((r) => new Date(r.fire_at).getTime() - Date.now() < 5 * 60 * 1000)

  useEffect(() => {
    if (!showRemindersPanel) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    const ms = hasImminent ? 10_000 : 30_000
    intervalRef.current = setInterval(() => setTick((t) => t + 1), ms)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [showRemindersPanel, hasImminent, tick])

  if (!showRemindersPanel) return null

  return (
    <>
      <Modal
        open={showRemindersPanel}
        onOpenChange={(o) => !o && closeRemindersPanel()}
        title="Reminders"
        variant="bottom"
      >
        <div className="pb-2">
          {/* Create button */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl border border-dashed border-[var(--color-border-primary)] text-[var(--color-accent)] font-semibold text-[13px] bg-transparent cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Reminder
          </button>

          {isLoading && (
            <p className="text-[var(--color-text-secondary)] text-[13px] py-2">Loading...</p>
          )}

          {/* Overdue section */}
          {overdue.length > 0 && (
            <section className="mb-4">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-red)] mb-2">Overdue</h3>
              <ul className="flex flex-col gap-2">
                {overdue.map((r) => (
                  <ReminderCard key={r.id} reminder={r} label="overdue" labelColor="var(--color-red)" onClick={() => setSelectedReminder(r)} />
                ))}
              </ul>
            </section>
          )}

          {/* Upcoming section */}
          {upcoming.length > 0 && (
            <section className="mb-4">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)] mb-2">Upcoming</h3>
              <ul className="flex flex-col gap-2">
                {upcoming.map((r) => (
                  <ReminderCard key={r.id} reminder={r} label={formatCountdown(r.fire_at)} labelColor="var(--color-accent)" onClick={() => setSelectedReminder(r)} />
                ))}
              </ul>
            </section>
          )}

          {/* Empty state */}
          {!isLoading && upcoming.length === 0 && overdue.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[var(--color-text-secondary)] text-[13px] mb-1">No upcoming reminders.</p>
              <p className="text-[var(--color-text-tertiary)] text-[12px]">Try saying "Remind me in one hour" or tap + above.</p>
            </div>
          )}

          {/* Recent section */}
          {recent.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowRecent((v) => !v)}
                className="w-full flex items-center justify-between py-2 bg-transparent border-none cursor-pointer text-left"
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                  Recent ({recent.length})
                </span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-[var(--color-text-tertiary)] transition-transform ${showRecent ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showRecent && (
                <ul className="flex flex-col gap-2 mt-2">
                  {recent.map((r) => (
                    <ReminderCard
                      key={r.id}
                      reminder={r}
                      label={r.fired_at ? `Fired ${formatFiredAt(r.fired_at)}` : 'Fired'}
                      labelColor="var(--color-text-tertiary)"
                      dimmed
                      onClick={() => setSelectedReminder(r)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </Modal>

      {showAddModal && (
        <AddReminderModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {selectedReminder && (
        <ReminderDetailModal
          reminder={selectedReminder}
          onClose={() => setSelectedReminder(null)}
        />
      )}
    </>
  )
}

function ReminderCard({
  reminder,
  label,
  labelColor,
  dimmed = false,
  onClick,
}: {
  reminder: Reminder
  label: string
  labelColor: string
  dimmed?: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl px-4 py-3 cursor-pointer hover:bg-[var(--color-bg-primary)] transition-colors ${dimmed ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[var(--color-text-primary)] text-[13px] truncate">{reminder.title}</span>
          <span
            className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: labelColor, background: 'color-mix(in srgb, currentColor 10%, transparent)' }}
          >
            {label}
          </span>
        </div>
        {reminder.body && (
          <p className="text-[var(--color-text-secondary)] text-[12px] mt-0.5 truncate">{reminder.body}</p>
        )}
      </button>
    </li>
  )
}
