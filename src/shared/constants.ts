export const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'avif'
] as const

export const PDF_EXTENSION = 'pdf'

export const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, PDF_EXTENSION]

export const IMAGE_FILE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] }
]

export const PDF_FILE_FILTERS = [{ name: 'Documents PDF', extensions: ['pdf'] }]

export const ALL_FILE_FILTERS = [
  { name: 'Documents pris en charge', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] },
  ...PDF_FILE_FILTERS,
  ...IMAGE_FILE_FILTERS
]

export function extensionOf(filePath: string): string {
  const index = filePath.lastIndexOf('.')
  if (index < 0 || index === filePath.length - 1) return ''
  return filePath.slice(index + 1).toLowerCase()
}

export function isSupportedExtension(ext: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)
}

export function isImageExtension(ext: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext)
}
