import { Heart, Sparkles } from 'lucide-react'
import { Logo } from './Logo'
import { Modal } from './Modal'

interface AboutDialogProps {
  version: string
  onClose: () => void
}

export function AboutDialog({ version, onClose }: AboutDialogProps) {
  return (
    <Modal
      title="À propos"
      subtitle="DocumentsLab, votre atelier documentaire local."
      size="small"
      className="credits-modal"
      onClose={onClose}
      footer={
        <button className="button button-accent" onClick={onClose}>
          Fermer
        </button>
      }
    >
      <div className="credits-body">
        <div className="credits-brand">
          <Logo size={58} />
          <div>
            <h3>DocumentsLab</h3>
            <span className="credits-version">Version {version}</span>
          </div>
        </div>

        <p className="credits-description">
          Une bibliothèque paisible pour vos PDF et vos images. Signature, annotations,
          recadrage et retouches : tout se passe ici, sans cloud et sans distraction.
        </p>

        <div className="credits-block">
          <span className="eyebrow">Conception & identité</span>
          <div className="credits-signature-wrap">
            <Sparkles size={15} className="credits-spark" aria-hidden="true" />
            <span className="credits-signature">Sv Universe</span>
            <Sparkles size={15} className="credits-spark" aria-hidden="true" />
          </div>
          <span className="credits-caption">marque & création numérique</span>
        </div>

        <p className="credits-copyright">
          <Heart size={12} />
          © 2026 Sv Universe · DocumentsLab. Tous droits réservés.
        </p>
      </div>
    </Modal>
  )
}
