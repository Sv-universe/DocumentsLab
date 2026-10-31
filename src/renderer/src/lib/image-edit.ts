export interface ImageFilters {
  brightness: number
  contrast: number
  saturation: number
  grayscale: number
}

export interface PenStroke {
  id: string
  color: string
  widthPx: number
  points: Array<{ x: number; y: number }>
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BaseImage {
  source: CanvasImageSource
  width: number
  height: number
}

export const DEFAULT_FILTERS: ImageFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0
}

export function filterString(filters: ImageFilters): string {
  return [
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`,
    `saturate(${filters.saturation}%)`,
    `grayscale(${filters.grayscale}%)`
  ].join(' ')
}

export function drawStrokes(
  context: CanvasRenderingContext2D,
  strokes: PenStroke[],
  width: number,
  height: number,
  scale = 1
) {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    context.strokeStyle = stroke.color
    context.fillStyle = stroke.color
    context.lineWidth = Math.max(0.5, stroke.widthPx * scale)
    if (stroke.points.length === 1) {
      const point = stroke.points[0]
      context.beginPath()
      context.arc(point.x * width, point.y * height, context.lineWidth / 2, 0, Math.PI * 2)
      context.fill()
      continue
    }
    context.beginPath()
    context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height)
    for (let index = 1; index < stroke.points.length; index += 1) {
      context.lineTo(stroke.points[index].x * width, stroke.points[index].y * height)
    }
    context.stroke()
  }
  context.restore()
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

export function buildCompositeCanvas(
  base: BaseImage,
  strokes: PenStroke[],
  filters: ImageFilters,
  options: { whiteBackground?: boolean; maxWidth?: number } = {}
): HTMLCanvasElement {
  const width = options.maxWidth
    ? Math.min(base.width, options.maxWidth)
    : base.width
  const scale = width / base.width
  const height = base.height * scale
  const canvas = makeCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponible.')

  if (options.whiteBackground) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.save()
  context.filter = filterString(filters)
  context.drawImage(base.source, 0, 0, canvas.width, canvas.height)
  context.restore()

  drawStrokes(context, strokes, canvas.width, canvas.height, scale)
  return canvas
}

export function thumbnailDataUrl(canvas: HTMLCanvasElement, maxWidth = 640, maxHeight = 480): string {
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height, 1)
  const thumb = makeCanvas(canvas.width * scale, canvas.height * scale)
  const context = thumb.getContext('2d')
  if (!context) throw new Error('Canvas indisponible.')
  context.drawImage(canvas, 0, 0, thumb.width, thumb.height)
  return thumb.toDataURL('image/png')
}

export function transformStrokesForRotation(
  strokes: PenStroke[],
  clockwise: boolean
): PenStroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) =>
      clockwise
        ? { x: 1 - point.y, y: point.x }
        : { x: point.y, y: 1 - point.x }
    )
  }))
}

export function transformStrokesForFlip(
  strokes: PenStroke[],
  horizontal: boolean
): PenStroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) =>
      horizontal ? { x: 1 - point.x, y: point.y } : { x: point.x, y: 1 - point.y }
    )
  }))
}

export function cropStrokes(strokes: PenStroke[], crop: CropRect): PenStroke[] {
  const result: PenStroke[] = []
  for (const stroke of strokes) {
    const points = stroke.points
      .filter(
        (point) =>
          point.x >= crop.x - 0.001 &&
          point.x <= crop.x + crop.width + 0.001 &&
          point.y >= crop.y - 0.001 &&
          point.y <= crop.y + crop.height + 0.001
      )
      .map((point) => ({
        x: (point.x - crop.x) / crop.width,
        y: (point.y - crop.y) / crop.height
      }))
    if (points.length > 0) result.push({ ...stroke, points })
  }
  return result
}
