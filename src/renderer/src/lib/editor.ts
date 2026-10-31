import type { DocumentKind, DocumentMeta, ExternalDocument } from '@shared/types'

export type EditorSource =
  | { kind: 'library'; meta: DocumentMeta; bytes: Uint8Array }
  | { kind: 'external'; file: ExternalDocument; bytes: Uint8Array }

export type NoticeTone = 'success' | 'error' | 'info'

export type Notify = (message: string, tone?: NoticeTone, detail?: string) => void

export function sourceName(source: EditorSource): string {
  return source.kind === 'library' ? source.meta.name : source.file.name
}

export function sourceExt(source: EditorSource): string {
  return source.kind === 'library' ? source.meta.ext : source.file.ext
}

export function sourceKind(source: EditorSource): DocumentKind {
  return source.kind === 'library' ? source.meta.kind : source.file.kind
}

export function sourcePath(source: EditorSource): string | undefined {
  return source.kind === 'external' ? source.file.path : undefined
}

export function sourceMeta(source: EditorSource): DocumentMeta | undefined {
  return source.kind === 'library' ? source.meta : undefined
}

export function imageExportFormat(ext: string): 'png' | 'jpg' | 'webp' {
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  if (ext === 'webp') return 'webp'
  return 'png'
}
