import { describe, expect, it } from 'vitest'
import { pruneSelection, selectRange, toggleSelection } from './selection'

describe('sélection de bibliothèque', () => {
  it('bascule un identifiant', () => {
    const first = toggleSelection(new Set(), 'a')
    expect([...first]).toEqual(['a'])
    const second = toggleSelection(first, 'a')
    expect(second.size).toBe(0)
  })

  it('sélectionne une plage dans les deux sens', () => {
    const ids = ['a', 'b', 'c', 'd']
    expect([...selectRange(ids, 'b', 'd')]).toEqual(['b', 'c', 'd'])
    expect([...selectRange(ids, 'd', 'b')]).toEqual(['b', 'c', 'd'])
  })

  it('retombe sur la cible sans ancre ou avec une ancre absente', () => {
    const ids = ['a', 'b']
    expect([...selectRange(ids, null, 'b')]).toEqual(['b'])
    expect([...selectRange(ids, 'z', 'a')]).toEqual(['a'])
    expect([...selectRange([], 'a', 'b')]).toEqual(['b'])
  })

  it('élague les identifiants qui ne sont plus affichés', () => {
    expect([...pruneSelection(new Set(['a', 'b', 'c']), ['b', 'c', 'd'])]).toEqual(['b', 'c'])
  })
})
