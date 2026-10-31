import { describe, expect, it } from 'vitest'
import { extensionOf, isSupportedExtension } from './constants'

describe('smoke', () => {
  it('extrait une extension et reconnaît un format pris en charge', () => {
    expect(extensionOf('Documents/Contrat.PDF')).toBe('pdf')
    expect(isSupportedExtension('pdf')).toBe(true)
    expect(isSupportedExtension('docx')).toBe(false)
  })
})
