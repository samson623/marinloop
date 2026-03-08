import { useState } from 'react'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui'
import { useFeedback } from '@/shared/hooks/useFeedback'
import { useAppStore } from '@/shared/stores/app-store'

type FeedbackType = 'bug' | 'feature' | 'general'

const TYPES: { id: FeedbackType; label: string }[] = [
  { id: 'bug', label: 'Bug' },
  { id: 'feature', label: 'Feature' },
  { id: 'general', label: 'General' },
]

const PLACEHOLDERS: Record<FeedbackType, string> = {
  bug: 'Describe what happened and what you expected...',
  feature: 'Describe the feature you\u2019d like to see...',
  general: 'Share your thoughts about MarinLoop...',
}

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { submitFeedback } = useFeedback()
  const { toast } = useAppStore()

  const handleClose = () => {
    setMessage('')
    setType('bug')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (message.trim().length < 10) {
      toast('Please write at least 10 characters', 'tw')
      return
    }
    setSubmitting(true)
    const { error } = await submitFeedback(type, message)
    setSubmitting(false)
    if (error) {
      toast('Failed to send feedback. Please try again.', 'te')
      return
    }
    toast('Feedback sent \u2014 thank you!', 'ts')
    handleClose()
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && handleClose()} title="Send Feedback" variant="center">
      <form onSubmit={handleSubmit} className="pb-2">
        <div className="flex gap-2 mb-4">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`flex-1 py-2 px-3 rounded-xl border font-semibold transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] [font-size:var(--text-label)] ${
                type === t.id
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)]'
                  : 'bg-transparent text-[var(--color-text-primary)] border-[var(--color-border-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={PLACEHOLDERS[type]}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          className="w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] p-3 [font-size:var(--text-body)] resize-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] mb-1"
        />
        <div className="text-right text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mb-4">
          {message.length}/2000
        </div>

        <Button type="submit" variant="primary" size="md" disabled={submitting} className="w-full min-h-[48px]">
          {submitting ? 'Sending...' : 'Send Feedback'}
        </Button>
      </form>
    </Modal>
  )
}
