import type { BaseImage, ImageFilters, PenStroke } from './image-edit'

export interface ImageSnapshot {
  base: BaseImage
  strokes: PenStroke[]
  filters: ImageFilters
}

export const IMAGE_HISTORY_LIMIT = 20
export const IMAGE_HISTORY_BUDGET_BYTES = 256 * 1024 * 1024

function canvasBytes(base: BaseImage): number {
  return Math.max(0, Math.round(base.width * base.height * 4))
}

/**
 * Les snapshots partagent le même canvas tant qu’aucune transformation
 * n’est intervenue : on ne compte donc chaque source qu’une seule fois.
 */
export function historyBytes(entries: readonly ImageSnapshot[]): number {
  const seen = new Set<CanvasImageSource>()
  let total = 0
  for (const entry of entries) {
    if (seen.has(entry.base.source)) continue
    seen.add(entry.base.source)
    total += canvasBytes(entry.base)
  }
  return total
}

export function pushImageHistory(
  entries: readonly ImageSnapshot[],
  snapshot: ImageSnapshot
): ImageSnapshot[] {
  const next = [...entries, snapshot]
  while (
    next.length > 1 &&
    (next.length > IMAGE_HISTORY_LIMIT ||
      historyBytes(next) > IMAGE_HISTORY_BUDGET_BYTES)
  ) {
    next.shift()
  }
  return next
}
