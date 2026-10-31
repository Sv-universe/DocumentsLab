import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  size?: 'small' | 'medium' | 'large'
  className?: string
  closeOnBackdrop?: boolean
}

export function Modal({
  title,
  subtitle,
  children,
  footer,
  onClose,
  size = 'medium',
  className = '',
  closeOnBackdrop = true
}: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`modal modal-${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="icon-button modal-close" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}
