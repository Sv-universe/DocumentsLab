export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Ko'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const formatted = value >= 10 || exponent === 0 ? Math.round(value).toString() : value.toFixed(1)
  return `${formatted.replace('.', ',')} ${units[exponent]}`
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(timestamp)
}

export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isToday) {
    return `Aujourd'hui à ${new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Hier'
  }

  return formatDate(timestamp)
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function sanitizeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripExtension(fileName: string): { base: string; ext: string } {
  const index = fileName.lastIndexOf('.')
  if (index <= 0) return { base: fileName, ext: '' }
  return { base: fileName.slice(0, index), ext: fileName.slice(index + 1).toLowerCase() }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function kindLabel(kind: 'pdf' | 'image'): string {
  return kind === 'pdf' ? 'PDF' : 'Image'
}
