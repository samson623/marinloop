import { useState } from 'react'
import { Modal } from '@/shared/components/Modal'
import { Button, Input } from '@/shared/components/ui'
import { useReminders } from '@/shared/hooks/useReminders'
import { useAuthStore } from '@/shared/stores/auth-store'

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
  const { addReminder, isAdding } = useReminders()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mode, setMode] = useState<'quick' | 'custom'>('quick')
  const [selectedPreset, setSelectedPreset] = useState<number | null>(60)
  const [customDatetime, setCustomDatetime] = useState('')

  const handleSubmit = () => {
    if (!title.trim() || !session?.user?.id) return

    let fireAt: Date
    if (mode === 'quick') {
      if (!selectedPreset) return
      fireAt = new Date(Date.now() + selectedPreset * 60_000)
    } else {
      if (!customDatetime) return
      fireAt = new Date(customDatetime) // datetime-local → local time → Date (UTC internally)
      if (isNaN(fireAt.getTime())) return
    }

    addReminder({
      user_id: session.user.id,
      title: title.trim(),
      body: body.trim(),
      fire_at: fireAt.toISOString(),
    })
    onClose()
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
          disabled={!canSubmit || isAdding}
          onClick={handleSubmit}
          className="w-full py-3"
        >
          {isAdding ? 'Creating...' : 'Create Reminder'}
        </Button>
      </div>
    </Modal>
  )
}
