export interface TextOverlay {
  id: string
  type: 'text'
  x: number
  y: number
  text: string
  fontSize: number
  color: string
  bold: boolean
}

export interface SignatureOverlay {
  id: string
  type: 'signature'
  x: number
  y: number
  width: number
  height: number
  src: string
  aspect: number
}

export interface HighlightOverlay {
  id: string
  type: 'highlight'
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
}

export interface InkOverlay {
  id: string
  type: 'ink'
  x: number
  y: number
  width: number
  height: number
  /** Points normalisés (0–1) dans la boîte englobante. */
  points: Array<{ x: number; y: number }>
  color: string
  strokeWidth: number
  opacity: number
}

export interface ShapeOverlay {
  id: string
  type: 'shape'
  kind: 'rect' | 'arrow'
  x: number
  y: number
  width: number
  height: number
  color: string
  strokeWidth: number
  opacity: number
  flipX?: boolean
  flipY?: boolean
}

export type AnnotationOverlay = HighlightOverlay | InkOverlay | ShapeOverlay

export type PdfOverlay = TextOverlay | SignatureOverlay | AnnotationOverlay

export interface PageRef {
  /** Identifiant unique de l’instance de page (une duplication crée un nouvel id). */
  id: string
  sourceId: string
  index: number
}

export interface PdfSource {
  bytes: Uint8Array
  label: string
}

export interface PdfEditState {
  pages: PageRef[]
  overlays: Record<string, PdfOverlay[]>
  sources: Record<string, PdfSource>
}

export interface SignatureAsset {
  src: string
  aspect: number
}

export function findOverlay(
  state: PdfEditState,
  id: string | null
): PdfOverlay | null {
  if (!id) return null
  for (const overlays of Object.values(state.overlays)) {
    const overlay = overlays.find((entry) => entry.id === id)
    if (overlay) return overlay
  }
  return null
}

export function createPageRef(sourceId: string, index: number): PageRef {
  return { id: `page-${crypto.randomUUID()}`, sourceId, index }
}

export function duplicatePageRef(page: PageRef): PageRef {
  return { ...page, id: `page-${crypto.randomUUID()}` }
}

export function insertPageRefs(
  pages: readonly PageRef[],
  afterIndex: number,
  refs: readonly PageRef[]
): PageRef[] {
  const next = [...pages]
  next.splice(afterIndex + 1, 0, ...refs)
  return next
}

export function extractPageRefs(
  pages: readonly PageRef[],
  indices: ReadonlySet<number>
): PageRef[] {
  return pages.filter((_, index) => indices.has(index))
}
