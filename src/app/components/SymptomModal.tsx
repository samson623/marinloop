import { useState } from 'react'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/Button'
import type { SymptomCreateInput } from '@/shared/services/symptoms'

interface SymptomModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: SymptomCreateInput) => void
  isSubmitting?: boolean
  medicationId?: string
  medicationName?: string
  meds?: { id: string; name: string }[]
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

function severityColor(severity: number): string {
  if (severity <= 3) return 'var(--color-green)'
  if (severity <= 6) return '#f59e0b'
  return 'var(--color-red)'
}

function severityLabel(severity: number): string {
  if (severity <= 3) return 'Mild'
  if (severity <= 6) return 'Moderate'
  return 'Severe'
}

export function SymptomModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  medicationId,
  medicationName,
  meds = [],
}: SymptomModalProps) {
  const [name, setName] = useState('')
  const [severity, setSeverity] = useState(5)
  const [onsetAt, setOnsetAt] = useState(() => toLocalDatetimeString(new Date()))
  const [resolvedAt, setResolvedAt] = useState('')
  const [linkedMedId, setLinkedMedId] = useState(medicationId ?? '')
  const [notes, setNotes] = useState('')
  const [nameError, setNameError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setNameError(true)
      return
    }
    const data: SymptomCreateInput = {
      name: name.trim(),
      severity,
      onset_at: new Date(onsetAt).toISOString(),
      resolved_at: resolvedAt ? new Date(resolvedAt).toISOString() : null,
      linked_medication_id: linkedMedId || null,
      notes: notes.trim() || null,
    }
    onSubmit(data)
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state on close
      setName('')
      setSeverity(5)
      setOnsetAt(toLocalDatetimeString(new Date()))
      setResolvedAt('')
      setLinkedMedId(medicationId ?? '')
      setNotes('')
      setNameError(false)
    }
    onOpenChange(open)
  }

  const color = severityColor(severity)

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="Log Side Effect"
      variant="responsive"
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* Symptom name */}
        <div className="mb-4">
          <label
            htmlFor="symptom-name"
            className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]"
          >
            Symptom
          </label>
          <input
            id="symptom-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(false) }}
            placeholder="e.g. Headache, Nausea, Dizziness"
            required
            className="fi w-full"
            aria-invalid={nameError}
            aria-describedby={nameError ? 'symptom-name-error' : undefined}
          />
          {nameError && (
            <p id="symptom-name-error" className="mt-1 text-[var(--color-red)] [font-size:var(--text-caption)]">
              Please enter a symptom name.
            </p>
          )}
        </div>

        {/* Severity slider */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="symptom-severity"
              className="font-bold text-[var(--color-text-secondary)] [font-size:var(--text-label)]"
            >
              Severity
            </label>
            <span
              className="text-2xl font-extrabold leading-none"
              style={{ color }}
            >
              {severity}
            </span>
          </div>
          <input
            id="symptom-severity"
            type="range"
            min={1}
            max={10}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)] cursor-pointer"
          />
          <div className="flex items-center justify-between mt-1">
            <span
              className="[font-size:var(--text-caption)] font-semibold"
              style={{ color }}
            >
              {severity}
            </span>
            <span
              className="[font-size:var(--text-caption)] font-medium"
              style={{ color }}
            >
              {severityLabel(severity)}
            </span>
          </div>
        </div>

        {/* Onset */}
        <div className="mb-4">
          <label
            htmlFor="symptom-onset"
            className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]"
          >
            When did it start?
          </label>
          <input
            id="symptom-onset"
            type="datetime-local"
            value={onsetAt}
            onChange={(e) => setOnsetAt(e.target.value)}
            className="fi w-full"
          />
        </div>

        {/* Resolved at */}
        <div className="mb-4">
          <label
            htmlFor="symptom-resolved"
            className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]"
          >
            Resolved at (optional)
          </label>
          <input
            id="symptom-resolved"
            type="datetime-local"
            value={resolvedAt}
            onChange={(e) => setResolvedAt(e.target.value)}
            className="fi w-full"
          />
        </div>

        {/* Linked medication */}
        <div className="mb-4">
          <label
            htmlFor="symptom-med"
            className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]"
          >
            Linked medication
          </label>
          {medicationId ? (
            <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-xl px-3 py-2.5">
              Linked to: <span className="font-semibold text-[var(--color-text-primary)]">{medicationName}</span>
            </p>
          ) : (
            <select
              id="symptom-med"
              value={linkedMedId}
              onChange={(e) => setLinkedMedId(e.target.value)}
              className="fi w-full cursor-pointer"
            >
              <option value="">— No medication —</option>
              {meds.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Notes */}
        <div className="mb-5">
          <label
            htmlFor="symptom-notes"
            className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]"
          >
            Notes (optional)
          </label>
          <textarea
            id="symptom-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="fi w-full resize-y min-h-[2.5rem]"
            placeholder="Any additional details..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="flex-1"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Log Side Effect'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
