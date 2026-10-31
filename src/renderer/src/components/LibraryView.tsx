import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, LayoutGrid, List, Search, Star, StarOff, Trash2, X } from 'lucide-react'
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
import { pruneSelection, selectRange, toggleSelection } from '../lib/selection'
import { DocumentCard, type SelectionModifiers } from './DocumentCard'
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
  onSetFavoriteMany: (ids: string[], favorite: boolean) => void
  onDeleteMany: (documents: DocumentMeta[]) => void
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
  onSetFavoriteMany,
  onDeleteMany,
  onRename,
  onDelete,
  onReveal
}: LibraryViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const anchorRef = useRef<string | null>(null)

  const filtered = useMemo(
    () => filterAndSortDocuments(documents, filter, query, sort),
    [documents, filter, query, sort]
  )
  const visibleIds = useMemo(() => filtered.map((document) => document.id), [filtered])

  useEffect(() => {
    setSelected(new Set())
    anchorRef.current = null
  }, [filter, query])

  useEffect(() => {
    setSelected((current) => {
      const next = pruneSelection(current, visibleIds)
      return next.size === current.size ? current : next
    })
  }, [visibleIds])

  useEffect(() => {
    if (selected.size === 0) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(new Set())
        anchorRef.current = null
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected.size])

  const handleSelect = (document: DocumentMeta, modifiers: SelectionModifiers) => {
    if (modifiers.shiftKey) {
      setSelected(selectRange(visibleIds, anchorRef.current, document.id))
      anchorRef.current = anchorRef.current ?? document.id
      return
    }
    if (modifiers.ctrlKey || modifiers.metaKey) {
      setSelected((current) => toggleSelection(current, document.id))
      anchorRef.current = document.id
      return
    }
    setSelected(new Set())
    anchorRef.current = null
    onOpenDocument(document)
  }

  const selectedDocuments = useMemo(
    () => filtered.filter((document) => selected.has(document.id)),
    [filtered, selected]
  )
  const allFavorites =
    selectedDocuments.length > 0 && selectedDocuments.every((document) => document.favorite)

  const clearSelection = () => {
    setSelected(new Set())
    anchorRef.current = null
  }

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

      {selected.size > 0 ? (
        <div className="selection-bar" role="status">
          <div className="selection-bar-info">
            <span className="selection-count">{selected.size}</span>
            <span>
              {selected.size === 1 ? 'document sélectionné' : 'documents sélectionnés'}
            </span>
          </div>
          <div className="selection-bar-actions">
            <button
              className="button button-ghost button-small"
              onClick={() =>
                onSetFavoriteMany(
                  selectedDocuments.map((document) => document.id),
                  !allFavorites
                )
              }
            >
              {allFavorites ? <StarOff size={15} /> : <Star size={15} />}
              {allFavorites ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </button>
            <button
              className="button button-danger-ghost button-small"
              onClick={() => onDeleteMany(selectedDocuments)}
            >
              <Trash2 size={15} />
              Supprimer
            </button>
            <button
              className="icon-button icon-button-small"
              onClick={clearSelection}
              aria-label="Désélectionner"
              title="Désélectionner (Échap)"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

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
              selected={selected.has(document.id)}
              onSelect={handleSelect}
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
