export type DocumentKind = 'pdf' | 'image'

export type ImageFormat = 'png' | 'jpg' | 'webp'

export interface DocumentMeta {
  id: string
  /** Display name, without the extension. */
  name: string
  /** Lowercase extension, without the dot. */
  ext: string
  kind: DocumentKind
  size: number
  createdAt: number
  modifiedAt: number
  favorite: boolean
  hasThumbnail: boolean
  pageCount?: number
  width?: number
  height?: number
}

export interface FileIssue {
  path: string
  message: string
}

export interface ImportReport {
  documents: DocumentMeta[]
  issues: FileIssue[]
}

export interface ExternalDocument {
  path: string
  name: string
  ext: string
  kind: DocumentKind
  size: number
  pageCount?: number
  width?: number
  height?: number
}

export interface OpenDialogResult {
  canceled: boolean
  files: ExternalDocument[]
}

export interface SaveFileRequest {
  defaultName: string
  data: Uint8Array
  /** Used to select the extension filter and ensure the right extension. */
  format: 'pdf' | ImageFormat
}

export interface SaveFileResult {
  canceled: boolean
  filePath?: string
}

export interface ReplaceDocumentRequest {
  id: string
  data: Uint8Array
  pageCount?: number
  width?: number
  height?: number
}

export interface UpdateDocumentPatch {
  name?: string
  favorite?: boolean
}

export interface WindowState {
  maximized: boolean
}

export interface DoclabApi {
  getLibrary: () => Promise<DocumentMeta[]>
  importDocuments: () => Promise<ImportReport>
  importPaths: (paths: string[]) => Promise<ImportReport>
  readDocument: (id: string) => Promise<Uint8Array>
  replaceDocument: (request: ReplaceDocumentRequest) => Promise<DocumentMeta>
  saveThumbnail: (id: string, dataUrl: string) => Promise<DocumentMeta>
  updateDocument: (id: string, patch: UpdateDocumentPatch) => Promise<DocumentMeta>
  deleteDocument: (id: string) => Promise<void>
  revealDocument: (id: string) => Promise<void>
  openFileDialog: () => Promise<OpenDialogResult>
  readExternal: (path: string) => Promise<Uint8Array>
  saveFile: (request: SaveFileRequest) => Promise<SaveFileResult>
  getPathForFile: (file: unknown) => string
  getAppVersion: () => Promise<string>
  minimizeWindow: () => void
  toggleMaximizeWindow: () => void
  closeWindow: () => void
  isWindowMaximized: () => Promise<boolean>
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void
}
