import { FolderOpen, SearchX, Sparkles, Upload } from 'lucide-react'
import type { LibraryFilter } from '../lib/library'
import { Logo } from './Logo'

interface EmptyStateProps {
  filter: LibraryFilter
  hasDocuments: boolean
  importing: boolean
  onImport: () => void
  onOpen: () => void
  onReset: () => void
}

export function EmptyState({
  filter,
  hasDocuments,
  importing,
  onImport,
  onOpen,
  onReset
}: EmptyStateProps) {
  if (hasDocuments) {
    return (
      <div className="empty-state empty-state-filter">
        <span className="empty-filter-icon">
          {filter === 'favorites' ? <Sparkles size={26} /> : <SearchX size={26} />}
        </span>
        <h2>
          {filter === 'favorites'
            ? 'Aucun favori pour le moment'
            : 'Rien dans cette catégorie'}
        </h2>
        <p>
          {filter === 'favorites'
            ? 'Cliquez sur l’étoile d’un document pour le garder à portée de main.'
            : 'Modifiez votre recherche ou revenez à la bibliothèque complète.'}
        </p>
        <button className="button button-ghost" onClick={onReset}>
          Voir tous les documents
        </button>
      </div>
    )
  }

  return (
    <div className="empty-state">
      <div className="empty-illustration" aria-hidden="true">
        <span className="empty-page empty-page-back" />
        <span className="empty-page empty-page-mid" />
        <span className="empty-page empty-page-front">
          <span className="empty-page-line empty-page-line-long" />
          <span className="empty-page-line" />
          <span className="empty-page-line empty-page-line-short" />
          <span className="empty-page-mark">
            <Logo size={42} />
          </span>
        </span>
        <span className="empty-spark empty-spark-one">✦</span>
        <span className="empty-spark empty-spark-two">✦</span>
      </div>

      <div className="empty-copy">
        <p className="eyebrow">Votre atelier est prêt</p>
        <h2>La page blanche, c’est vous qui l’écrivez.</h2>
        <p>
          Importez un PDF ou une image pour commencer. Signez, annotez, retouchez :
          tout reste sur votre ordinateur.
        </p>
        <div className="empty-actions">
          <button className="button button-accent" onClick={onImport} disabled={importing}>
            <Upload size={16} />
            {importing ? 'Import en cours…' : 'Importer des documents'}
          </button>
          <button className="button button-ghost" onClick={onOpen}>
            <FolderOpen size={16} />
            Ouvrir un fichier
          </button>
        </div>
        <span className="empty-drop-hint">
          ou déposez simplement vos fichiers dans la fenêtre
        </span>
      </div>
    </div>
  )
}
