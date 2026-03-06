import { useState, useCallback, useId } from 'react'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { cn } from '@/shared/lib/utils'
import type { JournalEntryCreateInput } from '@/shared/services/journal'

interface JournalEntryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: JournalEntryCreateInput) => void
  isSubmitting?: boolean
  initialValues?: Partial<JournalEntryCreateInput>
  editId?: string
  meds?: { id: string; name: string }[]
  appts?: { id: string; title: string }[]
}

const MOOD_OPTIONS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😔', label: 'Very sad' },
  { value: 2, emoji: '😐', label: 'Neutral' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😊', label: 'Happy' },
  { value: 5, emoji: '🤩', label: 'Excellent' },
]

const TODAY = new Date().toISOString().slice(0, 10)

const labelClass =
  'block text-[var(--color-text-secondary)] [font-size:var(--text-caption)] font-semibold mb-1.5'

const selectClass =
  'w-full px-3 py-3 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] [font-size:var(--text-body)] outline-none focus:border-[var(--color-accent)]'

export function JournalEntryModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  initialValues,
  editId,
  meds,
  appts,
}: JournalEntryModalProps) {
  const uid = useId()

  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [content, setContent] = useState(initialValues?.content ?? '')
  const [selectedMood, setSelectedMood] = useState<number | null>(
    initialValues?.mood ?? null
  )
  const [tags, setTags] = useState<string[]>(initialValues?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [selectedMedId, setSelectedMedId] = useState(
    initialValues?.linked_medication_id ?? ''
  )
  const [selectedApptId, setSelectedApptId] = useState(
    initialValues?.linked_appointment_id ?? ''
  )
  const [entryDate, setEntryDate] = useState(
    initialValues?.entry_date ?? TODAY
  )
  const [contentError, setContentError] = useState(false)

  const addTag = useCallback(
    (raw: string) => {
      const trimmed = raw.trim().replace(/,$/, '').trim()
      if (trimmed && !tags.includes(trimmed)) {
        setTags((prev) => [...prev, trimmed])
      }
      setTagInput('')
    },
    [tags]
  )

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    }
  }

  const handleTagBlur = () => {
    if (tagInput.trim()) {
      addTag(tagInput)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      setContentError(true)
      return
    }

    setContentError(false)

    const data: JournalEntryCreateInput = {
      title: title.trim(),
      content: content.trim(),
      mood: selectedMood,
      tags,
      linked_medication_id: selectedMedId || null,
      linked_appointment_id: selectedApptId || null,
      entry_date: entryDate,
    }

    onSubmit(data)
  }

  const titleId = `${uid}-title`
  const contentId = `${uid}-content`
  const dateId = `${uid}-date`
  const medId = `${uid}-med`
  const apptId = `${uid}-appt`
  const tagId = `${uid}-tag`

  const hasMeds = meds && meds.length > 0
  const hasAppts = appts && appts.length > 0

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editId ? 'Edit Entry' : 'New Journal Entry'}
      variant="responsive"
      description="Add a journal entry to track your health, mood, and thoughts."
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="max-h-[70vh] overflow-y-auto overscroll-contain flex flex-col gap-4 pb-2">

          {/* Entry date */}
          <div>
            <label htmlFor={dateId} className={labelClass}>
              Date
            </label>
            <Input
              id={dateId}
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Title */}
          <div>
            <label htmlFor={titleId} className={labelClass}>
              Title
            </label>
            <Input
              id={titleId}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Entry title (optional)"
              className="w-full"
              autoComplete="off"
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor={contentId} className={labelClass}>
              Journal Entry
              <span className="text-[var(--color-red)] ml-0.5" aria-hidden>*</span>
            </label>
            <textarea
              id={contentId}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (e.target.value.trim()) setContentError(false)
              }}
              placeholder="What's on your mind? How are you feeling?"
              rows={5}
              required
              aria-required="true"
              aria-invalid={contentError}
              aria-describedby={contentError ? `${contentId}-error` : undefined}
              className={cn(
                'fi w-full resize-none',
                contentError && 'border-[var(--color-red)] focus:border-[var(--color-red)]'
              )}
            />
            {contentError && (
              <p
                id={`${contentId}-error`}
                className="mt-1 text-[var(--color-red)] [font-size:var(--text-caption)]"
                role="alert"
              >
                Please write something before saving.
              </p>
            )}
          </div>

          {/* Mood picker */}
          <div>
            <span className={labelClass} id={`${uid}-mood-label`}>
              How are you feeling?
            </span>
            <div
              className="flex gap-2 mt-0.5"
              role="group"
              aria-labelledby={`${uid}-mood-label`}
            >
              {MOOD_OPTIONS.map(({ value, emoji, label }) => {
                const isSelected = selectedMood === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={label}
                    aria-pressed={isSelected}
                    onClick={() =>
                      setSelectedMood(isSelected ? null : value)
                    }
                    className={cn(
                      'flex-1 inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-120 outline-none',
                      'min-w-[44px] min-h-[44px] text-xl',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                      'tap-spring active:scale-[0.94]',
                      isSelected
                        ? 'bg-[var(--color-accent)] text-white shadow-sm'
                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                    )}
                  >
                    <span aria-hidden>{emoji}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor={tagId} className={labelClass}>
              Tags
            </label>
            <Input
              id={tagId}
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleTagBlur}
              placeholder="Type a tag and press Enter..."
              className="w-full"
              autoComplete="off"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2.5" aria-label="Added tags">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => removeTag(tag)}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-primary)] transition-colors outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                    >
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Related medication */}
          {hasMeds && (
            <div>
              <label htmlFor={medId} className={labelClass}>
                Related medication
              </label>
              <select
                id={medId}
                value={selectedMedId}
                onChange={(e) => setSelectedMedId(e.target.value)}
                className={selectClass}
              >
                <option value="">— No medication —</option>
                {meds.map((med) => (
                  <option key={med.id} value={med.id}>
                    {med.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Related appointment */}
          {hasAppts && (
            <div>
              <label htmlFor={apptId} className={labelClass}>
                Related appointment
              </label>
              <select
                id={apptId}
                value={selectedApptId}
                onChange={(e) => setSelectedApptId(e.target.value)}
                className={selectClass}
              >
                <option value="">— No appointment —</option>
                {appts.map((appt) => (
                  <option key={appt.id} value={appt.id}>
                    {appt.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="pt-4">
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting
              ? editId
                ? 'Saving…'
                : 'Adding…'
              : editId
              ? 'Save changes'
              : 'Add entry'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
