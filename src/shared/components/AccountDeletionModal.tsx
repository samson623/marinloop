import { useState } from 'react'
import { Modal } from '@/shared/components/Modal'
import { Button, Input } from '@/shared/components/ui'
import { useAccount } from '@/shared/hooks/useAccount'
import { useAppStore } from '@/shared/stores/app-store'
import { getErrorMessage } from '@/shared/lib/errors'

const CONFIRM_TEXT = 'DELETE'

export function AccountDeletionModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useAppStore()
  const { deleteAccount, exportData } = useAccount()
  const [confirmInput, setConfirmInput] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const canDelete = confirmInput === CONFIRM_TEXT

  const handleDelete = () => {
    setErrorMsg(null)
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        toast('Your account data has been deleted', 'ts')
        onOpenChange(false)
      },
      onError: (err: unknown) => {
        setErrorMsg(getErrorMessage(err, 'Could not delete account. Please try again or email admin@marinloop.com.'))
      },
    })
  }

  const handleExport = () => {
    exportData.mutate(undefined)
  }

  const handleClose = () => {
    setConfirmInput('')
    setErrorMsg(null)
    onOpenChange(false)
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Delete Account & Data" variant="center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--color-red)_12%,transparent)] mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>

      <div className="space-y-3 text-[var(--color-text-secondary)] [font-size:var(--text-body)] mb-4">
        <p className="font-semibold text-[var(--color-text-primary)]">
          This action is permanent and cannot be undone.
        </p>
        <p>
          All your health data will be permanently deleted: medications, dose history, appointments, vitals, journal entries, symptoms, reminders, and notes.
        </p>
        <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">
          Your login credentials will be removed within 30 days. For immediate account removal, email{' '}
          <a href="mailto:admin@marinloop.com" className="underline text-[var(--color-accent)]">admin@marinloop.com</a>.
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full mb-4"
        onClick={handleExport}
        disabled={exportData.isPending}
      >
        {exportData.isPending ? 'Exporting...' : 'Download my data first'}
      </Button>

      <div className="mb-4">
        <label htmlFor="delete-confirm" className="block font-semibold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">
          Type <strong className="text-[var(--color-red)] font-mono">DELETE</strong> to confirm
        </label>
        <Input
          id="delete-confirm"
          type="text"
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          className="font-mono tracking-widest"
        />
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mb-4 px-3 py-2 rounded-lg bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)] text-[var(--color-red)] [font-size:var(--text-caption)] font-medium"
        >
          {errorMsg}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="danger"
          size="md"
          className="w-full"
          disabled={!canDelete || deleteAccount.isPending}
          onClick={handleDelete}
        >
          {deleteAccount.isPending ? 'Deleting...' : 'Delete My Account & Data'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="w-full"
          onClick={handleClose}
          disabled={deleteAccount.isPending}
        >
          Cancel
        </Button>
      </div>
    </Modal>
  )
}
