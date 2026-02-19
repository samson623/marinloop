import { useState, useRef, useEffect } from 'react'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui'
import { cn } from '@/shared/lib/utils'

export type QuickCaptureMed = { id: string; name: string }
export type QuickCaptureAppt = { id: string; title: string; start_time: string }

type QuickCaptureModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  meds: QuickCaptureMed[]
  appts: QuickCaptureAppt[]
  onSubmit: (payload: { content: string; medication_id?: string | null; appointment_id?: string | null }) => void
  isSubmitting?: boolean
}

export function QuickCaptureModal({
  open,
  onOpenChange,
  meds,
  appts,
  onSubmit,
  isSubmitting = false,
}: QuickCaptureModalProps) {
  const [content, setContent] = useState('')
  const [medId, setMedId] = useState<string>('')
  const [apptId, setApptId] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setContent('')
      setMedId('')
      setApptId('')
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    onSubmit({
      content: trimmed,
      medication_id: medId || null,
      appointment_id: apptId || null,
    })
    onOpenChange(false)
  }

  const upcomingAppts = appts
    .filter((a) => new Date(a.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5)

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Note for your doctor"
      description="Jot down side effects or questions to bring to your next visit"
      variant="bottom"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="quick-capture-content" className="sr-only">
            Note content
          </label>
          <textarea
            ref={textareaRef}
            id="quick-capture-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Side effects, questions, or anything to remember for your next visit…"
            rows={4}
            className={cn(
              'fi w-full resize-none rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]',
              'px-4 py-3 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent',
              'min-h-[120px]'
            )}
            disabled={isSubmitting}
          />
        </div>

        {(meds.length > 0 || upcomingAppts.length > 0) && (
          <div className="flex flex-wrap gap-3">
            {meds.length > 0 && (
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="quick-capture-med" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Link to medication
                </label>
                <select
                  id="quick-capture-med"
                  value={medId}
                  onChange={(e) => setMedId(e.target.value)}
                  className={cn(
                    'fi w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]',
                    'px-3 py-2.5 text-[var(--color-text-primary)] text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]'
                  )}
                  disabled={isSubmitting}
                >
                  <option value="">None</option>
                  {meds.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {upcomingAppts.length > 0 && (
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="quick-capture-appt" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  For appointment
                </label>
                <select
                  id="quick-capture-appt"
                  value={apptId}
                  onChange={(e) => setApptId(e.target.value)}
                  className={cn(
                    'fi w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]',
                    'px-3 py-2.5 text-[var(--color-text-primary)] text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]'
                  )}
                  disabled={isSubmitting}
                >
                  <option value="">None</option>
                  {upcomingAppts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} — {new Date(a.start_time).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <Button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? 'Saving…' : 'Save note'}
        </Button>
      </form>
    </Modal>
  )
}
