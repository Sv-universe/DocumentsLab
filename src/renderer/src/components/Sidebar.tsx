import { FileText, Files, HardDrive, Image, ShieldCheck, Star } from 'lucide-react'
import type { DocumentMeta } from '@shared/types'
import { formatBytes, pluralize } from '../lib/format'
import type { LibraryFilter } from '../lib/library'
import { totalSize } from '../lib/library'

interface SidebarProps {
  documents: DocumentMeta[]
  filter: LibraryFilter
  onFilterChange: (filter: LibraryFilter) => void
  version: string
  onShowCredits: () => void
}

export function Sidebar({
  documents,
  filter,
  onFilterChange,
  version,
  onShowCredits
}: SidebarProps) {
  const counts = {
    all: documents.length,
    pdf: documents.filter((document) => document.kind === 'pdf').length,
    image: documents.filter((document) => document.kind === 'image').length,
    favorites: documents.filter((document) => document.favorite).length
  }

  const items: Array<{
    key: LibraryFilter
    label: string
    icon: typeof Files
    count: number
  }> = [
    { key: 'all', label: 'Tous les documents', icon: Files, count: counts.all },
    { key: 'pdf', label: 'PDF', icon: FileText, count: counts.pdf },
    { key: 'image', label: 'Images', icon: Image, count: counts.image },
    { key: 'favorites', label: 'Favoris', icon: Star, count: counts.favorites }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <p className="eyebrow sidebar-eyebrow">Espace de travail</p>
        <nav className="sidebar-nav" aria-label="Filtrer la bibliothèque">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                className={`sidebar-item ${filter === item.key ? 'is-active' : ''}`}
                onClick={() => onFilterChange(item.key)}
                title={item.label}
                aria-current={filter === item.key ? 'page' : undefined}
              >
                <span className="sidebar-item-icon">
                  <Icon size={17} strokeWidth={2} />
                </span>
                <span className="sidebar-item-label">{item.label}</span>
                <span className="sidebar-item-count">{item.count}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="storage-card">
          <div className="storage-card-head">
            <span className="storage-icon">
              <HardDrive size={16} />
            </span>
            <div>
              <strong>Stockage local</strong>
              <span>{pluralize(documents.length, 'document')}</span>
            </div>
          </div>
          <p className="storage-size">{formatBytes(totalSize(documents))} dans votre bibliothèque</p>
        </div>

        <div className="privacy-note">
          <ShieldCheck size={15} />
          <p>Aucun envoi vers le cloud. Vos fichiers ne quittent jamais cet ordinateur.</p>
        </div>

        <button
          className="credits-trigger"
          onClick={onShowCredits}
          title="Crédits et à propos"
        >
          <span className="app-version">
            DocumentsLab {version}
            <span className="alpha-badge">Alpha</span>
          </span>
          <span className="credits-trigger-line">
            par <span className="credits-trigger-name">Sv Universe</span>
          </span>
        </button>
      </div>
    </aside>
  )
}
