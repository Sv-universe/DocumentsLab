import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { CloudUpload, LoaderCircle } from 'lucide-react'
import type { DocumentMeta, ImportReport } from '@shared/types'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { LibraryView } from './components/LibraryView'
import { RenameDialog } from './components/RenameDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ToastStack, type ToastMessage, type ToastTone } from './components/Toast'
import { PdfEditor } from './components/PdfEditor'
import { ImageEditor } from './components/ImageEditor'
import { AboutDialog } from './components/AboutDialog'
import { renderPdfThumbnail } from './lib/pdf'
import type { LibraryFilter, SortMode, ViewMode } from './lib/library'
import type { EditorSource, Notify } from './lib/editor'
import { updateDocumentInList } from './lib/library-state'
import { loadLibraryPreferences, saveLibraryPreferences } from './lib/preferences'

interface OpeningState {
  id?: string
  name: string
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'string') return reason
  return 'Une erreur inattendue est survenue.'
}

function sortDocuments(documents: DocumentMeta[]): DocumentMeta[] {
  return [...documents].sort((a, b) => b.modifiedAt - a.modifiedAt)
}

export default function App() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [opening, setOpening] = useState<OpeningState | null>(null)
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>(() => loadLibraryPreferences().sort)
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadLibraryPreferences().viewMode)
  const [editor, setEditor] = useState<EditorSource | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [renameTarget, setRenameTarget] = useState<DocumentMeta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentMeta | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<DocumentMeta[] | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [version, setVersion] = useState('0.2.0')
  const [creditsOpen, setCreditsOpen] = useState(false)

  const dragDepth = useRef(0)
  const exportAction = useRef<(() => void) | null>(null)
  const backfilling = useRef(new Set<string>())
  const toastTimers = useRef(new Map<string, number>())

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id)
    if (timer) window.clearTimeout(timer)
    toastTimers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify: Notify = useCallback(
    (message, tone: ToastTone = 'info', detail) => {
      const id = crypto.randomUUID()
      setToasts((current) => [...current.slice(-3), { id, message, tone, detail }])
      const timer = window.setTimeout(
        () => dismissToast(id),
        tone === 'error' ? 6500 : 4200
      )
      toastTimers.current.set(id, timer)
    },
    [dismissToast]
  )

  useEffect(() => {
    saveLibraryPreferences({ sort, viewMode })
  }, [sort, viewMode])

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const backfillThumbnails = useCallback(
    async (list: DocumentMeta[]) => {
      for (const document of list) {
        if (document.kind !== 'pdf' || document.hasThumbnail) continue
        if (backfilling.current.has(document.id)) continue
        backfilling.current.add(document.id)
        try {
          const bytes = await window.doclab.readDocument(document.id)
          const thumbnail = await renderPdfThumbnail(bytes)
          const updated = await window.doclab.saveThumbnail(document.id, thumbnail)
          setDocuments((current) => updateDocumentInList(current, updated))
        } catch (reason) {
          console.warn('Miniature indisponible', reason)
        } finally {
          backfilling.current.delete(document.id)
        }
      }
    },
    []
  )

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [library, appVersion] = await Promise.all([
          window.doclab.getLibrary(),
          window.doclab.getAppVersion()
        ])
        if (!active) return
        setDocuments(sortDocuments(library))
        setVersion(appVersion)
        void backfillThumbnails(library)
      } catch (reason) {
        if (active) notify(errorMessage(reason), 'error')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [backfillThumbnails, notify])

  const handleImportReport = useCallback(
    (report: ImportReport) => {
      if (report.documents.length === 0 && report.issues.length === 0) return
      if (report.documents.length > 0) {
        setDocuments((current) => {
          const known = new Set(current.map((document) => document.id))
          const additions = report.documents.filter((document) => !known.has(document.id))
          return sortDocuments([...additions, ...current])
        })
        setFilter('all')
        setQuery('')
        void backfillThumbnails(report.documents)
        notify(
          `${report.documents.length} ${report.documents.length > 1 ? 'documents importés' : 'document importé'}`,
          'success',
          report.issues.length > 0
            ? `${report.issues.length} élément(s) ignoré(s)`
            : 'Ils sont prêts dans votre bibliothèque.'
        )
      }
      if (report.issues.length > 0) {
        notify(
          "Certains fichiers n'ont pas pu être importés",
          'error',
          report.issues[0]?.message
        )
      }
    },
    [backfillThumbnails, notify]
  )

  const importPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return
      setImporting(true)
      try {
        const report = await window.doclab.importPaths(paths)
        handleImportReport(report)
      } catch (reason) {
        notify(errorMessage(reason), 'error')
      } finally {
        setImporting(false)
      }
    },
    [handleImportReport, notify]
  )

  const handleImport = useCallback(async () => {
    setImporting(true)
    try {
      const report = await window.doclab.importDocuments()
      handleImportReport(report)
    } catch (reason) {
      notify(errorMessage(reason), 'error')
    } finally {
      setImporting(false)
    }
  }, [handleImportReport, notify])

  const openLibraryDocument = useCallback(
    async (document: DocumentMeta) => {
      setOpening({ id: document.id, name: document.name })
      try {
        const bytes = await window.doclab.readDocument(document.id)
        setEditor({ kind: 'library', meta: document, bytes })
        setEditorKey((key) => key + 1)
      } catch (reason) {
        notify(errorMessage(reason), 'error')
      } finally {
        setOpening(null)
      }
    },
    [notify]
  )

  const openExternalFile = useCallback(async () => {
    try {
      const result = await window.doclab.openFileDialog()
      if (result.canceled) return
      const file = result.files[0]
      if (!file) {
        notify('Ce format de fichier n’est pas pris en charge.', 'error')
        return
      }
      setOpening({ name: file.name })
      const bytes = await window.doclab.readExternal(file.path)
      setEditor({ kind: 'external', file, bytes })
      setEditorKey((key) => key + 1)
    } catch (reason) {
      notify(errorMessage(reason), 'error')
    } finally {
      setOpening(null)
    }
  }, [notify])

  const toggleFavorite = useCallback(
    async (document: DocumentMeta) => {
      try {
        const updated = await window.doclab.updateDocument(document.id, {
          favorite: !document.favorite
        })
        setDocuments((current) => updateDocumentInList(current, updated))
      } catch (reason) {
        notify(errorMessage(reason), 'error')
      }
    },
    [notify]
  )

  const setFavoriteMany = useCallback(
    async (ids: string[], favorite: boolean) => {
      if (ids.length === 0) return
      const results = await Promise.allSettled(
        ids.map((id) => window.doclab.updateDocument(id, { favorite }))
      )
      const updated = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      )
      if (updated.length > 0) {
        setDocuments((current) =>
          updated.reduce(
            (list, document) => updateDocumentInList(list, document),
            current
          )
        )
      }
      const failed = results.length - updated.length
      if (failed > 0) {
        notify(
          `${failed} document${failed > 1 ? 's' : ''} n’a pas pu être mis à jour.`,
          'error'
        )
      } else {
        notify(
          favorite
            ? `${updated.length} document${updated.length > 1 ? 's' : ''} ajouté${updated.length > 1 ? 's' : ''} aux favoris.`
            : `${updated.length} document${updated.length > 1 ? 's' : ''} retiré${updated.length > 1 ? 's' : ''} des favoris.`,
          'success'
        )
      }
    },
    [notify]
  )

  const requestDeleteMany = useCallback((targets: DocumentMeta[]) => {
    if (targets.length > 0) setBulkDeleteTargets(targets)
  }, [])

  const confirmDeleteMany = useCallback(async () => {
    if (!bulkDeleteTargets) return
    const targets = bulkDeleteTargets
    const results = await Promise.allSettled(
      targets.map((document) => window.doclab.deleteDocument(document.id))
    )
    const removed = new Set(
      targets
        .filter((_, index) => results[index]?.status === 'fulfilled')
        .map((document) => document.id)
    )
    setDocuments((current) => current.filter((document) => !removed.has(document.id)))
    setBulkDeleteTargets(null)
    const failed = targets.length - removed.size
    if (removed.size > 0) {
      notify(
        `${removed.size} document${removed.size > 1 ? 's' : ''} supprimé${removed.size > 1 ? 's' : ''}.`,
        'success'
      )
    }
    if (failed > 0) {
      notify(
        `${failed} document${failed > 1 ? 's' : ''} n’a pas pu être supprimé.`,
        'error'
      )
    }
  }, [bulkDeleteTargets, notify])

  const saveRename = useCallback(
    async (name: string) => {
      if (!renameTarget) return
      const updated = await window.doclab.updateDocument(renameTarget.id, { name })
      setDocuments((current) => sortDocuments(updateDocumentInList(current, updated)))
      setEditor((current) =>
        current?.kind === 'library' && current.meta.id === updated.id
          ? { ...current, meta: updated }
          : current
      )
      setRenameTarget(null)
      notify('Document renommé.', 'success')
    },
    [notify, renameTarget]
  )

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await window.doclab.deleteDocument(deleteTarget.id)
      setDocuments((current) => current.filter((document) => document.id !== deleteTarget.id))
      if (editor?.kind === 'library' && editor.meta.id === deleteTarget.id) {
        setEditor(null)
      }
      setDeleteTarget(null)
      notify('Document supprimé.', 'success')
    } catch (reason) {
      notify(errorMessage(reason), 'error')
    }
  }, [deleteTarget, editor, notify])

  const revealDocument = useCallback(
    async (document: DocumentMeta) => {
      try {
        await window.doclab.revealDocument(document.id)
      } catch (reason) {
        notify(errorMessage(reason), 'error')
      }
    },
    [notify]
  )

  const registerExport = useCallback((handler: (() => void) | null) => {
    exportAction.current = handler
  }, [])

  const handleSaved = useCallback(
    (meta: DocumentMeta, bytes: Uint8Array) => {
      setDocuments((current) => sortDocuments(updateDocumentInList(current, meta)))
      setEditor((current) =>
        current?.kind === 'library' && current.meta.id === meta.id
          ? { ...current, meta, bytes }
          : current
      )
      setEditorKey((key) => key + 1)
    },
    []
  )

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
    dragDepth.current += 1
    setDragActive(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragActive(false)
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = 0
    setDragActive(false)
    const files = Array.from(event.dataTransfer.files)
    const paths = files
      .map((file) => window.doclab.getPathForFile(file))
      .filter((path): path is string => Boolean(path))
    if (paths.length === 0) {
      notify('Impossible de lire ces fichiers.', 'error')
      return
    }
    await importPaths(paths)
  }

  const resetFilters = useCallback(() => {
    setFilter('all')
    setQuery('')
  }, [])

  return (
    <div
      className="app"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => void handleDrop(event)}
    >
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <TopBar
        importing={importing}
        canExport={editor !== null}
        onImport={() => void handleImport()}
        onOpen={() => void openExternalFile()}
        onExport={() => exportAction.current?.()}
        onShowCredits={() => setCreditsOpen(true)}
      />

      <main className={`workspace ${editor ? 'workspace-editor' : ''}`}>
        <div className="workspace-card">
          {editor ? (
            editor.kind === 'library' && editor.meta.kind === 'image' ? (
              <ImageEditor
                key={`image-${editor.meta.id}-${editorKey}`}
                source={editor}
                onClose={() => setEditor(null)}
                onSaved={handleSaved}
                notify={notify}
                registerExport={registerExport}
              />
            ) : editor.kind === 'external' && editor.file.kind === 'image' ? (
              <ImageEditor
                key={`image-external-${editor.file.path}-${editorKey}`}
                source={editor}
                onClose={() => setEditor(null)}
                onSaved={handleSaved}
                notify={notify}
                registerExport={registerExport}
              />
            ) : (
              <PdfEditor
                key={`pdf-${editor.kind === 'library' ? editor.meta.id : editor.file.path}-${editorKey}`}
                source={editor}
                onClose={() => setEditor(null)}
                onSaved={handleSaved}
                notify={notify}
                registerExport={registerExport}
              />
            )
          ) : (
            <>
              <Sidebar
                documents={documents}
                filter={filter}
                onFilterChange={setFilter}
                version={version}
                onShowCredits={() => setCreditsOpen(true)}
              />
              <LibraryView
                documents={documents}
                filter={filter}
                query={query}
                sort={sort}
                viewMode={viewMode}
                importing={importing}
                loading={loading}
                onQueryChange={setQuery}
                onSortChange={setSort}
                onViewModeChange={setViewMode}
                onImport={() => void handleImport()}
                onOpen={() => void openExternalFile()}
                onReset={resetFilters}
                onOpenDocument={(document) => void openLibraryDocument(document)}
                onToggleFavorite={(document) => void toggleFavorite(document)}
                onSetFavoriteMany={(ids, favorite) => void setFavoriteMany(ids, favorite)}
                onDeleteMany={requestDeleteMany}
                onRename={setRenameTarget}
                onDelete={setDeleteTarget}
                onReveal={(document) => void revealDocument(document)}
              />
            </>
          )}
        </div>
      </main>

      {dragActive ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card">
            <span className="drop-icon">
              <CloudUpload size={34} strokeWidth={1.7} />
            </span>
            <h2>Déposez vos fichiers ici</h2>
            <p>PDF, PNG, JPG, WebP, GIF, BMP et AVIF</p>
            <span>Ils seront copiés dans votre bibliothèque DocumentsLab.</span>
          </div>
        </div>
      ) : null}

      {opening ? (
        <div className="busy-overlay" role="status">
          <div className="busy-card">
            <LoaderCircle className="spin" size={26} />
            <div>
              <strong>Ouverture du document</strong>
              <span>{opening.name}</span>
            </div>
          </div>
        </div>
      ) : null}

      {renameTarget ? (
        <RenameDialog
          document={renameTarget}
          onCancel={() => setRenameTarget(null)}
          onSave={saveRename}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Supprimer ce document ?"
          subtitle="Cette action est définitive."
          confirmLabel="Supprimer"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        >
          <p>
            <strong>{deleteTarget.name}</strong> sera retiré de votre bibliothèque et le fichier
            local sera supprimé.
          </p>
        </ConfirmDialog>
      ) : null}

      {bulkDeleteTargets ? (
        <ConfirmDialog
          title={`Supprimer ${bulkDeleteTargets.length} document${bulkDeleteTargets.length > 1 ? 's' : ''} ?`}
          subtitle="Cette action est définitive."
          confirmLabel="Supprimer"
          onCancel={() => setBulkDeleteTargets(null)}
          onConfirm={() => void confirmDeleteMany()}
        >
          <p>
            <strong>
              {bulkDeleteTargets.length} document{bulkDeleteTargets.length > 1 ? 's' : ''}
            </strong>{' '}
            seront retirés de votre bibliothèque et leurs fichiers locaux seront supprimés.
          </p>
        </ConfirmDialog>
      ) : null}

      {creditsOpen ? (
        <AboutDialog version={version} onClose={() => setCreditsOpen(false)} />
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
