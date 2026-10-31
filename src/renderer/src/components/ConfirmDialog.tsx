import { useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  title: string
  subtitle?: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'accent'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  subtitle,
  children,
  confirmLabel,
  cancelLabel = 'Annuler',
  tone = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      size="small"
      onClose={onCancel}
      footer={
        <>
          <button className="button button-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`button ${tone === 'danger' ? 'button-danger' : 'button-accent'}`}
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? 'Un instant…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-content">
        <span className={`confirm-icon confirm-icon-${tone}`}>
          <AlertTriangle size={20} />
        </span>
        <div>{children}</div>
      </div>
    </Modal>
  )
}
