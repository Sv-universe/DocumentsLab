import type { DocumentMeta } from '@shared/types'

export function updateDocumentInList(
  documents: DocumentMeta[],
  updated: DocumentMeta
): DocumentMeta[] {
  return documents.map((document) => (document.id === updated.id ? updated : document))
}
