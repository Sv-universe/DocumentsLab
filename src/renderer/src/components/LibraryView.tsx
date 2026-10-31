import { useMemo } from 'react'
import { ChevronDown, LayoutGrid, List, Search, X } from 'lucide-react'
import type { DocumentMeta } from '@shared/types'
import { formatBytes, pluralize } from '../lib/format'
import {
  FILTER_LABELS,
  filterAndSortDocuments,
  totalSize,
  type LibraryFilter,
  type SortMode,
  type ViewMode
} from '../lib/library'
import { DocumentCard } from './DocumentCard'
import { EmptyState } from './EmptyState'

interface LibraryViewProps {
  documents: DocumentMeta[]
  filter: LibraryFilter
  query: string
  sort: SortMode
  viewMode: ViewMode
  importing: boolean
  loading: boolean
  onQueryChange: (query: string) => void
  onSortChange: (sort: SortMode) => void
  onViewModeChange: (mode: ViewMode) => void
  onImport: () => void
  onOpen: () => void
  onReset: () => void
  onOpenDocument: (document: DocumentMeta) => void
  onToggleFavorite: (document: DocumentMeta) => void
  onRename: (document: DocumentMeta) => void
  onDelete: (document: DocumentMeta) => void
  onReveal: (document: DocumentMeta) => void
}

export function LibraryView({
  documents,
  filter,
  query,
  sort,
  viewMode,
  importing,
  loading,
  onQueryChange,
  onSortChange,
  onViewModeChange,
  onImport,
  onOpen,
  onReset,
  onOpenDocument,
  onToggleFavorite,
  onRename,
  onDelete,
  onReveal
}: LibraryViewProps) {
  const filtered = useMemo(
    () => filterAndSortDocuments(documents, filter, query, sort),
    [documents, filter, query, sort]
  )

  const filteredSize = totalSize(filtered)
  const title = FILTER_LABELS[filter]

  return (
    <section className="library">
      <header className="library-header">
        <div className="library-heading">
          <p className="eyebrow">Votre bibliothèque</p>
          <h1>{title}</h1>
          <p className="library-subtitle">
            {loading
              ? 'Ouverture de votre atelier…'
              : `${pluralize(filtered.length, 'document')} · ${formatBytes(filteredSize)}`}
          </p>
        </div>

        <div className="library-tools">
          <label className="search-field">
            <Search size={16} strokeWidth={2} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Rechercher un document…"
              aria-label="Rechercher un document"
            />
            {query ? (
              <button
                className="search-clear"
                onClick={() => onQueryChange('')}
                aria-label="Effacer la recherche"
              >
                <X size={13} />
              </button>
            ) : null}
          </label>

          <label className="select-field" aria-label="Trier les documents">
            <select value={sort} onChange={(event) => onSortChange(event.target.value as SortMode)}>
              <option value="modified">Modifiés récemment</option>
              <option value="created">Ajoutés récemment</option>
              <option value="name">Nom (A–Z)</option>
            </select>
            <ChevronDown size={14} />
          </label>

          <div className="view-toggle" role="group" aria-label="Mode d’affichage">
            <button
              className={viewMode === 'grid' ? 'is-active' : ''}
              onClick={() => onViewModeChange('grid')}
              aria-label="Affichage en grille"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className={viewMode === 'list' ? 'is-active' : ''}
              onClick={() => onViewModeChange('list')}
              aria-label="Affichage en liste"
              aria-pressed={viewMode === 'list'}
            >
              <List size={17} />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="doc-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="doc-skeleton" key={index} style={{ animationDelay: `${index * 70}ms` }}>
              <div className="skeleton-thumb" />
              <div className="skeleton-line skeleton-line-title" />
              <div className="skeleton-line" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          filter={filter}
          hasDocuments={documents.length > 0}
          importing={importing}
          onImport={onImport}
          onOpen={onOpen}
          onReset={onReset}
        />
      ) : (
        <div className={`doc-collection doc-${viewMode}`}>
          {filtered.map((document, index) => (
            <DocumentCard
              key={document.id}
              document={document}
              index={index}
              viewMode={viewMode}
              onOpen={onOpenDocument}
              onToggleFavorite={onToggleFavorite}
              onRename={onRename}
              onDelete={onDelete}
              onReveal={onReveal}
            />
          ))}
        </div>
      )}
    </section>
  )
}
