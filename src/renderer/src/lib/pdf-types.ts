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

export type PdfOverlay = TextOverlay | SignatureOverlay

export interface PdfEditState {
  pageOrder: number[]
  overlays: Record<number, PdfOverlay[]>
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
