import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, type BaseImage } from './image-edit'
import {
  IMAGE_HISTORY_LIMIT,
  historyBytes,
  pushImageHistory,
  type ImageSnapshot
} from './image-history'

function snapshot(width: number, height: number, source = {}): ImageSnapshot {
  const base = { source, width, height } as unknown as BaseImage
  return { base, strokes: [], filters: { ...DEFAULT_FILTERS } }
}

describe('historique image', () => {
  it('borne la profondeur à vingt opérations', () => {
    let history: ImageSnapshot[] = []
    for (let index = 0; index < IMAGE_HISTORY_LIMIT + 5; index += 1) {
      history = pushImageHistory(history, snapshot(2, 2, { index }))
    }
    expect(history).toHaveLength(IMAGE_HISTORY_LIMIT)
    expect((history[0]?.base.source as unknown as { index: number }).index).toBe(5)
  })

  it('évince les snapshots les plus anciens quand le budget mémoire est dépassé', () => {
    let history: ImageSnapshot[] = []
    for (let index = 0; index < 5; index += 1) {
      history = pushImageHistory(history, snapshot(4096, 4096, { index }))
    }
    expect(history.length).toBeLessThan(5)
    expect((history.at(-1)?.base.source as unknown as { index: number }).index).toBe(4)
    expect(historyBytes(history)).toBeLessThanOrEqual(256 * 1024 * 1024)
  })

  it('ne compte qu’une fois un canvas partagé', () => {
    const shared = {}
    const history = [snapshot(100, 100, shared), snapshot(100, 100, shared)]
    expect(historyBytes(history)).toBe(100 * 100 * 4)
  })

  it('conserve toujours au moins un snapshot même s’il dépasse le budget', () => {
    const history = pushImageHistory([], snapshot(16000, 16000))
    expect(history).toHaveLength(1)
  })
})
