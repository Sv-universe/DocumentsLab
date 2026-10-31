import { describe, expect, it } from 'vitest'
import {
  createPageRef,
  duplicatePageRef,
  extractPageRefs,
  insertPageRefs
} from './pdf-types'

describe('références de pages PDF', () => {
  it('insère des pages après la page courante', () => {
    const pages = [createPageRef('main', 0), createPageRef('main', 2)]
    const inserted = [createPageRef('other', 0), createPageRef('other', 1)]
    const result = insertPageRefs(pages, 0, inserted)
    expect(result.map((page) => page.index)).toEqual([0, 0, 1, 2])
    expect(result[1]?.sourceId).toBe('other')
  })

  it('duplique une page avec un identifiant distinct', () => {
    const page = createPageRef('main', 3)
    const copy = duplicatePageRef(page)
    expect(copy.id).not.toBe(page.id)
    expect(copy.index).toBe(page.index)
    expect(copy.sourceId).toBe(page.sourceId)
  })

  it('extrait les pages dans l’ordre d’affichage', () => {
    const pages = Array.from({ length: 5 }, (_, index) => createPageRef('main', index))
    const extracted = extractPageRefs(pages, new Set([4, 1]))
    expect(extracted.map((page) => page.index)).toEqual([1, 4])
  })

  it('retourne une liste vide sans sélection', () => {
    expect(extractPageRefs([createPageRef('main', 0)], new Set())).toEqual([])
  })
})
