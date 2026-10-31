import { describe, expect, it } from 'vitest'
import {
  constrainCropToAspect,
  fitCropToAspect,
  normalizedCropAspect,
  type CropRect
} from './image-edit'

const crop: CropRect = { x: 0.1, y: 0.1, width: 0.8, height: 0.5 }

describe('recadrage avec ratio', () => {
  it('convertit un ratio en ratio normalisé selon l’image', () => {
    expect(normalizedCropAspect(1, 2000, 1000)).toBeCloseTo(0.5)
  })

  it('ajuste une zone centrée au ratio demandé', () => {
    const fitted = fitCropToAspect(crop, 1)
    expect(fitted.width / fitted.height).toBeCloseTo(1)
    expect(fitted.x + fitted.width / 2).toBeCloseTo(0.5)
    expect(fitted.y + fitted.height / 2).toBeCloseTo(0.35)
  })

  it('conserve le ratio pendant le redimensionnement d’un coin', () => {
    const constrained = constrainCropToAspect(
      { x: 0.2, y: 0.2, width: 0.5, height: 0.3 },
      1,
      'se'
    )
    expect(constrained.width / constrained.height).toBeCloseTo(1)
    expect(constrained.x).toBeCloseTo(0.2)
    expect(constrained.y).toBeCloseTo(0.2)
  })

  it('ne modifie pas une zone déplacée', () => {
    expect(constrainCropToAspect(crop, 1, 'move')).toEqual(crop)
  })
})
