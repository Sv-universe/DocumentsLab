import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import {
  ArrowLeft,
  Bold,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Highlighter,
  LoaderCircle,
  Maximize2,
  Minus,
  MousePointer2,
  MoveDown,
  MoveUp,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  X
} from 'lucide-react'
import type { PDFDocumentProxy, PDFPageProxy } from '../lib/pdf'
import { openPdf, renderPdfPageToCanvas, renderPdfThumbnail } from '../lib/pdf'
import type { DocumentMeta } from '@shared/types'
import type { EditorSource, Notify } from '../lib/editor'
import { sourceName } from '../lib/editor'
import { formatBytes, sanitizeFileName } from '../lib/format'
import type {
  AnnotationOverlay,
  PageRef,
  PdfEditState,
  PdfOverlay,
  SignatureAsset,
  SignatureOverlay,
  TextOverlay
} from '../lib/pdf-types'
import {
  createPageRef,
  duplicatePageRef,
  extractPageRefs,
  findOverlay,
  insertPageRefs
} from '../lib/pdf-types'
import { buildEditedPdf } from '../lib/pdf-export'
import { SignatureModal } from './SignatureModal'
import { ConfirmDialog } from './ConfirmDialog'

interface PdfEditorProps {
  source: EditorSource
  onClose: () => void
  onSaved: (meta: DocumentMeta, bytes: Uint8Array) => void
  notify: Notify
  registerExport: (handler: (() => void) | null) => void
}

interface ViewportInfo {
  width: number
  height: number
  scale: number
}

type Tool = 'select' | 'text' | 'signature' | 'highlight' | 'ink' | 'shape'

interface DrawingState {
  tool: 'highlight' | 'ink' | 'shape'
  startX: number
  startY: number
  currentX: number
  currentY: number
  points: Array<{ x: number; y: number }>
}

const TEXT_COLORS = ['#1C1917', '#C81E1E', '#1D4ED8', '#047857']
const ANNOTATION_COLORS = ['#F59E0B', '#F04438', '#1D4ED8', '#047857', '#1C1917']
const MIN_ANNOTATION_SIZE = 6
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function fileLabel(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (reason) => {
        window.clearTimeout(timer)
        reject(reason)
      }
    )
  })
}

function initialState(
  pageCount: number,
  bytes: Uint8Array,
  label: string
): PdfEditState {
  return {
    pages: Array.from({ length: pageCount }, (_, index) => createPageRef('main', index)),
    overlays: {},
    sources: { main: { bytes, label } }
  }
}

export function PdfEditor({
  source,
  onClose,
  onSaved,
  notify,
  registerExport
}: PdfEditorProps) {
  const initialBytes = useRef(source.bytes).current
  const scanSource = useMemo(
    () => ({
      name: sourceName(source),
      ext: 'pdf',
      size: source.kind === 'library' ? source.meta.size : source.file.size,
      external: source.kind === 'external'
    }),
    [source]
  )

  const [pageProxy, setPageProxy] = useState<PDFPageProxy | null>(null)
  const [documentLoading, setDocumentLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editState, setEditState] = useState<PdfEditState>({
    pages: [],
    overlays: {},
    sources: {}
  })
  const [past, setPast] = useState<PdfEditState[]>([])
  const [future, setFuture] = useState<PdfEditState[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [viewport, setViewport] = useState<ViewportInfo | null>(null)
  const [zoom, setZoom] = useState(1)
  const [containerWidth, setContainerWidth] = useState(0)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState('')
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusTextId, setFocusTextId] = useState<string | null>(null)
  const [shapeKind, setShapeKind] = useState<'rect' | 'arrow'>('rect')
  const [annotationColor, setAnnotationColor] = useState(ANNOTATION_COLORS[0])
  const [highlightOpacity, setHighlightOpacity] = useState(0.35)
  const [annotationOpacity, setAnnotationOpacity] = useState(0.9)
  const [annotationWidth, setAnnotationWidth] = useState(3)
  const [drawing, setDrawing] = useState<DrawingState | null>(null)
  const [signatureModal, setSignatureModal] = useState(false)
  const [pendingSignature, setPendingSignature] = useState<SignatureAsset | null>(null)
  const [extractOpen, setExtractOpen] = useState(false)
  const [extractSelection, setExtractSelection] = useState<Set<number>>(new Set())
  const [extracting, setExtracting] = useState(false)
  const [inserting, setInserting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)

  const handleRef = useRef<Awaited<ReturnType<typeof openPdf>> | null>(null)
  const documentsRef = useRef<Map<string, PDFDocumentProxy>>(new Map())
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const drawingRef = useRef<DrawingState | null>(null)

  const pageRef = editState.pages[pageIndex] ?? null
  const displayWidth = viewport ? viewport.width / viewport.scale : 0
  const displayHeight = viewport ? viewport.height / viewport.scale : 0
  const selectedOverlay = useMemo(
    () => findOverlay(editState, selectedId),
    [editState, selectedId]
  )
  const currentOverlays = pageRef ? editState.overlays[pageRef.id] ?? [] : []

  useEffect(() => {
    let cancelled = false
    setDocumentLoading(true)
    setLoadError('')

    openPdf(initialBytes)
      .then((opened) => {
        if (cancelled) {
          void opened.destroy()
          return
        }
        handleRef.current = opened
        documentsRef.current.set('main', opened.document)
        setEditState(
          initialState(
            opened.document.numPages,
            initialBytes,
            source.kind === 'library' ? source.meta.name : source.file.name
          )
        )
        setPast([])
        setFuture([])
        setPageIndex(0)
        setDirty(false)
        setDocumentLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setLoadError(
          reason instanceof Error
            ? reason.message
            : 'Ce PDF ne peut pas être ouvert. Il est peut-être protégé par un mot de passe.'
        )
        setDocumentLoading(false)
      })

    return () => {
      cancelled = true
      const documents = new Set(documentsRef.current.values())
      if (handleRef.current?.document) documents.add(handleRef.current.document)
      documents.forEach((document) => void document.destroy())
      documentsRef.current.clear()
      handleRef.current = null
    }
  }, [initialBytes, source])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const update = () => setContainerWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!pageRef || containerWidth <= 0) return
    let cancelled = false
    setRendering(true)
    setRenderError('')

    const prepare = async () => {
      try {
        const document = documentsRef.current.get(pageRef.sourceId)
        if (!document) throw new Error('Source PDF introuvable.')
        const page = await document.getPage(pageRef.index + 1)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const fit = Math.max(0.12, (containerWidth - 170) / base.width)
        const scale = Math.max(0.1, fit * zoom)
        const view = page.getViewport({ scale })
        setPageProxy(page)
        setViewport({ width: view.width, height: view.height, scale })
      } catch (reason) {
        if (!cancelled) {
          setRenderError(reason instanceof Error ? reason.message : 'Rendu impossible.')
          setRendering(false)
        }
      }
    }

    void prepare()
    return () => {
      cancelled = true
    }
  }, [pageRef, zoom, containerWidth])

  useEffect(() => {
    if (!pageProxy || !viewport) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let renderTask: ReturnType<typeof renderPdfPageToCanvas>['renderTask'] | null = null
    setRendering(true)

    try {
      const prepared = renderPdfPageToCanvas(pageProxy, viewport.scale, canvas)
      renderTask = prepared.renderTask
      void prepared.renderTask.promise
        .then(() => {
          if (!cancelled) setRendering(false)
        })
        .catch((reason: unknown) => {
          if (!cancelled && (reason as Error)?.name !== 'RenderingCancelledException') {
            setRenderError(reason instanceof Error ? reason.message : 'Rendu impossible.')
            setRendering(false)
          }
        })
    } catch (reason) {
      setRenderError(reason instanceof Error ? reason.message : 'Rendu impossible.')
      setRendering(false)
    }

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pageProxy, viewport])

  useEffect(() => {
    if (pageIndex >= editState.pages.length && editState.pages.length > 0) {
      setPageIndex(editState.pages.length - 1)
    }
  }, [editState.pages.length, pageIndex])

  useEffect(() => {
    setExtractSelection(new Set())
  }, [editState.pages.length])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
    setSelectedId(null)
  }, [pageIndex])

  useEffect(() => {
    if (!focusTextId || selectedId !== focusTextId) return
    const textarea = textareaRef.current
    if (textarea) {
      textarea.focus()
      textarea.select()
    }
    setFocusTextId(null)
  }, [focusTextId, selectedId, selectedOverlay])

  const beginEdit = useCallback(() => {
    setPast((current) => [...current.slice(-59), editState])
    setFuture([])
  }, [editState])

  const commitState = useCallback(
    (next: PdfEditState) => {
      setPast((current) => [...current.slice(-59), editState])
      setFuture([])
      setEditState(next)
      setDirty(true)
    },
    [editState]
  )

  const updateOverlay = useCallback((id: string, updater: (overlay: PdfOverlay) => PdfOverlay) => {
    setEditState((current) => {
      const overlays: Record<string, PdfOverlay[]> = { ...current.overlays }
      for (const key of Object.keys(overlays)) {
        if (overlays[key]?.some((overlay) => overlay.id === id)) {
          overlays[key] = overlays[key].map((overlay) =>
            overlay.id === id ? updater(overlay) : overlay
          )
        }
      }
      return { ...current, overlays }
    })
    setDirty(true)
  }, [])

  const addOverlay = useCallback(
    (overlay: PdfOverlay) => {
      if (!pageRef) return
      const overlays = { ...editState.overlays }
      overlays[pageRef.id] = [...(overlays[pageRef.id] ?? []), overlay]
      commitState({ ...editState, overlays })
      setSelectedId(overlay.id)
    },
    [commitState, editState, pageRef]
  )

  const removeOverlay = useCallback(
    (id: string) => {
      beginEdit()
      setEditState((current) => {
        const overlays: Record<string, PdfOverlay[]> = { ...current.overlays }
        for (const key of Object.keys(overlays)) {
          overlays[key] = (overlays[key] ?? []).filter((overlay) => overlay.id !== id)
        }
        return { ...current, overlays }
      })
      setSelectedId(null)
      setDirty(true)
    },
    [beginEdit]
  )

  const undo = useCallback(() => {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    if (!previous) return
    setFuture((current) => [editState, ...current].slice(0, 60))
    setPast((current) => current.slice(0, -1))
    setEditState(previous)
    setSelectedId(null)
    setDirty(true)
  }, [editState, past])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    if (!next) return
    setPast((current) => [...current.slice(-59), editState])
    setFuture((current) => current.slice(1))
    setEditState(next)
    setSelectedId(null)
    setDirty(true)
  }, [editState, future])

  const goToPage = useCallback(
    (nextIndex: number) => {
      if (editState.pages.length === 0) return
      const clamped = clamp(nextIndex, 0, editState.pages.length - 1)
      setPageIndex(clamped)
      setTool('select')
      setPendingSignature(null)
    },
    [editState.pages.length]
  )

  const movePage = useCallback(
    (direction: -1 | 1) => {
      const target = pageIndex + direction
      if (target < 0 || target >= editState.pages.length) return
      const pages = [...editState.pages]
      ;[pages[pageIndex], pages[target]] = [pages[target], pages[pageIndex]]
      commitState({ ...editState, pages })
      setPageIndex(target)
      setSelectedId(null)
    },
    [commitState, editState, pageIndex]
  )

  const deletePage = useCallback(() => {
    if (editState.pages.length <= 1) return
    const pages = editState.pages.filter((_, index) => index !== pageIndex)
    commitState({ ...editState, pages })
    setPageIndex((current) => Math.min(current, pages.length - 1))
    setSelectedId(null)
    notify('Page retirée. Elle sera supprimée à l’enregistrement.', 'info')
  }, [commitState, editState, notify, pageIndex])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    removeOverlay(selectedId)
  }, [removeOverlay, selectedId])

  const duplicatePage = useCallback(() => {
    if (!pageRef) return
    const copy = duplicatePageRef(pageRef)
    const pages = insertPageRefs(editState.pages, pageIndex, [copy])
    const overlays = {
      ...editState.overlays,
      [copy.id]: (editState.overlays[pageRef.id] ?? []).map((overlay) => ({
        ...overlay,
        id: crypto.randomUUID()
      }))
    }
    commitState({ ...editState, pages, overlays })
    setPageIndex(pageIndex + 1)
    setSelectedId(null)
    notify('Page dupliquée.', 'info')
  }, [commitState, editState, notify, pageIndex, pageRef])

  const insertPdf = useCallback(async () => {
    if (inserting) return
    setInserting(true)
    try {
      const result = await window.doclab.openFileDialog()
      if (result.canceled) return
      const file = result.files[0]
      if (!file || file.ext !== 'pdf') {
        notify('Choisissez un fichier PDF à insérer.', 'error')
        return
      }
      const bytes = await window.doclab.readExternal(file.path)
      const opened = await openPdf(bytes)
      const sourceId = `source-${crypto.randomUUID()}`
      documentsRef.current.set(sourceId, opened.document)
      const refs = Array.from({ length: opened.document.numPages }, (_, index) =>
        createPageRef(sourceId, index)
      )
      const pages = insertPageRefs(editState.pages, pageIndex, refs)
      commitState({
        ...editState,
        pages,
        sources: {
          ...editState.sources,
          [sourceId]: { bytes, label: file.name }
        }
      })
      setSelectedId(null)
      setExtractOpen(false)
      notify(
        `${refs.length} page${refs.length > 1 ? 's' : ''} insérée${refs.length > 1 ? 's' : ''}.`,
        'success'
      )
    } catch (reason) {
      notify(
        reason instanceof Error
          ? reason.message
          : 'Ce fichier ne peut pas être lu comme un PDF.',
        'error'
      )
    } finally {
      setInserting(false)
    }
  }, [commitState, editState, inserting, notify, pageIndex])

  const toggleExtractPage = (index: number) => {
    setExtractSelection((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const extractPages = useCallback(async () => {
    if (extracting) return
    const selected = extractPageRefs(editState.pages, extractSelection)
    if (selected.length === 0) {
      notify('Sélectionnez au moins une page à extraire.', 'error')
      return
    }
    setExtracting(true)
    try {
      const bytes = await buildEditedPdf({ ...editState, pages: selected })
      const result = await window.doclab.saveFile({
        defaultName: `${sanitizeFileName(scanSource.name)} - pages extraites.pdf`,
        data: bytes,
        format: 'pdf'
      })
      if (!result.canceled && result.filePath) {
        notify(
          `${selected.length} page${selected.length > 1 ? 's' : ''} extraite${selected.length > 1 ? 's' : ''}.`,
          'success',
          fileLabel(result.filePath)
        )
        setExtractOpen(false)
        setExtractSelection(new Set())
      }
    } catch (reason) {
      notify(
        reason instanceof Error ? reason.message : 'L’extraction des pages a échoué.',
        'error'
      )
    } finally {
      setExtracting(false)
    }
  }, [editState, extractSelection, extracting, notify, scanSource.name])

  const startOverlayDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    overlay: PdfOverlay
  ) => {
    if (tool !== 'select' || !viewport) return
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(overlay.id)
    beginEdit()
    const scale = viewport.scale
    const startX = event.clientX
    const startY = event.clientY
    const originX = overlay.x
    const originY = overlay.y

    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      const maxX =
        overlay.type === 'text'
          ? Math.max(0, displayWidth - 20)
          : Math.max(0, displayWidth - overlay.width)
      const maxY =
        overlay.type === 'text'
          ? Math.max(0, displayHeight - 20)
          : Math.max(0, displayHeight - overlay.height)
      updateOverlay(overlay.id, (current) => ({
        ...current,
        x: clamp(originX + dx, 0, maxX),
        y: clamp(originY + dy, 0, maxY)
      }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const startSignatureResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    overlay: SignatureOverlay
  ) => {
    if (!viewport) return
    event.preventDefault()
    event.stopPropagation()
    beginEdit()
    const scale = viewport.scale
    const startX = event.clientX
    const startY = event.clientY
    const originWidth = overlay.width
    const originHeight = overlay.height
    const originX = overlay.x
    const originY = overlay.y

    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      const maxWidth = Math.max(40, displayWidth - originX)
      const maxHeight = Math.max(30, displayHeight - originY)
      let width = clamp(originWidth + dx, 40, maxWidth)
      let height = width / overlay.aspect
      if (height > maxHeight || (dy !== 0 && originHeight + dy < 30)) {
        height = clamp(originHeight + dy, 30, maxHeight)
        width = height * overlay.aspect
      }
      if (height > maxHeight) {
        height = maxHeight
        width = height * overlay.aspect
      }
      updateOverlay(overlay.id, (current) => ({
        ...current,
        width,
        height
      }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const startAnnotationResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    overlay: SignatureOverlay | AnnotationOverlay
  ) => {
    if (!viewport) return
    event.preventDefault()
    event.stopPropagation()
    beginEdit()
    const scale = viewport.scale
    const startX = event.clientX
    const startY = event.clientY
    const originWidth = overlay.width
    const originHeight = overlay.height

    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      const width = clamp(
        originWidth + dx,
        10,
        Math.max(10, displayWidth - overlay.x)
      )
      const height = clamp(
        originHeight + dy,
        10,
        Math.max(10, displayHeight - overlay.y)
      )
      updateOverlay(overlay.id, (current) =>
        'width' in current ? { ...current, width, height } : current
      )
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const pointFromClient = (clientX: number, clientY: number) => {
    const surface = surfaceRef.current
    if (!surface || !viewport) return null
    const rect = surface.getBoundingClientRect()
    return {
      x: clamp((clientX - rect.left) / viewport.scale, 0, displayWidth),
      y: clamp((clientY - rect.top) / viewport.scale, 0, displayHeight)
    }
  }

  const pointFromSurface = (event: ReactPointerEvent<HTMLDivElement>) =>
    pointFromClient(event.clientX, event.clientY)

  const finishDrawing = (state: DrawingState) => {
    if (state.tool === 'ink') {
      if (state.points.length < 2) return
      const padding = annotationWidth / 2
      const xs = state.points.map((point) => point.x)
      const ys = state.points.map((point) => point.y)
      const minX = Math.max(0, Math.min(...xs) - padding)
      const minY = Math.max(0, Math.min(...ys) - padding)
      const maxX = Math.min(displayWidth, Math.max(...xs) + padding)
      const maxY = Math.min(displayHeight, Math.max(...ys) + padding)
      const width = Math.max(1, maxX - minX)
      const height = Math.max(1, maxY - minY)
      const overlay: AnnotationOverlay = {
        id: crypto.randomUUID(),
        type: 'ink',
        x: minX,
        y: minY,
        width,
        height,
        points: state.points.map((point) => ({
          x: clamp((point.x - minX) / width, 0, 1),
          y: clamp((point.y - minY) / height, 0, 1)
        })),
        color: annotationColor,
        strokeWidth: annotationWidth,
        opacity: annotationOpacity
      }
      addOverlay(overlay)
      setTool('select')
      return
    }

    const x = Math.min(state.startX, state.currentX)
    const y = Math.min(state.startY, state.currentY)
    const width = Math.abs(state.currentX - state.startX)
    const height = Math.abs(state.currentY - state.startY)
    if (width < MIN_ANNOTATION_SIZE || height < MIN_ANNOTATION_SIZE) return

    const overlay: AnnotationOverlay =
      state.tool === 'highlight'
        ? {
            id: crypto.randomUUID(),
            type: 'highlight',
            x,
            y,
            width,
            height,
            color: annotationColor,
            opacity: highlightOpacity
          }
        : {
            id: crypto.randomUUID(),
            type: 'shape',
            kind: shapeKind,
            x,
            y,
            width,
            height,
            color: annotationColor,
            strokeWidth: annotationWidth,
            opacity: annotationOpacity,
            flipX: state.currentX < state.startX,
            flipY: state.currentY < state.startY
          }
    addOverlay(overlay)
    setTool('select')
  }

  const startAnnotation = (
    event: ReactPointerEvent<HTMLDivElement>,
    kind: 'highlight' | 'ink' | 'shape'
  ) => {
    if (event.button !== 0 || !viewport) return
    const point = pointFromSurface(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    const state: DrawingState = {
      tool: kind,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      points: [point]
    }
    drawingRef.current = state
    setDrawing({ ...state, points: [...state.points] })

    const move = (moveEvent: PointerEvent) => {
      const next = pointFromClient(moveEvent.clientX, moveEvent.clientY)
      const current = drawingRef.current
      if (!next || !current) return
      current.currentX = next.x
      current.currentY = next.y
      if (current.tool === 'ink') current.points.push(next)
      setDrawing({ ...current, points: [...current.points] })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const current = drawingRef.current
      drawingRef.current = null
      setDrawing(null)
      if (current) finishDrawing(current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const handleSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !viewport) return
    const point = pointFromSurface(event)
    if (!point) return

    if (tool === 'select') {
      setSelectedId(null)
      return
    }

    if (tool === 'highlight' || tool === 'ink' || tool === 'shape') {
      startAnnotation(event, tool)
      return
    }

    if (tool === 'text') {
      const overlay: TextOverlay = {
        id: crypto.randomUUID(),
        type: 'text',
        x: point.x,
        y: point.y,
        text: 'Votre texte',
        fontSize: 16,
        color: '#1C1917',
        bold: false
      }
      addOverlay(overlay)
      setTool('select')
      setFocusTextId(overlay.id)
      return
    }

    if (tool === 'signature' && pendingSignature) {
      const width = Math.min(210, displayWidth * 0.46)
      const height = width / pendingSignature.aspect
      const overlay: SignatureOverlay = {
        id: crypto.randomUUID(),
        type: 'signature',
        x: clamp(point.x - width / 2, 0, Math.max(0, displayWidth - width)),
        y: clamp(point.y - height / 2, 0, Math.max(0, displayHeight - height)),
        width,
        height,
        src: pendingSignature.src,
        aspect: pendingSignature.aspect
      }
      addOverlay(overlay)
      setPendingSignature(null)
      setTool('select')
    }
  }

  const buildBytes = useCallback(async () => {
    if (editState.pages.length === 0) throw new Error('Aucune page à enregistrer.')
    return buildEditedPdf(editState)
  }, [editState])

  const exportCopy = useCallback(async () => {
    if (exporting || saving) return
    if (editState.pages.length === 0) {
      notify('Le document n’est pas encore prêt.', 'error')
      return
    }
    setExporting(true)
    try {
      const bytes = await buildBytes()
      const suffix = dirty ? ' - modifié' : ''
      const result = await window.doclab.saveFile({
        defaultName: `${sanitizeFileName(scanSource.name)}${suffix}.pdf`,
        data: bytes,
        format: 'pdf'
      })
      if (!result.canceled && result.filePath) {
        notify('Copie PDF exportée.', 'success', fileLabel(result.filePath))
      }
    } catch (reason) {
      notify(
        reason instanceof Error ? reason.message : 'L’export du PDF a échoué.',
        'error'
      )
    } finally {
      setExporting(false)
    }
  }, [buildBytes, dirty, editState.pages.length, exporting, notify, saving, scanSource.name])

  const save = useCallback(async () => {
    if (saving || exporting) return
    if (source.kind === 'external') {
      await exportCopy()
      return
    }
    if (editState.pages.length === 0) {
      notify('Le document n’est pas encore prêt.', 'error')
      return
    }
    setSaving(true)
    try {
      const bytes = await buildBytes()
      const updated = await window.doclab.replaceDocument({
        id: source.meta.id,
        data: bytes,
        pageCount: editState.pages.length
      })
      let meta = updated
      try {
        const thumbnail = await withTimeout(
          renderPdfThumbnail(bytes),
          6000,
          'Délai de génération de la vignette dépassé.'
        )
        meta = await window.doclab.saveThumbnail(source.meta.id, thumbnail)
      } catch (reason) {
        console.warn('Miniature non régénérée', reason)
      }
      notify('Modifications enregistrées.', 'success')
      onSaved(meta, bytes)
    } catch (reason) {
      notify(
        reason instanceof Error ? reason.message : 'L’enregistrement a échoué.',
        'error'
      )
    } finally {
      setSaving(false)
    }
  }, [buildBytes, editState.pages.length, exporting, notify, onSaved, saving, source])

  const requestClose = useCallback(() => {
    if (dirty) setCloseConfirm(true)
    else onClose()
  }, [dirty, onClose])

  useEffect(() => {
    registerExport(() => void exportCopy())
    return () => registerExport(null)
  }, [exportCopy, registerExport])

  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = Boolean(target?.closest('input, textarea, [contenteditable="true"]'))
      const mod = event.ctrlKey || event.metaKey

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
        return
      }
      if (event.key === 'Escape') {
        setTool('select')
        setPendingSignature(null)
        setSelectedId(null)
        return
      }
      if (!typing && (event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        deleteSelected()
        return
      }
      if (!typing && event.key === 'ArrowLeft') {
        goToPage(pageIndex - 1)
      }
      if (!typing && event.key === 'ArrowRight') {
        goToPage(pageIndex + 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected, goToPage, pageIndex, redo, save, selectedId, undo])

  const pageCount = editState.pages.length
  const pageCountLabel =
    pageCount > 0
      ? `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`
      : source.kind === 'library' && source.meta.pageCount
        ? `${source.meta.pageCount} ${source.meta.pageCount === 1 ? 'page' : 'pages'}`
        : 'PDF'
  const selectedText = selectedOverlay?.type === 'text' ? selectedOverlay : null
  const selectedSignature = selectedOverlay?.type === 'signature' ? selectedOverlay : null
  const selectedAnnotation =
    selectedOverlay &&
    (selectedOverlay.type === 'highlight' ||
      selectedOverlay.type === 'ink' ||
      selectedOverlay.type === 'shape')
      ? selectedOverlay
      : null

  return (
    <div className="editor pdf-editor">
      <header className="editor-header">
        <div className="editor-title-group">
          <button className="back-button" onClick={requestClose} aria-label="Retour à la bibliothèque">
            <ArrowLeft size={18} />
          </button>
          <span className="editor-doc-icon editor-doc-icon-pdf">
            <FileText size={20} />
          </span>
          <div className="editor-title-text">
            <div className="editor-title-line">
              <h2 title={scanSource.name}>{scanSource.name}</h2>
              <span className="type-chip type-chip-pdf">PDF</span>
              {dirty ? <span className="dirty-indicator">Modifié</span> : null}
            </div>
            <p>
              {pageCountLabel}
              {' · '}
              {formatBytes(scanSource.size)}
              {scanSource.external ? ' · Fichier externe' : ''}
            </p>
          </div>
        </div>

        <div className="editor-actions">
          <div className="history-actions">
            <button
              className="icon-button"
              onClick={undo}
              disabled={past.length === 0}
              title="Annuler (Ctrl+Z)"
              aria-label="Annuler"
            >
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              onClick={redo}
              disabled={future.length === 0}
              title="Rétablir (Ctrl+Shift+Z)"
              aria-label="Rétablir"
            >
              <Redo2 size={17} />
            </button>
          </div>
          <button
            className="button button-ghost button-small"
            onClick={() => void exportCopy()}
            disabled={exporting || saving}
          >
            <Download size={15} />
            {exporting ? 'Export…' : 'Exporter'}
          </button>
          <button
            className="button button-accent button-small"
            onClick={() => void save()}
            disabled={saving || exporting || documentLoading}
          >
            <Save size={15} />
            {saving
              ? 'Enregistrement…'
              : source.kind === 'library'
                ? 'Enregistrer'
                : 'Enregistrer sous'}
          </button>
        </div>
      </header>

      <div className="editor-body pdf-editor-body">
        <div className={`pdf-workspace tool-${tool}`}>
          <div className="pdf-tool-rail" aria-label="Outils PDF">
            <button
              className={tool === 'select' ? 'is-active' : ''}
              onClick={() => {
                setTool('select')
                setPendingSignature(null)
              }}
              title="Sélectionner"
              aria-label="Sélectionner"
              aria-pressed={tool === 'select'}
            >
              <MousePointer2 size={18} />
            </button>
            <button
              className={tool === 'text' ? 'is-active' : ''}
              onClick={() => {
                setTool('text')
                setPendingSignature(null)
              }}
              title="Ajouter du texte"
              aria-label="Ajouter du texte"
              aria-pressed={tool === 'text'}
            >
              <Type size={18} />
            </button>
            <button
              className={tool === 'highlight' ? 'is-active' : ''}
              onClick={() => {
                setTool('highlight')
                setPendingSignature(null)
              }}
              title="Surligner une zone"
              aria-label="Surligner une zone"
              aria-pressed={tool === 'highlight'}
            >
              <Highlighter size={18} />
            </button>
            <button
              className={tool === 'ink' ? 'is-active' : ''}
              onClick={() => {
                setTool('ink')
                setPendingSignature(null)
              }}
              title="Dessiner à main levée"
              aria-label="Dessiner à main levée"
              aria-pressed={tool === 'ink'}
            >
              <Pencil size={18} />
            </button>
            <button
              className={tool === 'shape' ? 'is-active' : ''}
              onClick={() => {
                setTool('shape')
                setPendingSignature(null)
              }}
              title="Ajouter une forme"
              aria-label="Ajouter une forme"
              aria-pressed={tool === 'shape'}
            >
              <Square size={18} />
            </button>
            <button
              className={pendingSignature ? 'is-active' : ''}
              onClick={() => {
                setSignatureModal(true)
                setPendingSignature(null)
              }}
              title="Ajouter une signature"
              aria-label="Ajouter une signature"
              aria-pressed={Boolean(pendingSignature)}
            >
              <PenLine size={18} />
            </button>
          </div>

          {tool !== 'select' ? (
            <div className="pdf-tool-hint">
              <span>
                {tool === 'text'
                  ? 'Cliquez sur la page pour placer votre texte.'
                  : tool === 'highlight'
                    ? 'Faites glisser pour surligner une zone.'
                    : tool === 'ink'
                      ? 'Dessinez directement sur la page.'
                      : tool === 'shape'
                        ? 'Faites glisser pour tracer la forme.'
                        : pendingSignature
                          ? 'Cliquez sur la page pour placer votre signature.'
                          : 'Ajoutez une signature depuis le panneau.'}
              </span>
              {tool === 'shape' ? (
                <div className="shape-kind-toggle" role="group" aria-label="Type de forme">
                  <button
                    className={shapeKind === 'rect' ? 'is-active' : ''}
                    onClick={() => setShapeKind('rect')}
                    aria-pressed={shapeKind === 'rect'}
                  >
                    Rectangle
                  </button>
                  <button
                    className={shapeKind === 'arrow' ? 'is-active' : ''}
                    onClick={() => setShapeKind('arrow')}
                    aria-pressed={shapeKind === 'arrow'}
                  >
                    Flèche
                  </button>
                </div>
              ) : null}
              <button
                onClick={() => {
                  setTool('select')
                  setPendingSignature(null)
                }}
                aria-label="Quitter l’outil"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}

          <div className="pdf-scroll" ref={scrollRef}>
            {documentLoading ? (
              <div className="pdf-stage-message">
                <LoaderCircle className="spin" size={26} />
                <p>Préparation du document…</p>
              </div>
            ) : loadError ? (
              <div className="pdf-stage-message pdf-stage-error">
                <span className="stage-error-icon">PDF</span>
                <h3>Impossible d’ouvrir ce document</h3>
                <p>{loadError}</p>
                <button className="button button-ghost" onClick={onClose}>
                  Retour à la bibliothèque
                </button>
              </div>
            ) : renderError ? (
              <div className="pdf-stage-message pdf-stage-error">
                <h3>La page n’a pas pu être affichée</h3>
                <p>{renderError}</p>
              </div>
            ) : viewport ? (
              <div className="pdf-page-frame">
                <div
                  className="pdf-page-surface"
                  ref={surfaceRef}
                  style={{ width: viewport.width, height: viewport.height }}
                  onPointerDown={handleSurfacePointerDown}
                >
                  <canvas ref={canvasRef} className="pdf-canvas" />
                  {drawing ? (
                    drawing.tool === 'highlight' ? (
                      <div
                        className="pdf-annotation-preview"
                        style={{
                          left: Math.min(drawing.startX, drawing.currentX) * viewport.scale,
                          top: Math.min(drawing.startY, drawing.currentY) * viewport.scale,
                          width:
                            Math.abs(drawing.currentX - drawing.startX) * viewport.scale,
                          height:
                            Math.abs(drawing.currentY - drawing.startY) * viewport.scale,
                          backgroundColor: annotationColor,
                          opacity: highlightOpacity
                        }}
                      />
                    ) : (
                      <svg
                        className="pdf-drawing-layer"
                        width={viewport.width}
                        height={viewport.height}
                        viewBox={`0 0 ${displayWidth} ${displayHeight}`}
                        aria-hidden="true"
                      >
                        {drawing.tool === 'ink' ? (
                          <polyline
                            points={drawing.points
                              .map((point) => `${point.x},${point.y}`)
                              .join(' ')}
                            fill="none"
                            stroke={annotationColor}
                            strokeWidth={annotationWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        ) : shapeKind === 'rect' ? (
                          <rect
                            x={Math.min(drawing.startX, drawing.currentX)}
                            y={Math.min(drawing.startY, drawing.currentY)}
                            width={Math.abs(drawing.currentX - drawing.startX)}
                            height={Math.abs(drawing.currentY - drawing.startY)}
                            fill="none"
                            stroke={annotationColor}
                            strokeWidth={annotationWidth}
                            vectorEffect="non-scaling-stroke"
                          />
                        ) : (
                          <line
                            x1={drawing.startX}
                            y1={drawing.startY}
                            x2={drawing.currentX}
                            y2={drawing.currentY}
                            stroke={annotationColor}
                            strokeWidth={annotationWidth}
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                      </svg>
                    )
                  ) : null}
                  {currentOverlays.map((overlay) => {
                    const selected = selectedId === overlay.id
                    if (overlay.type === 'text') {
                      return (
                        <div
                          key={overlay.id}
                          className={`pdf-overlay pdf-text-overlay ${selected ? 'is-selected' : ''} ${
                            tool !== 'select' ? 'overlay-passive' : ''
                          }`}
                          style={{
                            left: overlay.x * viewport.scale,
                            top: overlay.y * viewport.scale,
                            fontSize: overlay.fontSize * viewport.scale,
                            color: overlay.color,
                            fontWeight: overlay.bold ? 700 : 400
                          }}
                          onPointerDown={(event) => startOverlayDrag(event, overlay)}
                          onDoubleClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(overlay.id)
                            setFocusTextId(overlay.id)
                          }}
                        >
                          {overlay.text.split('\n').map((line, index) => (
                            <div key={index}>{line || '\u00a0'}</div>
                          ))}
                        </div>
                      )
                    }

                    if (overlay.type !== 'signature') {
                      const arrowStartX = overlay.type === 'shape' && overlay.flipX ? overlay.width : 0
                      const arrowStartY = overlay.type === 'shape' && overlay.flipY ? overlay.height : 0
                      const arrowEndX = overlay.type === 'shape' && overlay.flipX ? 0 : overlay.width
                      const arrowEndY = overlay.type === 'shape' && overlay.flipY ? 0 : overlay.height
                      const angle = Math.atan2(arrowEndY - arrowStartY, arrowEndX - arrowStartX)
                      const headLength = Math.min(
                        16,
                        Math.max(6, Math.hypot(arrowEndX - arrowStartX, arrowEndY - arrowStartY) * 0.22)
                      )
                      return (
                        <div
                          key={overlay.id}
                          className={`pdf-overlay pdf-annotation-overlay ${
                            selected ? 'is-selected' : ''
                          } ${tool !== 'select' ? 'overlay-passive' : ''}`}
                          style={{
                            left: overlay.x * viewport.scale,
                            top: overlay.y * viewport.scale,
                            width: overlay.width * viewport.scale,
                            height: overlay.height * viewport.scale
                          }}
                          onPointerDown={(event) => startOverlayDrag(event, overlay)}
                        >
                          {overlay.type === 'highlight' ? (
                            <span
                              className="pdf-highlight-fill"
                              style={{ backgroundColor: overlay.color, opacity: overlay.opacity }}
                            />
                          ) : (
                            <svg
                              className="pdf-annotation-svg"
                              viewBox={`0 0 ${overlay.width} ${overlay.height}`}
                              preserveAspectRatio="none"
                              aria-hidden="true"
                            >
                              {overlay.type === 'ink' ? (
                                <polyline
                                  points={overlay.points
                                    .map(
                                      (point) =>
                                        `${point.x * overlay.width},${point.y * overlay.height}`
                                    )
                                    .join(' ')}
                                  fill="none"
                                  stroke={overlay.color}
                                  strokeWidth={overlay.strokeWidth}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  opacity={overlay.opacity}
                                  vectorEffect="non-scaling-stroke"
                                />
                              ) : overlay.kind === 'rect' ? (
                                <rect
                                  x={overlay.strokeWidth / 2}
                                  y={overlay.strokeWidth / 2}
                                  width={Math.max(0, overlay.width - overlay.strokeWidth)}
                                  height={Math.max(0, overlay.height - overlay.strokeWidth)}
                                  fill="none"
                                  stroke={overlay.color}
                                  strokeWidth={overlay.strokeWidth}
                                  opacity={overlay.opacity}
                                  vectorEffect="non-scaling-stroke"
                                />
                              ) : (
                                <>
                                  <line
                                    x1={arrowStartX}
                                    y1={arrowStartY}
                                    x2={arrowEndX}
                                    y2={arrowEndY}
                                    stroke={overlay.color}
                                    strokeWidth={overlay.strokeWidth}
                                    opacity={overlay.opacity}
                                    vectorEffect="non-scaling-stroke"
                                  />
                                  <polyline
                                    points={[
                                      [
                                        arrowEndX - Math.cos(angle - Math.PI / 7) * headLength,
                                        arrowEndY - Math.sin(angle - Math.PI / 7) * headLength
                                      ],
                                      [arrowEndX, arrowEndY],
                                      [
                                        arrowEndX - Math.cos(angle + Math.PI / 7) * headLength,
                                        arrowEndY - Math.sin(angle + Math.PI / 7) * headLength
                                      ]
                                    ]
                                      .map((point) => point.join(','))
                                      .join(' ')}
                                    fill="none"
                                    stroke={overlay.color}
                                    strokeWidth={overlay.strokeWidth}
                                    opacity={overlay.opacity}
                                    vectorEffect="non-scaling-stroke"
                                  />
                                </>
                              )}
                            </svg>
                          )}
                          {selected ? (
                            <button
                              className="signature-resize-handle"
                              onPointerDown={(event) => startAnnotationResize(event, overlay)}
                              aria-label="Redimensionner l’annotation"
                            />
                          ) : null}
                        </div>
                      )
                    }

                    return (
                      <div
                        key={overlay.id}
                        className={`pdf-overlay pdf-signature-overlay ${selected ? 'is-selected' : ''} ${
                          tool !== 'select' ? 'overlay-passive' : ''
                        }`}
                        style={{
                          left: overlay.x * viewport.scale,
                          top: overlay.y * viewport.scale,
                          width: overlay.width * viewport.scale,
                          height: overlay.height * viewport.scale
                        }}
                        onPointerDown={(event) => startOverlayDrag(event, overlay)}
                      >
                        <img src={overlay.src} alt="Signature" draggable={false} />
                        {selected ? (
                          <button
                            className="signature-resize-handle"
                            onPointerDown={(event) => startSignatureResize(event, overlay)}
                            aria-label="Redimensionner la signature"
                          />
                        ) : null}
                      </div>
                    )
                  })}
                  {rendering ? (
                    <span className="pdf-render-badge">
                      <LoaderCircle className="spin" size={13} />
                      Rendu…
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="page-dock">
            <button
              className="dock-button"
              onClick={() => goToPage(pageIndex - 1)}
              disabled={pageIndex <= 0}
              aria-label="Page précédente"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="page-dock-label">
              Page <strong>{pageCount === 0 ? '–' : pageIndex + 1}</strong> / {pageCount || '–'}
            </span>
            <button
              className="dock-button"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={pageIndex >= pageCount - 1}
              aria-label="Page suivante"
            >
              <ChevronRight size={17} />
            </button>
            <span className="dock-divider" />
            <button
              className="dock-button"
              onClick={() => setZoom((current) => clamp(current - 0.15, MIN_ZOOM, MAX_ZOOM))}
              aria-label="Réduire le zoom"
            >
              <Minus size={15} />
            </button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              className="dock-button"
              onClick={() => setZoom((current) => clamp(current + 0.15, MIN_ZOOM, MAX_ZOOM))}
              aria-label="Agrandir le zoom"
            >
              <Plus size={15} />
            </button>
            <button className="dock-button" onClick={() => setZoom(1)} aria-label="Ajuster à la largeur">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        <aside className="inspector">
          {selectedText ? (
            <div className="inspector-pane">
              <div className="inspector-heading">
                <span className="inspector-heading-icon">
                  <Type size={16} />
                </span>
                <div>
                  <h3>Texte</h3>
                  <p>Éditez le contenu et le style.</p>
                </div>
              </div>
              <label className="field">
                <span>Contenu</span>
                <textarea
                  ref={textareaRef}
                  rows={4}
                  value={selectedText.text}
                  onFocus={beginEdit}
                  onChange={(event) =>
                    updateOverlay(selectedText.id, (overlay) =>
                      overlay.type === 'text' ? { ...overlay, text: event.target.value } : overlay
                    )
                  }
                  placeholder="Votre texte…"
                />
              </label>
              <div className="inspector-field">
                <div className="inspector-field-head">
                  <span>Taille</span>
                  <strong>{Math.round(selectedText.fontSize)} pt</strong>
                </div>
                <input
                  type="range"
                  min={8}
                  max={72}
                  step={1}
                  value={selectedText.fontSize}
                  onPointerDown={beginEdit}
                  onFocus={beginEdit}
                  onChange={(event) =>
                    updateOverlay(selectedText.id, (overlay) =>
                      overlay.type === 'text'
                        ? { ...overlay, fontSize: Number(event.target.value) }
                        : overlay
                    )
                  }
                />
              </div>
              <div className="inspector-field">
                <span className="inspector-label">Couleur</span>
                <div className="color-swatches">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`color-swatch ${selectedText.color === color ? 'is-active' : ''}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Couleur ${color}`}
                      onClick={() => {
                        beginEdit()
                        updateOverlay(selectedText.id, (overlay) =>
                          overlay.type === 'text' ? { ...overlay, color } : overlay
                        )
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                className={`style-toggle ${selectedText.bold ? 'is-active' : ''}`}
                onClick={() => {
                  beginEdit()
                  updateOverlay(selectedText.id, (overlay) =>
                    overlay.type === 'text' ? { ...overlay, bold: !overlay.bold } : overlay
                  )
                }}
                aria-pressed={selectedText.bold}
              >
                <Bold size={15} />
                Gras
              </button>
              <button
                className="button button-danger-ghost inspector-delete"
                onClick={() => removeOverlay(selectedText.id)}
              >
                <Trash2 size={15} />
                Supprimer le texte
              </button>
            </div>
          ) : selectedSignature ? (
            <div className="inspector-pane">
              <div className="inspector-heading">
                <span className="inspector-heading-icon">
                  <PenLine size={16} />
                </span>
                <div>
                  <h3>Signature</h3>
                  <p>Placez-la et ajustez sa taille.</p>
                </div>
              </div>
              <div className="signature-preview-card">
                <img src={selectedSignature.src} alt="Signature" />
              </div>
              <div className="inspector-field">
                <div className="inspector-field-head">
                  <span>Largeur</span>
                  <strong>{Math.round(selectedSignature.width)} pt</strong>
                </div>
                <input
                  type="range"
                  min={50}
                  max={Math.max(60, Math.round(displayWidth - selectedSignature.x))}
                  step={1}
                  value={selectedSignature.width}
                  onPointerDown={beginEdit}
                  onFocus={beginEdit}
                  onChange={(event) => {
                    const width = Number(event.target.value)
                    const height = width / selectedSignature.aspect
                    updateOverlay(selectedSignature.id, (overlay) =>
                      overlay.type === 'signature'
                        ? {
                            ...overlay,
                            width,
                            height: Math.min(height, Math.max(20, displayHeight - overlay.y))
                          }
                        : overlay
                    )
                  }}
                />
              </div>
              <p className="inspector-note">
                Astuce : faites glisser la poignée en bas à droite de la signature pour la
                redimensionner.
              </p>
              <button
                className="button button-danger-ghost inspector-delete"
                onClick={() => removeOverlay(selectedSignature.id)}
              >
                <Trash2 size={15} />
                Supprimer la signature
              </button>
            </div>
          ) : selectedAnnotation ? (
            <div className="inspector-pane">
              <div className="inspector-heading">
                <span className="inspector-heading-icon">
                  {selectedAnnotation.type === 'highlight' ? (
                    <Highlighter size={16} />
                  ) : selectedAnnotation.type === 'ink' ? (
                    <Pencil size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                </span>
                <div>
                  <h3>
                    {selectedAnnotation.type === 'highlight'
                      ? 'Surlignage'
                      : selectedAnnotation.type === 'ink'
                        ? 'Encre'
                        : 'Forme'}
                  </h3>
                  <p>Réglez le style de l’annotation.</p>
                </div>
              </div>

              {selectedAnnotation.type === 'shape' ? (
                <div className="inspector-field">
                  <span className="inspector-label">Forme</span>
                  <div className="format-switch" role="group" aria-label="Type de forme">
                    {(['rect', 'arrow'] as const).map((kind) => (
                      <button
                        key={kind}
                        className={selectedAnnotation.kind === kind ? 'is-active' : ''}
                        onClick={() => {
                          beginEdit()
                          updateOverlay(selectedAnnotation.id, (overlay) =>
                            overlay.type === 'shape' ? { ...overlay, kind } : overlay
                          )
                        }}
                        aria-pressed={selectedAnnotation.kind === kind}
                      >
                        {kind === 'rect' ? 'Rectangle' : 'Flèche'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="inspector-field">
                <span className="inspector-label">Couleur</span>
                <div className="color-swatches">
                  {ANNOTATION_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`color-swatch ${
                        selectedAnnotation.color === color ? 'is-active' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Couleur ${color}`}
                      onClick={() => {
                        beginEdit()
                        updateOverlay(selectedAnnotation.id, (overlay) => ({
                          ...overlay,
                          color
                        }))
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="inspector-field">
                <div className="inspector-field-head">
                  <span>Opacité</span>
                  <strong>{Math.round(selectedAnnotation.opacity * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={Math.round(selectedAnnotation.opacity * 100)}
                  onPointerDown={beginEdit}
                  onFocus={beginEdit}
                  onChange={(event) => {
                    const opacity = Number(event.target.value) / 100
                    updateOverlay(selectedAnnotation.id, (overlay) => ({
                      ...overlay,
                      opacity
                    }))
                  }}
                />
              </div>

              {selectedAnnotation.type !== 'highlight' ? (
                <div className="inspector-field">
                  <div className="inspector-field-head">
                    <span>Épaisseur</span>
                    <strong>{Math.round(selectedAnnotation.strokeWidth)} pt</strong>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={18}
                    step={1}
                    value={selectedAnnotation.strokeWidth}
                    onPointerDown={beginEdit}
                    onFocus={beginEdit}
                    onChange={(event) => {
                      const strokeWidth = Number(event.target.value)
                      updateOverlay(selectedAnnotation.id, (overlay) =>
                        'strokeWidth' in overlay ? { ...overlay, strokeWidth } : overlay
                      )
                    }}
                  />
                </div>
              ) : null}

              <button
                className="button button-danger-ghost inspector-delete"
                onClick={() => removeOverlay(selectedAnnotation.id)}
              >
                <Trash2 size={15} />
                Supprimer l’annotation
              </button>
            </div>
          ) : (
            <div className="inspector-pane">
              <div className="inspector-heading">
                <span className="inspector-heading-icon">
                  <FileText size={16} />
                </span>
                <div>
                  <h3>Document</h3>
                  <p>Organisez les pages et les annotations.</p>
                </div>
              </div>

              <div className="document-summary">
                <div className="summary-row">
                  <span>Pages</span>
                  <strong>{pageCount}</strong>
                </div>
                <div className="summary-row">
                  <span>Taille</span>
                  <strong>{formatBytes(scanSource.size)}</strong>
                </div>
                <div className="summary-row">
                  <span>Annotations</span>
                  <strong>
                    {editState.pages.reduce(
                      (sum, page) => sum + (editState.overlays[page.id]?.length ?? 0),
                      0
                    )}
                  </strong>
                </div>
              </div>

              <div className="inspector-section">
                <span className="inspector-label">Page {pageIndex + 1}</span>
                <div className="page-action-grid">
                  <button
                    className="button button-ghost button-small"
                    onClick={() => movePage(-1)}
                    disabled={pageIndex <= 0}
                  >
                    <MoveUp size={14} />
                    Avant
                  </button>
                  <button
                    className="button button-ghost button-small"
                    onClick={() => movePage(1)}
                    disabled={pageIndex >= pageCount - 1}
                  >
                    <MoveDown size={14} />
                    Après
                  </button>
                  <button
                    className="button button-ghost button-small"
                    onClick={duplicatePage}
                    disabled={editState.pages.length === 0}
                  >
                    Dupliquer
                  </button>
                  <button
                    className="button button-ghost button-small"
                    onClick={() => void insertPdf()}
                    disabled={inserting}
                  >
                    {inserting ? 'Insertion…' : 'Insérer un PDF'}
                  </button>
                </div>
                <button
                  className="button button-danger-ghost button-small button-full"
                  onClick={deletePage}
                  disabled={pageCount <= 1}
                >
                  <Trash2 size={14} />
                  Supprimer cette page
                </button>
                <button
                  className="button button-ghost button-small button-full"
                  onClick={() => setExtractOpen((current) => !current)}
                  aria-expanded={extractOpen}
                >
                  <Download size={14} />
                  Extraire des pages
                </button>
                {extractOpen ? (
                  <div className="extract-panel">
                    <div className="extract-grid" role="group" aria-label="Pages à extraire">
                      {editState.pages.map((page, index) => (
                        <button
                          key={page.id}
                          className={extractSelection.has(index) ? 'is-selected' : ''}
                          onClick={() => toggleExtractPage(index)}
                          aria-pressed={extractSelection.has(index)}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                    <div className="extract-actions">
                      <button
                        className="link-button"
                        onClick={() =>
                          setExtractSelection(
                            new Set(editState.pages.map((_, index) => index))
                          )
                        }
                      >
                        Tout
                      </button>
                      <button
                        className="link-button"
                        onClick={() => setExtractSelection(new Set())}
                      >
                        Aucune
                      </button>
                      <button
                        className="button button-accent button-small"
                        onClick={() => void extractPages()}
                        disabled={extracting || extractSelection.size === 0}
                      >
                        {extracting ? 'Extraction…' : 'Extraire'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="inspector-tip">
                <span className="tip-spark">✦</span>
                <p>
                  Sélectionnez un texte ou une signature sur la page pour modifier son style.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {signatureModal ? (
        <SignatureModal
          onClose={() => setSignatureModal(false)}
          onUse={(signature) => {
            setSignatureModal(false)
            setPendingSignature(signature)
            setTool('signature')
          }}
        />
      ) : null}

      {closeConfirm ? (
        <ConfirmDialog
          title="Quitter sans enregistrer ?"
          subtitle="Vos annotations ne sont pas encore enregistrées."
          confirmLabel="Quitter sans enregistrer"
          cancelLabel="Continuer l’édition"
          onCancel={() => setCloseConfirm(false)}
          onConfirm={onClose}
        >
          <p>
            Les modifications apportées à <strong>{scanSource.name}</strong> seront perdues.
            Vous pouvez aussi utiliser « Enregistrer » pour conserver une copie.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
