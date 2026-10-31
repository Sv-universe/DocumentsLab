import type { ImageFormat } from '@shared/types'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Impossible de charger cette image.'))
    image.src = src
  })
}

export async function imageFromBytes(bytes: Uint8Array, mime: string): Promise<HTMLImageElement> {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const blob = new Blob([buffer], { type: mime })
  const url = URL.createObjectURL(blob)
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('Données d’image invalides.')
  const base64 = dataUrl.slice(comma + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Impossible de lire ce fichier.'))
    reader.readAsDataURL(file)
  })
}

export async function rotateDataUrl(dataUrl: string, degrees: 0 | 90 | 180 | 270): Promise<string> {
  if (degrees === 0) return dataUrl
  const image = await loadImage(dataUrl)
  const swapped = degrees === 90 || degrees === 270
  const width = swapped ? image.naturalHeight : image.naturalWidth
  const height = swapped ? image.naturalWidth : image.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponible.')

  if (degrees === 90) {
    context.translate(0, height)
    context.rotate(-Math.PI / 2)
  } else if (degrees === 180) {
    context.translate(width, height)
    context.rotate(Math.PI)
  } else {
    context.translate(width, 0)
    context.rotate(Math.PI / 2)
  }
  context.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

export function formatToMime(format: ImageFormat): string {
  if (format === 'jpg') return 'image/jpeg'
  if (format === 'webp') return 'image/webp'
  return 'image/png'
}

export function mimeForExtension(ext: string): string {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'bmp') return 'image/bmp'
  if (ext === 'avif') return 'image/avif'
  return 'image/png'
}

export async function canvasToBytes(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality = 0.92
): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, formatToMime(format), format === 'png' ? undefined : quality)
  })
  if (!blob) throw new Error('Impossible de générer l’image.')
  return new Uint8Array(await blob.arrayBuffer())
}

export function copyToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponible.')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}
