import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui'

type ConfirmDeleteModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    itemName: string
    description?: string
    onConfirm: () => void
    isPending?: boolean
}

export function ConfirmDeleteModal({
    open,
    onOpenChange,
    itemName,
    description,
    onConfirm,
    isPending = false,
}: ConfirmDeleteModalProps) {
    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={`Delete ${itemName}?`}
            variant="center"
        >
            <div className="space-y-5">
                {description && (
                    <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] leading-relaxed">
                        {description}
                    </p>
                )}
                {!description && (
                    <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)]">
                        This action cannot be undone.
                    </p>
                )}
                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        className="flex-1"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        size="md"
                        className="flex-1 !bg-[var(--color-red)] !border-[var(--color-red)] hover:!brightness-110"
                        onClick={onConfirm}
                        disabled={isPending}
                    >
                        {isPending ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spin-loading" />
                                Deleting…
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Delete
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
