import type { SortMode, ViewMode } from './library'

export interface LibraryPreferences {
  sort: SortMode
  viewMode: ViewMode
}

export const LIBRARY_PREFERENCES_KEY = 'doclab.library.preferences'

export const DEFAULT_LIBRARY_PREFERENCES: LibraryPreferences = {
  sort: 'modified',
  viewMode: 'grid'
}

const SORT_MODES: readonly SortMode[] = ['modified', 'created', 'name']
const VIEW_MODES: readonly ViewMode[] = ['grid', 'list']

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function parseLibraryPreferences(raw: string | null): LibraryPreferences {
  if (!raw) return { ...DEFAULT_LIBRARY_PREFERENCES }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_LIBRARY_PREFERENCES }
    const value = parsed as Partial<Record<keyof LibraryPreferences, unknown>>
    return {
      sort: SORT_MODES.includes(value.sort as SortMode)
        ? (value.sort as SortMode)
        : DEFAULT_LIBRARY_PREFERENCES.sort,
      viewMode: VIEW_MODES.includes(value.viewMode as ViewMode)
        ? (value.viewMode as ViewMode)
        : DEFAULT_LIBRARY_PREFERENCES.viewMode
    }
  } catch {
    return { ...DEFAULT_LIBRARY_PREFERENCES }
  }
}

export function loadLibraryPreferences(
  storage: StorageLike | null = defaultStorage()
): LibraryPreferences {
  if (!storage) return { ...DEFAULT_LIBRARY_PREFERENCES }
  try {
    return parseLibraryPreferences(storage.getItem(LIBRARY_PREFERENCES_KEY))
  } catch {
    return { ...DEFAULT_LIBRARY_PREFERENCES }
  }
}

export function saveLibraryPreferences(
  preferences: LibraryPreferences,
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage) return
  try {
    storage.setItem(
      LIBRARY_PREFERENCES_KEY,
      JSON.stringify({ sort: preferences.sort, viewMode: preferences.viewMode })
    )
  } catch {
    // Une préférence non persistée ne doit jamais empêcher l’édition.
  }
}
