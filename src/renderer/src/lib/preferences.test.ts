import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIBRARY_PREFERENCES,
  LIBRARY_PREFERENCES_KEY,
  loadLibraryPreferences,
  parseLibraryPreferences,
  saveLibraryPreferences,
  type StorageLike
} from './preferences'

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

describe('préférences de bibliothèque', () => {
  it('retombe sur les valeurs par défaut quand rien n’est stocké', () => {
    expect(parseLibraryPreferences(null)).toEqual(DEFAULT_LIBRARY_PREFERENCES)
  })

  it('ignore les valeurs invalides et le JSON illisible', () => {
    expect(parseLibraryPreferences('{"sort":"inconnu","viewMode":"mosaic"}')).toEqual(
      DEFAULT_LIBRARY_PREFERENCES
    )
    expect(parseLibraryPreferences('{')).toEqual(DEFAULT_LIBRARY_PREFERENCES)
  })

  it('relit une préférence écrite', () => {
    const storage = memoryStorage()
    saveLibraryPreferences({ sort: 'name', viewMode: 'list' }, storage)
    expect(storage.values.get(LIBRARY_PREFERENCES_KEY)).toBeTruthy()
    expect(loadLibraryPreferences(storage)).toEqual({ sort: 'name', viewMode: 'list' })
  })

  it('accepte un stockage absent', () => {
    expect(loadLibraryPreferences(null)).toEqual(DEFAULT_LIBRARY_PREFERENCES)
    expect(() => saveLibraryPreferences(DEFAULT_LIBRARY_PREFERENCES, null)).not.toThrow()
  })
})
