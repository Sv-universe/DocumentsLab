import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { mapDisplayPoint, mapSignatureRect, normalizeRotation, buildEditedPdf } from './pdf-export'
import { createPageRef } from './pdf-types'

describe('géométrie PDF', () => {
  it('normalise les rotations par quart de tour', () => {
    expect(normalizeRotation(0)).toBe(0)
    expect(normalizeRotation(90)).toBe(90)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(450)).toBe(90)
  })

  it('convertit un point pour les quatre rotations', () => {
    const point = { x: 100, y: 200 }
    expect(mapDisplayPoint(0, 600, 800, point.x, point.y)).toEqual({ x: 100, y: 600 })
    expect(mapDisplayPoint(90, 600, 800, point.x, point.y)).toEqual({ x: 200, y: 100 })
    expect(mapDisplayPoint(180, 600, 800, point.x, point.y)).toEqual({ x: 500, y: 600 })
    expect(mapDisplayPoint(270, 600, 800, point.x, point.y)).toEqual({ x: 400, y: 700 })
  })

  it('convertit un rectangle en échangeant largeur et hauteur à 90°', () => {
    const rect = mapSignatureRect(90, 600, 800, 100, 200, 120, 60)
    expect(rect.width).toBe(60)
    expect(rect.height).toBe(120)
    expect(rect.x).toBe(200)
    expect(rect.y).toBe(100)
  })

  it('exporte toutes les pages dans l’ordre demandé', async () => {
    const source = await PDFDocument.create()
    for (let index = 0; index < 120; index += 1) {
      const page = source.addPage([300, 400])
      page.drawText(`Page ${index + 1}`, { x: 20, y: 380, size: 12 })
    }
    const bytes = await source.save()
    const pages = Array.from({ length: 120 }, (_, index) =>
      createPageRef('main', 119 - index)
    )
    const output = await buildEditedPdf({
      pages,
      overlays: {},
      sources: { main: { bytes, label: 'test.pdf' } }
    })
    const result = await PDFDocument.load(output)
    expect(result.getPageCount()).toBe(120)
  })

  it('exporte uniquement les pages extraites', async () => {
    const source = await PDFDocument.create()
    for (let index = 0; index < 10; index += 1) source.addPage([300, 400])
    const bytes = await source.save()
    const pages = [createPageRef('main', 1), createPageRef('main', 6)]
    const output = await buildEditedPdf({
      pages,
      overlays: {},
      sources: { main: { bytes, label: 'test.pdf' } }
    })
    const result = await PDFDocument.load(output)
    expect(result.getPageCount()).toBe(2)
  })
})
