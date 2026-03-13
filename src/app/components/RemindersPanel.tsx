import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/shared/components/Modal'
import { useAppStore } from '@/shared/stores/app-store'
import { useReminders } from '@/shared/hooks/useReminders'
import { usePushNotifications } from '@/shared/hooks/usePushNotifications'
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
  const { showRemindersPanel, closeRemindersPanel, autoEditReminderId } = useAppStore()
  const { reminders, isLoading } = useReminders()
  const { isSupported, isSubscribed, subscribe, isLoading: isPushLoading } = usePushNotifications()
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)
  const autoEditConsumedRef = useRef<string | null>(null)
  const [showRecent, setShowRecent] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-open the detail modal for a newly created reminder (for editing)
  useEffect(() => {
    if (!autoEditReminderId || autoEditConsumedRef.current === autoEditReminderId || reminders.length === 0) return
    const target = reminders.find((r) => r.id === autoEditReminderId)
    if (!target) return
    autoEditConsumedRef.current = autoEditReminderId
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: open modal for newly created reminder, single cascade is expected and desired
    setSelectedReminder(target)
  }, [autoEditReminderId, reminders])

  const upcoming = reminders.filter((r) => !r.fired && new Date(r.fire_at).getTime() > now)
  const overdue = reminders.filter((r) => !r.fired && new Date(r.fire_at).getTime() <= now)
  const recent = reminders.filter((r) => r.fired && r.fired_at && now - new Date(r.fired_at).getTime() < 7 * 24 * 60 * 60 * 1000)

  // Adaptive poll: 10s if any reminder is within 5 minutes, else 30s
  const hasImminent = upcoming.some((r) => new Date(r.fire_at).getTime() - now < 5 * 60 * 1000)

  useEffect(() => {
    if (!showRemindersPanel) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    const ms = hasImminent ? 10_000 : 30_000
    intervalRef.current = setInterval(() => setNow(Date.now()), ms)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [showRemindersPanel, hasImminent])

  if (!showRemindersPanel) return null

  return (
    <>
      <Modal
        open={showRemindersPanel}
        onOpenChange={(o) => !o && closeRemindersPanel()}
        title="Reminders"
        variant="center"
      >
        <div className="pb-2">
          {/* Create button */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] py-3 mb-6 rounded-2xl border border-dashed border-[var(--color-border-primary)] text-[var(--color-accent)] font-semibold [font-size:var(--text-body)] bg-transparent cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Reminder
          </button>

          {/* Push subscription warning */}
          {isSupported && !isSubscribed && (
            <div className="flex items-center justify-between gap-3 mb-6 px-4 py-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)]">
              <p className="[font-size:var(--text-label)] text-[var(--color-text-secondary)] leading-snug">
                Push off — you may miss reminders when the app is closed.
              </p>
              <button
                type="button"
                onClick={subscribe}
                disabled={isPushLoading}
                className="shrink-0 min-h-[44px] [font-size:var(--text-label)] font-semibold text-[var(--color-accent)] bg-transparent border-none cursor-pointer p-0 disabled:opacity-50"
              >
                Enable
              </button>
            </div>
          )}

          {isLoading && (
            <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] py-2">Loading...</p>
          )}

          {/* Overdue section */}
          {overdue.length > 0 && (
            <section className="mb-6">
              <h3 className="font-bold uppercase tracking-[0.06em] [font-size:var(--text-caption)] text-[var(--color-red)] mb-3">Overdue</h3>
              <ul className="flex flex-col space-y-3">
                {overdue.map((r) => (
                  <ReminderCard key={r.id} reminder={r} label="overdue" labelColor="var(--color-red)" onClick={() => setSelectedReminder(r)} />
                ))}
              </ul>
            </section>
          )}

          {/* Upcoming section */}
          {upcoming.length > 0 && (
            <section className="mb-6">
              <h3 className="font-bold uppercase tracking-[0.06em] [font-size:var(--text-caption)] text-[var(--color-text-tertiary)] mb-3">Upcoming</h3>
              <ul className="flex flex-col space-y-3">
                {upcoming.map((r) => (
                  <ReminderCard key={r.id} reminder={r} label={formatCountdown(r.fire_at)} labelColor="var(--color-accent)" onClick={() => setSelectedReminder(r)} />
                ))}
              </ul>
            </section>
          )}

          {/* Empty state */}
          {!isLoading && upcoming.length === 0 && overdue.length === 0 && (
            <div className="py-12 text-center empty-state">
              <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] font-semibold mb-2">No upcoming reminders.</p>
              <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-label)] leading-relaxed">Tap <strong>New Reminder</strong> above, or use the mic button to create one with your voice.</p>
            </div>
          )}

          {/* Recent section */}
          {recent.length > 0 && (
            <section className="mb-6">
              <button
                type="button"
                onClick={() => setShowRecent((v) => !v)}
                aria-expanded={showRecent}
                aria-controls="reminders-recent-panel"
                className="w-full flex items-center justify-between min-h-[44px] py-2 bg-transparent border-none cursor-pointer text-left"
              >
                <span className="font-bold uppercase tracking-[0.06em] [font-size:var(--text-caption)] text-[var(--color-text-tertiary)]">
                  Recent ({recent.length})
                </span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-[var(--color-text-tertiary)] transition-transform ${showRecent ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showRecent && (
                <ul id="reminders-recent-panel" className="flex flex-col space-y-3 mt-3">
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
          startEditing={!selectedReminder.fired && autoEditReminderId === selectedReminder.id}
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
        className={`w-full text-left bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-2xl p-4 min-h-[44px] cursor-pointer hover:bg-[var(--color-bg-primary)] transition-colors ${dimmed ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[var(--color-text-primary)] [font-size:var(--text-body)] truncate">{reminder.title}</span>
          <span
            className="shrink-0 [font-size:var(--text-caption)] font-semibold px-2.5 py-1 rounded-full"
            style={{ color: labelColor, background: 'color-mix(in srgb, currentColor 10%, transparent)' }}
          >
            {label}
          </span>
        </div>
        {reminder.body && (
          <p className="text-[var(--color-text-secondary)] [font-size:var(--text-label)] mt-1.5 truncate">{reminder.body}</p>
        )}
      </button>
    </li>
  )
}
