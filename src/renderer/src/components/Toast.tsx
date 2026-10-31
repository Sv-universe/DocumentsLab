import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  message: string
  detail?: string
  tone: ToastTone
}

interface ToastStackProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = icons[toast.tone]
        return (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            <div className="toast-icon">
              <Icon size={17} strokeWidth={2.2} />
            </div>
            <div className="toast-content">
              <p>{toast.message}</p>
              {toast.detail ? <span>{toast.detail}</span> : null}
            </div>
            <button
              className="toast-close"
              onClick={() => onDismiss(toast.id)}
              aria-label="Fermer la notification"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
