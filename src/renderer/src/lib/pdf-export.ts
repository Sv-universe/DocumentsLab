import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage
} from 'pdf-lib'
import type { PdfEditState, PdfOverlay } from './pdf-types'
import { dataUrlToBytes, rotateDataUrl } from './image'

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((character) => character + character).join('')
    : normalized
  const number = Number.parseInt(value, 16)
  if (Number.isNaN(number)) return rgb(0.1, 0.1, 0.1)
  return rgb(
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255
  )
}

function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((angle % 360) + 360) % 360
  if (normalized < 45 || normalized >= 315) return 0
  if (normalized < 135) return 90
  if (normalized < 225) return 180
  return 270
}

function mapDisplayPoint(
  rotation: 0 | 90 | 180 | 270,
  pageWidth: number,
  pageHeight: number,
  x: number,
  y: number
): { x: number; y: number } {
  if (rotation === 90) return { x: y, y: x }
  if (rotation === 180) return { x: pageWidth - x, y: pageHeight - y }
  if (rotation === 270) return { x: pageWidth - y, y: pageHeight - x }
  return { x, y: pageHeight - y }
}

export interface SignatureRect {
  x: number
  y: number
  width: number
  height: number
}

export function mapSignatureRect(
  rotation: 0 | 90 | 180 | 270,
  pageWidth: number,
  pageHeight: number,
  x: number,
  y: number,
  width: number,
  height: number
): SignatureRect {
  if (rotation === 90) {
    return { x: y, y: x, width: height, height: width }
  }
  if (rotation === 180) {
    return {
      x: pageWidth - x - width,
      y: pageHeight - y - height,
      width,
      height
    }
  }
  if (rotation === 270) {
    return {
      x: pageWidth - y - height,
      y: pageHeight - x - width,
      width: height,
      height: width
    }
  }
  return { x, y: pageHeight - y - height, width, height }
}

async function drawTextOverlay(
  page: PDFPage,
  overlay: Extract<PdfOverlay, { type: 'text' }>,
  rotation: 0 | 90 | 180 | 270,
  pageWidth: number,
  pageHeight: number,
  font: PDFFont,
  boldFont: PDFFont
) {
  const selectedFont = overlay.bold ? boldFont : font
  const color = hexToRgb(overlay.color)
  const lineHeight = overlay.fontSize * 1.26
  const lines = overlay.text.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const baselineY = overlay.y + overlay.fontSize * 0.82 + index * lineHeight
    const point = mapDisplayPoint(rotation, pageWidth, pageHeight, overlay.x, baselineY)
    page.drawText(lines[index] ?? '', {
      x: point.x,
      y: point.y,
      size: overlay.fontSize,
      font: selectedFont,
      color,
      rotate: degrees(rotation)
    })
  }
}

export async function buildEditedPdf(
  originalBytes: Uint8Array,
  state: PdfEditState
): Promise<Uint8Array> {
  const source = await PDFDocument.load(originalBytes, { updateMetadata: false })
  const output = await PDFDocument.create()
  const regularFont = await output.embedFont(StandardFonts.Helvetica)
  const boldFont = await output.embedFont(StandardFonts.HelveticaBold)
  const pages = await output.copyPages(source, state.pageOrder)

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    output.addPage(page)
    const originalIndex = state.pageOrder[index]
    const sourcePage = source.getPage(originalIndex)
    const rotation = normalizeRotation(sourcePage.getRotation().angle)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()
    const overlays = state.overlays[originalIndex] ?? []

    for (const overlay of overlays) {
      if (overlay.type === 'text') {
        await drawTextOverlay(page, overlay, rotation, pageWidth, pageHeight, regularFont, boldFont)
        continue
      }

      const preparedSource = await rotateDataUrl(overlay.src, rotation)
      const image = await output.embedPng(dataUrlToBytes(preparedSource))
      const rect = mapSignatureRect(
        rotation,
        pageWidth,
        pageHeight,
        overlay.x,
        overlay.y,
        overlay.width,
        overlay.height
      )
      page.drawImage(image, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      })
    }
  }

  return output.save()
}
