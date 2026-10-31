import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  shell
} from 'electron'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import type {
  DocumentMeta,
  ExternalDocument,
  ImportReport,
  OpenDialogResult,
  ReplaceDocumentRequest,
  SaveFileRequest,
  SaveFileResult,
  UpdateDocumentPatch
} from '@shared/types'
import {
  ALL_FILE_FILTERS,
  extensionOf,
  isSupportedExtension,
  PDF_EXTENSION
} from '@shared/constants'

app.setName('DocumentsLab')
if (process.env.DOCLAB_USER_DATA) {
  app.setPath('userData', process.env.DOCLAB_USER_DATA)
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'doclab',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

let mainWindow: BrowserWindow | null = null
let libraryDirectory = ''
let thumbnailDirectory = ''
let indexFile = ''
let documents: DocumentMeta[] = []

function showOpenDialog(options: Electron.OpenDialogOptions) {
  return mainWindow ? dialog.showOpenDialog(mainWindow, options) : dialog.showOpenDialog(options)
}

function showSaveDialog(options: Electron.SaveDialogOptions) {
  return mainWindow ? dialog.showSaveDialog(mainWindow, options) : dialog.showSaveDialog(options)
}

function documentFilePath(doc: DocumentMeta): string {
  return join(libraryDirectory, `${doc.id}.${doc.ext}`)
}

function thumbnailFilePath(id: string): string {
  return join(thumbnailDirectory, `${id}.png`)
}

function uniqueName(base: string, ext: string): string {
  const trimmed = base.trim() || 'Document'
  const used = new Set(
    documents
      .filter((document) => document.ext === ext)
      .map((document) => document.name.toLocaleLowerCase('fr'))
  )
  if (!used.has(trimmed.toLocaleLowerCase('fr'))) return trimmed
  let index = 2
  while (used.has(`${trimmed} (${index})`.toLocaleLowerCase('fr'))) index += 1
  return `${trimmed} (${index})`
}

function sanitizeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
}

async function ensureStore(): Promise<void> {
  const userData = app.getPath('userData')
  libraryDirectory = join(userData, 'library')
  thumbnailDirectory = join(userData, 'thumbnails')
  indexFile = join(userData, 'library.json')
  await fs.mkdir(libraryDirectory, { recursive: true })
  await fs.mkdir(thumbnailDirectory, { recursive: true })

  try {
    const raw = await fs.readFile(indexFile, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      documents = parsed.filter(isDocumentMeta).map((document) => ({
        ...document,
        favorite: Boolean(document.favorite),
        hasThumbnail: Boolean(document.hasThumbnail)
      }))
    }
  } catch {
    documents = []
  }

  const alive: DocumentMeta[] = []
  await Promise.all(
    documents.map(async (document) => {
      try {
        await fs.access(documentFilePath(document))
        const hasThumbnail = await fileExists(thumbnailFilePath(document.id))
        alive.push({ ...document, hasThumbnail })
      } catch {
        // Le fichier source n'existe plus : on retire l'entrée de la bibliothèque.
      }
    })
  )
  documents = alive.sort((a, b) => b.modifiedAt - a.modifiedAt)
  await saveIndex()
}

function isDocumentMeta(value: unknown): value is DocumentMeta {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DocumentMeta>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.ext === 'string' &&
    (candidate.kind === 'pdf' || candidate.kind === 'image') &&
    typeof candidate.size === 'number' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.modifiedAt === 'number'
  )
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function saveIndex(): Promise<void> {
  const temporary = `${indexFile}.tmp`
  await fs.writeFile(temporary, JSON.stringify(documents, null, 2), 'utf8')
  await fs.rename(temporary, indexFile)
}

function findDocument(id: string): DocumentMeta {
  const document = documents.find((entry) => entry.id === id)
  if (!document) throw new Error('Document introuvable.')
  return document
}

async function readPdfPageCount(filePath: string): Promise<number | undefined> {
  try {
    const bytes = await fs.readFile(filePath)
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    return pdf.getPageCount()
  } catch {
    return undefined
  }
}

function readImageSize(filePath: string): { width: number; height: number } | undefined {
  try {
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return undefined
    const size = image.getSize()
    if (!size.width || !size.height) return undefined
    return size
  } catch {
    return undefined
  }
}

async function createImageThumbnail(filePath: string, id: string): Promise<boolean> {
  try {
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return false
    const { width, height } = image.getSize()
    if (!width || !height) return false
    const scale = Math.min(640 / width, 480 / height, 1)
    const resized = image.resize({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      quality: 'best'
    })
    await fs.writeFile(thumbnailFilePath(id), resized.toPNG())
    return true
  } catch {
    return false
  }
}

async function collectFiles(inputPath: string, depth = 0): Promise<string[]> {
  const stat = await fs.stat(inputPath)
  if (stat.isFile()) {
    return isSupportedExtension(extensionOf(inputPath)) ? [inputPath] : []
  }
  if (!stat.isDirectory() || depth > 5) return []

  const entries = await fs.readdir(inputPath, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (files.length > 500) break
    if (entry.name.startsWith('.')) continue
    const child = join(inputPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(child, depth + 1)))
    } else if (entry.isFile() && isSupportedExtension(extensionOf(child))) {
      files.push(child)
    }
  }
  return files
}

async function importPaths(paths: string[]): Promise<ImportReport> {
  const report: ImportReport = { documents: [], issues: [] }
  const seen = new Set<string>()
  const files: string[] = []

  for (const input of paths) {
    if (!input || seen.has(input)) continue
    seen.add(input)
    try {
      const collected = await collectFiles(input)
      if (collected.length === 0) {
        report.issues.push({ path: input, message: 'Aucun fichier compatible trouvé.' })
      }
      files.push(...collected)
    } catch (error) {
      report.issues.push({
        path: input,
        message: error instanceof Error ? error.message : 'Impossible de lire cet élément.'
      })
    }
  }

  for (const sourcePath of files.slice(0, 500)) {
    try {
      const ext = extensionOf(sourcePath)
      if (!isSupportedExtension(ext)) {
        report.issues.push({ path: sourcePath, message: 'Format non pris en charge.' })
        continue
      }
      const stat = await fs.stat(sourcePath)
      if (!stat.isFile()) continue

      const id = randomUUID()
      const destination = join(libraryDirectory, `${id}.${ext}`)
      await fs.copyFile(sourcePath, destination)

      const kind = ext === PDF_EXTENSION ? 'pdf' : 'image'
      const name = uniqueName(basename(sourcePath, extname(sourcePath)), ext)
      const now = Date.now()
      let pageCount: number | undefined
      let width: number | undefined
      let height: number | undefined
      let hasThumbnail = false

      if (kind === 'pdf') {
        pageCount = await readPdfPageCount(destination)
      } else {
        const size = readImageSize(destination)
        width = size?.width
        height = size?.height
        hasThumbnail = await createImageThumbnail(destination, id)
      }

      const meta: DocumentMeta = {
        id,
        name,
        ext,
        kind,
        size: stat.size,
        createdAt: now,
        modifiedAt: now,
        favorite: false,
        hasThumbnail,
        pageCount,
        width,
        height
      }
      documents.unshift(meta)
      report.documents.push(meta)
    } catch (error) {
      report.issues.push({
        path: sourcePath,
        message: error instanceof Error ? error.message : "L'import a échoué."
      })
    }
  }

  if (report.documents.length > 0) {
    documents = documents.sort((a, b) => b.modifiedAt - a.modifiedAt)
    await saveIndex()
  }
  return report
}

function parseDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) throw new Error('Miniature invalide.')
  return Buffer.from(match[1], 'base64')
}

async function describeExternal(filePath: string): Promise<ExternalDocument> {
  const stat = await fs.stat(filePath)
  const ext = extensionOf(filePath)
  if (!isSupportedExtension(ext)) throw new Error('Format non pris en charge.')
  const kind = ext === PDF_EXTENSION ? 'pdf' : 'image'
  let pageCount: number | undefined
  let width: number | undefined
  let height: number | undefined

  if (kind === 'pdf') {
    pageCount = await readPdfPageCount(filePath)
  } else {
    const size = readImageSize(filePath)
    width = size?.width
    height = size?.height
  }

  return {
    path: filePath,
    name: basename(filePath, extname(filePath)),
    ext,
    kind,
    size: stat.size,
    pageCount,
    width,
    height
  }
}

function allowedExtensionsFor(format: SaveFileRequest['format']): string[] {
  if (format === 'pdf') return ['pdf']
  if (format === 'jpg') return ['jpg', 'jpeg']
  return [format]
}

function ensureExtension(filePath: string, format: SaveFileRequest['format']): string {
  const allowed = allowedExtensionsFor(format)
  const current = extensionOf(filePath)
  if (allowed.includes(current)) return filePath
  return `${filePath}.${allowed[0]}`
}

async function saveFile(request: SaveFileRequest): Promise<SaveFileResult> {
  const allowed = allowedExtensionsFor(request.format)
  const filterName =
    request.format === 'pdf' ? 'Document PDF' : request.format === 'webp' ? 'Image WebP' : request.format === 'jpg' ? 'Image JPEG' : 'Image PNG'
  const defaultName = ensureExtension(basename(request.defaultName), request.format)
  const result = await showSaveDialog({
    title: 'Exporter le document',
    defaultPath: join(app.getPath('documents'), defaultName),
    filters: [{ name: filterName, extensions: allowed }],
    properties: ['showOverwriteConfirmation', 'createDirectory']
  })
  if (result.canceled || !result.filePath) return { canceled: true }

  const filePath = ensureExtension(result.filePath, request.format)
  await fs.writeFile(filePath, Buffer.from(request.data))
  return { canceled: false, filePath }
}

function registerIpc(): void {
  ipcMain.handle('doclab:library:list', async () => documents)

  ipcMain.handle('doclab:library:import', async (): Promise<ImportReport> => {
    const result = await showOpenDialog({
      title: 'Importer des documents',
      properties: ['openFile', 'multiSelections'],
      filters: ALL_FILE_FILTERS
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { documents: [], issues: [] }
    }
    return importPaths(result.filePaths)
  })

  ipcMain.handle('doclab:library:importPaths', async (_event, paths: string[]): Promise<ImportReport> => {
    if (!Array.isArray(paths)) return { documents: [], issues: [] }
    return importPaths(paths.filter((value): value is string => typeof value === 'string'))
  })

  ipcMain.handle('doclab:library:read', async (_event, id: string) => {
    const document = findDocument(id)
    return new Uint8Array(await fs.readFile(documentFilePath(document)))
  })

  ipcMain.handle('doclab:library:replace', async (_event, request: ReplaceDocumentRequest) => {
    const document = findDocument(request.id)
    const target = documentFilePath(document)
    const temporary = `${target}.tmp`
    const bytes = Buffer.from(request.data)
    await fs.writeFile(temporary, bytes)
    await fs.rename(temporary, target)

    const updated: DocumentMeta = {
      ...document,
      size: bytes.byteLength,
      modifiedAt: Date.now(),
      pageCount: request.pageCount ?? document.pageCount,
      width: request.width ?? document.width,
      height: request.height ?? document.height
    }
    documents = documents.map((entry) => (entry.id === document.id ? updated : entry))
    await saveIndex()
    return updated
  })

  ipcMain.handle('doclab:library:thumbnail', async (_event, id: string, dataUrl: string) => {
    const document = findDocument(id)
    const bytes = parseDataUrl(dataUrl)
    await fs.writeFile(thumbnailFilePath(document.id), bytes)
    const updated: DocumentMeta = { ...document, hasThumbnail: true }
    documents = documents.map((entry) => (entry.id === document.id ? updated : entry))
    await saveIndex()
    return updated
  })

  ipcMain.handle('doclab:library:update', async (_event, id: string, patch: UpdateDocumentPatch) => {
    const document = findDocument(id)
    const updated: DocumentMeta = { ...document }
    if (typeof patch.name === 'string') {
      const name = sanitizeName(patch.name).slice(0, 140)
      if (!name) throw new Error('Le nom ne peut pas être vide.')
      updated.name = name
      updated.modifiedAt = Date.now()
    }
    if (typeof patch.favorite === 'boolean') {
      updated.favorite = patch.favorite
    }
    documents = documents.map((entry) => (entry.id === document.id ? updated : entry))
    await saveIndex()
    return updated
  })

  ipcMain.handle('doclab:library:delete', async (_event, id: string) => {
    const document = findDocument(id)
    documents = documents.filter((entry) => entry.id !== document.id)
    await saveIndex()
    await Promise.allSettled([
      fs.rm(documentFilePath(document), { force: true }),
      fs.rm(thumbnailFilePath(document.id), { force: true })
    ])
  })

  ipcMain.handle('doclab:library:reveal', async (_event, id: string) => {
    const document = findDocument(id)
    shell.showItemInFolder(documentFilePath(document))
  })

  ipcMain.handle('doclab:file:openDialog', async (): Promise<OpenDialogResult> => {
    const result = await showOpenDialog({
      title: 'Ouvrir un document',
      properties: ['openFile'],
      filters: ALL_FILE_FILTERS
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, files: [] }
    }
    try {
      return { canceled: false, files: [await describeExternal(result.filePaths[0])] }
    } catch {
      return { canceled: false, files: [] }
    }
  })

  ipcMain.handle('doclab:file:readExternal', async (_event, filePath: string) => {
    if (typeof filePath !== 'string' || !isSupportedExtension(extensionOf(filePath))) {
      throw new Error('Format non pris en charge.')
    }
    return new Uint8Array(await fs.readFile(filePath))
  })

  ipcMain.handle('doclab:file:save', async (_event, request: SaveFileRequest) => {
    return saveFile(request)
  })

  ipcMain.handle('doclab:app:version', async () => app.getVersion())

  ipcMain.on('doclab:window:minimize', () => mainWindow?.minimize())
  ipcMain.on('doclab:window:toggleMaximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('doclab:window:close', () => mainWindow?.close())
  ipcMain.handle('doclab:window:isMaximized', async () => mainWindow?.isMaximized() ?? false)
}

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'build', 'icon.png')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: '#EFEBE5',
    title: 'DocumentsLab',
    icon: iconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('maximize', () => mainWindow?.webContents.send('doclab:window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('doclab:window:maximized', false))
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('will-prevent-unload', (event) => {
    if (!mainWindow) return
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      title: 'Modifications non enregistrées',
      message: 'Des modifications ne sont pas encore enregistrées.',
      detail: 'Si vous quittez maintenant, elles seront perdues.',
      buttons: ['Quitter sans enregistrer', 'Continuer l’édition'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    })
    if (choice === 0) event.preventDefault()
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    await ensureStore()
    registerIpc()

    protocol.handle('doclab', async (request) => {
      try {
        const url = new URL(request.url)
        if (url.hostname !== 'thumb') {
          return new Response('Not found', { status: 404 })
        }
        const id = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
        const document = documents.find((entry) => entry.id === id)
        if (!document) return new Response('Not found', { status: 404 })
        const filePath = thumbnailFilePath(document.id)
        return net.fetch(pathToFileURL(filePath).toString())
      } catch {
        return new Response('Not found', { status: 404 })
      }
    })

    if (process.platform === 'darwin') {
      const menu = Menu.buildFromTemplate([
        { role: 'appMenu' },
        { role: 'editMenu' },
        { role: 'windowMenu' }
      ])
      Menu.setApplicationMenu(menu)
    } else {
      Menu.setApplicationMenu(null)
    }

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
