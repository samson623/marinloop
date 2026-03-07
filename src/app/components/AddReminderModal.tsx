import { useState } from 'react'
import { Modal } from '@/shared/components/Modal'
import { Button, Input } from '@/shared/components/ui'
import { useReminders } from '@/shared/hooks/useReminders'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useAppStore } from '@/shared/stores/app-store'
import { NotificationsService } from '@/shared/services/notifications'

const QUICK_PRESETS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '2 h', minutes: 120 },
  { label: '4 h', minutes: 240 },
]

type Props = {
  open: boolean
  onClose: () => void
}

export function AddReminderModal({ open, onClose }: Props) {
  const { session } = useAuthStore()
  const { addReminderAsync } = useReminders()
  const { openRemindersPanel } = useAppStore()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mode, setMode] = useState<'quick' | 'custom'>('quick')
  const [selectedPreset, setSelectedPreset] = useState<number | null>(60)
  const [customDatetime, setCustomDatetime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || !session?.user?.id) return

    let fireAt: Date
    if (mode === 'quick') {
      if (!selectedPreset) return
      fireAt = new Date(Date.now() + selectedPreset * 60_000)
    } else {
      if (!customDatetime) return
      // Parse parts explicitly — new Date(string) without timezone is ambiguous on older iOS
      const [dp, tp] = customDatetime.split('T')
      const [yr, mo, dy] = dp.split('-').map(Number)
      const [hr, mn] = tp.split(':').map(Number)
      fireAt = new Date(yr, mo - 1, dy, hr, mn)
      if (isNaN(fireAt.getTime())) return
    }

    const timeStr = fireAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })

    setSubmitting(true)
    try {
      const reminder = await addReminderAsync({
        user_id: session.user.id,
        title: title.trim(),
        body: body.trim() || `Reminder: ${title.trim()} at ${timeStr}`,
        fire_at: fireAt.toISOString(),
      })
      onClose()
      // Open the reminders panel with the new reminder selected for editing
      openRemindersPanel(reminder.id)
      // Send an immediate push notification to confirm the reminder was set
      try {
        await NotificationsService.sendPush(session.user.id, {
          title: `Reminder set: ${title.trim()}`,
          body: `Will fire at ${timeStr}`,
          url: '/timeline?reminders=open',
          tag: `reminder-confirm-${reminder.id}`,
        })
      } catch { /* push may not be subscribed */ }
    } catch { /* creation error handled by mutation hook */ }
    finally { setSubmitting(false) }
  }

  const canSubmit = title.trim().length > 0 && (
    mode === 'quick' ? selectedPreset !== null : customDatetime.length > 0
  )

  // Min value for datetime-local: now (formatted as YYYY-MM-DDTHH:MM)
  const nowStr = (() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })()

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="New Reminder" variant="bottom">
      <div className="flex flex-col gap-4 pb-2">
        {/* Title */}
        <div>
          <label htmlFor="reminder-title" className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)] mb-1.5">
            What
          </label>
          <Input
            id="reminder-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need to do?"
            autoFocus
            className="w-full"
          />
        </div>

        {/* Optional details */}
        <div>
          <label htmlFor="reminder-body" className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)] mb-1.5">
            Details (optional)
          </label>
          <textarea
            id="reminder-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Extra notes..."
            rows={2}
            className="w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] resize-none outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>

        {/* When */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">When</span>
            <div className="flex rounded-lg overflow-hidden border border-[var(--color-border-primary)]">
              {(['quick', 'custom'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 text-[11px] font-semibold border-none cursor-pointer transition-colors ${mode === m ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}`}
                >
                  {m === 'quick' ? 'Quick' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'quick' ? (
            <div className="flex flex-wrap gap-2">
              {QUICK_PRESETS.map(({ label, minutes }) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setSelectedPreset(minutes)}
                  className={`px-3.5 py-2 rounded-full text-[12px] font-semibold border cursor-pointer transition-colors ${
                    selectedPreset === minutes
                      ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)]'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="datetime-local"
              value={customDatetime}
              min={nowStr}
              onChange={(e) => setCustomDatetime(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="w-full py-3"
        >
          {submitting ? 'Creating...' : 'Create Reminder'}
        </Button>
      </div>
    </Modal>
  )
}
