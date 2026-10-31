import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import {
  Ellipsis,
  FileText,
  FolderSearch,
  Image as ImageIcon,
  Pencil,
  Star,
  Trash2
} from 'lucide-react'
import type { DocumentMeta } from '@shared/types'
import { formatBytes, formatRelativeDate } from '../lib/format'
import type { ViewMode } from '../lib/library'

interface DocumentCardProps {
  document: DocumentMeta
  index: number
  viewMode: ViewMode
  onOpen: (document: DocumentMeta) => void
  onToggleFavorite: (document: DocumentMeta) => void
  onRename: (document: DocumentMeta) => void
  onDelete: (document: DocumentMeta) => void
  onReveal: (document: DocumentMeta) => void
}

function PdfCover({ document }: { document: DocumentMeta }) {
  return (
    <div className="pdf-cover" aria-hidden="true">
      <span className="pdf-cover-sheet">
        <span className="pdf-cover-corner" />
        <span className="pdf-cover-brand">
          <span className="pdf-cover-dot" />
          DocumentsLab
        </span>
        <span className="pdf-cover-title">{document.name}</span>
        <span className="pdf-cover-line pdf-cover-line-wide" />
        <span className="pdf-cover-line" />
        <span className="pdf-cover-line pdf-cover-line-short" />
        <span className="pdf-cover-pages">
          {document.pageCount ? `${document.pageCount} pages` : 'PDF'}
        </span>
      </span>
    </div>
  )
}

function ImageFallback({ document }: { document: DocumentMeta }) {
  return (
    <div className="image-fallback" aria-hidden="true">
      <span className="image-fallback-icon">
        <ImageIcon size={26} strokeWidth={1.7} />
      </span>
      <span>{document.ext.toUpperCase()}</span>
    </div>
  )
}

export function DocumentCard({
  document,
  index,
  viewMode,
  onOpen,
  onToggleFavorite,
  onRename,
  onDelete,
  onReveal
}: DocumentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const thumbnailUrl = `doclab://thumb/${document.id}?v=${document.modifiedAt}`

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    window.document.addEventListener('pointerdown', close)
    return () => window.document.removeEventListener('pointerdown', close)
  }, [menuOpen])

  const stop = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(document)
    }
  }

  const meta =
    document.kind === 'pdf'
      ? `${document.pageCount ? `${document.pageCount} ${document.pageCount === 1 ? 'page' : 'pages'}` : 'PDF'} · ${formatBytes(document.size)}`
      : `${document.width && document.height ? `${document.width} × ${document.height} · ` : ''}${formatBytes(document.size)}`

  return (
    <article
      className={`doc-card doc-card-${viewMode} ${menuOpen ? 'menu-open' : ''}`}
      style={{ '--card-delay': `${Math.min(index, 14) * 24}ms` } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`Ouvrir ${document.name}`}
      onClick={() => onOpen(document)}
      onKeyDown={onKeyDown}
    >
      <div className="doc-thumb">
        {document.hasThumbnail && !imageFailed ? (
          <img
            className={`doc-thumb-image ${document.kind === 'pdf' ? 'is-pdf' : 'is-image'}`}
            src={thumbnailUrl}
            alt=""
            draggable={false}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : document.kind === 'pdf' ? (
          <PdfCover document={document} />
        ) : (
          <ImageFallback document={document} />
        )}

        <span className={`type-chip type-chip-${document.kind}`}>
          {document.kind === 'pdf' ? <FileText size={11} /> : <ImageIcon size={11} />}
          {document.ext.toUpperCase()}
        </span>
      </div>

      <div className="doc-thumb-actions" onClick={stop}>
        <button
          className={`thumb-action ${document.favorite ? 'is-favorite' : ''}`}
          onClick={() => onToggleFavorite(document)}
          aria-label={document.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          title={document.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Star size={15} fill={document.favorite ? 'currentColor' : 'none'} />
        </button>
        <div className="doc-menu-wrap" ref={menuRef}>
          <button
            className="thumb-action"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Plus d’actions"
            aria-expanded={menuOpen}
            title="Plus d’actions"
          >
            <Ellipsis size={17} />
          </button>
          {menuOpen ? (
            <div className="doc-menu" role="menu" onClick={stop}>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onRename(document)
                }}
              >
                <Pencil size={14} />
                Renommer
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onReveal(document)
                }}
              >
                <FolderSearch size={14} />
                Afficher dans le dossier
              </button>
              <div className="doc-menu-separator" />
              <button
                className="doc-menu-danger"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(document)
                }}
              >
                <Trash2 size={14} />
                Supprimer
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="doc-info">
        <div className="doc-title-row">
          <h3 title={document.name}>{document.name}</h3>
          {document.favorite ? (
            <span className="favorite-dot" title="Favori" aria-label="Favori">
              <Star size={12} fill="currentColor" />
            </span>
          ) : null}
        </div>
        <p className="doc-meta">{meta}</p>
        <p className="doc-date">{formatRelativeDate(document.modifiedAt)}</p>
      </div>
    </article>
  )
}
