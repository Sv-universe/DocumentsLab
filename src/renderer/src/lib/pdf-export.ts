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

export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((angle % 360) + 360) % 360
  if (normalized < 45 || normalized >= 315) return 0
  if (normalized < 135) return 90
  if (normalized < 225) return 180
  return 270
}

export function mapDisplayPoint(
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

function drawHighlight(
  page: PDFPage,
  overlay: Extract<PdfOverlay, { type: 'highlight' }>,
  rotation: 0 | 90 | 180 | 270,
  pageWidth: number,
  pageHeight: number
) {
  const rect = mapSignatureRect(
    rotation,
    pageWidth,
    pageHeight,
    overlay.x,
    overlay.y,
    overlay.width,
    overlay.height
  )
  page.drawRectangle({
    ...rect,
    color: hexToRgb(overlay.color),
    opacity: overlay.opacity
  })
}

function drawInk(
  page: PDFPage,
  overlay: Extract<PdfOverlay, { type: 'ink' }>,
  rotation: 0 | 90 | 180 | 270,
  pageWidth: number,
  pageHeight: number
) {
  const color = hexToRgb(overlay.color)
  for (let index = 1; index < overlay.points.length; index += 1) {
    const previous = overlay.points[index - 1]
    const current = overlay.points[index]
    if (!previous || !current) continue
    const start = mapDisplayPoint(
      rotation,
      pageWidth,
      pageHeight,
      overlay.x + previous.x * overlay.width,
      overlay.y + previous.y * overlay.height
    )
    const end = mapDisplayPoint(
      rotation,
      pageWidth,
      pageHeight,
      overlay.x + current.x * overlay.width,
      overlay.y + current.y * overlay.height
    )
    page.drawLine({
      start,
      end,
      thickness: overlay.strokeWidth,
      color,
      opacity: overlay.opacity
    })
  }
}

function drawShape(
  page: PDFPage,
  overlay: Extract<PdfOverlay, { type: 'shape' }>,
  rotation: 0 | 90 | 180 | 270,
  pageWidth: number,
  pageHeight: number
) {
  const color = hexToRgb(overlay.color)
  if (overlay.kind === 'rect') {
    const rect = mapSignatureRect(
      rotation,
      pageWidth,
      pageHeight,
      overlay.x,
      overlay.y,
      overlay.width,
      overlay.height
    )
    page.drawRectangle({
      ...rect,
      borderColor: color,
      borderWidth: overlay.strokeWidth,
      borderOpacity: overlay.opacity
    })
    return
  }

  const startX = overlay.flipX ? overlay.x + overlay.width : overlay.x
  const startY = overlay.flipY ? overlay.y + overlay.height : overlay.y
  const endX = overlay.flipX ? overlay.x : overlay.x + overlay.width
  const endY = overlay.flipY ? overlay.y : overlay.y + overlay.height
  const start = mapDisplayPoint(rotation, pageWidth, pageHeight, startX, startY)
  const end = mapDisplayPoint(rotation, pageWidth, pageHeight, endX, endY)
  page.drawLine({
    start,
    end,
    thickness: overlay.strokeWidth,
    color,
    opacity: overlay.opacity
  })

  const angle = Math.atan2(endY - startY, endX - startX)
  const length = Math.max(6, Math.min(18, Math.hypot(endX - startX, endY - startY) * 0.22))
  for (const offset of [Math.PI / 7, -Math.PI / 7]) {
    const headPoint = mapDisplayPoint(
      rotation,
      pageWidth,
      pageHeight,
      endX - Math.cos(angle + offset) * length,
      endY - Math.sin(angle + offset) * length
    )
    page.drawLine({
      start: end,
      end: headPoint,
      thickness: overlay.strokeWidth,
      color,
      opacity: overlay.opacity
    })
  }
}

export async function buildEditedPdf(state: PdfEditState): Promise<Uint8Array> {
  const sources = new Map<string, PDFDocument>()
  await Promise.all(
    Object.entries(state.sources).map(async ([id, source]) => {
      sources.set(id, await PDFDocument.load(source.bytes, { updateMetadata: false }))
    })
  )

  const output = await PDFDocument.create()
  const regularFont = await output.embedFont(StandardFonts.Helvetica)
  const boldFont = await output.embedFont(StandardFonts.HelveticaBold)

  for (const pageRef of state.pages) {
    const source = sources.get(pageRef.sourceId)
    if (!source) throw new Error('Une page source est introuvable.')
    const [page] = await output.copyPages(source, [pageRef.index])
    if (!page) continue
    output.addPage(page)
    const rotation = normalizeRotation(page.getRotation().angle)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()
    const overlays = state.overlays[pageRef.id] ?? []

    for (const overlay of overlays) {
      if (overlay.type === 'text') {
        await drawTextOverlay(page, overlay, rotation, pageWidth, pageHeight, regularFont, boldFont)
        continue
      }
      if (overlay.type === 'highlight') {
        drawHighlight(page, overlay, rotation, pageWidth, pageHeight)
        continue
      }
      if (overlay.type === 'ink') {
        drawInk(page, overlay, rotation, pageWidth, pageHeight)
        continue
      }
      if (overlay.type === 'shape') {
        drawShape(page, overlay, rotation, pageWidth, pageHeight)
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
