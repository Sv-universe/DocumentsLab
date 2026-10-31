import type { DocumentMeta } from '@shared/types'

export type LibraryFilter = 'all' | 'pdf' | 'image' | 'favorites'
export type SortMode = 'modified' | 'created' | 'name'
export type ViewMode = 'grid' | 'list'

export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function filterAndSortDocuments(
  documents: DocumentMeta[],
  filter: LibraryFilter,
  query: string,
  sort: SortMode
): DocumentMeta[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
  const filtered = documents.filter((document) => {
    if (filter === 'pdf' && document.kind !== 'pdf') return false
    if (filter === 'image' && document.kind !== 'image') return false
    if (filter === 'favorites' && !document.favorite) return false
    if (terms.length === 0) return true
    const haystack = normalizeSearch(`${document.name} ${document.ext}`)
    return terms.every((term) => haystack.includes(term))
  })

  return filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    if (sort === 'created') return b.createdAt - a.createdAt
    return b.modifiedAt - a.modifiedAt
  })
}

export const FILTER_LABELS: Record<LibraryFilter, string> = {
  all: 'Tous les documents',
  pdf: 'Documents PDF',
  image: 'Images',
  favorites: 'Favoris'
}

export function totalSize(documents: DocumentMeta[]): number {
  return documents.reduce((sum, document) => sum + document.size, 0)
}
