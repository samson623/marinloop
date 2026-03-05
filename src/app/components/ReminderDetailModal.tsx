import { useState } from 'react'
import { Modal } from '@/shared/components/Modal'
import { Button, Input } from '@/shared/components/ui'
import { useReminders } from '@/shared/hooks/useReminders'
import type { Reminder } from '@/shared/services/reminders'

type Props = {
  reminder: Reminder
  onClose: () => void
}

function formatFireAt(fireAt: string): string {
  return new Date(fireAt).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function formatFiredAt(firedAt: string): string {
  return new Date(firedAt).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// Convert ISO UTC timestamp to datetime-local string (YYYY-MM-DDTHH:MM)
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ReminderDetailModal({ reminder, onClose }: Props) {
  const { updateReminder, deleteReminder, snoozeReminder } = useReminders()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editTitle, setEditTitle] = useState(reminder.title)
  const [editBody, setEditBody] = useState(reminder.body)
  const [editDatetime, setEditDatetime] = useState(toDatetimeLocal(reminder.fire_at))

  const isFired = reminder.fired

  const handleSave = () => {
    const fireAt = new Date(editDatetime)
    if (!editTitle.trim() || isNaN(fireAt.getTime())) return
    updateReminder({
      id: reminder.id,
      updates: { title: editTitle.trim(), body: editBody.trim(), fire_at: fireAt.toISOString() },
    })
    setEditing(false)
    onClose()
  }

  const handleDelete = () => {
    deleteReminder(reminder.id)
    onClose()
  }

  const handleSnooze = () => {
    snoozeReminder({ id: reminder.id, minutes: 10 })
    onClose()
  }

  if (confirmDelete) {
    return (
      <Modal open onOpenChange={(o) => !o && setConfirmDelete(false)} title="Delete Reminder" variant="center">
        <p className="text-[13px] text-[var(--color-text-primary)] mb-4">
          Delete <strong>{reminder.title}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="primary" size="md" className="flex-1 py-2.5 bg-[var(--color-red)] border-[var(--color-red)]" onClick={handleDelete}>
            Delete
          </Button>
          <Button type="button" variant="secondary" size="md" className="flex-1 py-2.5" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    )
  }

  if (editing) {
    const nowStr = (() => {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    })()
    return (
      <Modal open onOpenChange={(o) => { if (!o) { setEditing(false); onClose() } }} title="Edit Reminder" variant="bottom">
        <div className="flex flex-col gap-4 pb-2">
          <div>
            <label htmlFor="edit-reminder-title" className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)] mb-1.5">
              What
            </label>
            <Input
              id="edit-reminder-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="edit-reminder-body" className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)] mb-1.5">
              Details (optional)
            </label>
            <textarea
              id="edit-reminder-body"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] resize-none outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="edit-reminder-time" className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)] mb-1.5">
              When
            </label>
            <input
              id="edit-reminder-time"
              type="datetime-local"
              value={editDatetime}
              min={nowStr}
              onChange={(e) => setEditDatetime(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="primary" size="md" className="flex-1 py-2.5" onClick={handleSave} disabled={!editTitle.trim()}>
              Save
            </Button>
            <Button type="button" variant="secondary" size="md" className="flex-1 py-2.5" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={isFired ? 'Past Reminder' : 'Reminder'} variant="bottom">
      <div className="flex flex-col gap-4 pb-2">
        {/* Content */}
        <div>
          <p className="font-semibold text-[var(--color-text-primary)] text-[15px]">{reminder.title}</p>
          {reminder.body && (
            <p className="text-[var(--color-text-secondary)] text-[13px] mt-1">{reminder.body}</p>
          )}
        </div>

        {/* Time info */}
        <div className="bg-[var(--color-bg-secondary)] rounded-xl px-4 py-3">
          {isFired ? (
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              Fired at <strong className="text-[var(--color-text-primary)]">{reminder.fired_at ? formatFiredAt(reminder.fired_at) : '—'}</strong>
            </p>
          ) : (
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              Scheduled for <strong className="text-[var(--color-text-primary)]">{formatFireAt(reminder.fire_at)}</strong>
            </p>
          )}
        </div>

        {/* Actions */}
        {!isFired && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="md" className="flex-1 py-2.5" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button type="button" variant="secondary" size="md" className="flex-1 py-2.5" onClick={handleSnooze}>
                Snooze 10 min
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full py-2.5 text-[var(--color-red)] border-[var(--color-red)] opacity-80"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          </div>
        )}

        {isFired && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-full py-2.5 text-[var(--color-red)] border-[var(--color-red)] opacity-80"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        )}
      </div>
    </Modal>
  )
}
