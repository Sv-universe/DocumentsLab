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
  Crop,
  Download,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  Minus,
  PenLine,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Undo2
} from 'lucide-react'
import type { ImageFormat } from '@shared/types'
import type { EditorSource, Notify } from '../lib/editor'
import { imageExportFormat, sourceExt, sourceName } from '../lib/editor'
import { formatBytes, sanitizeFileName } from '../lib/format'
import { canvasToBytes, imageFromBytes, mimeForExtension } from '../lib/image'
import {
  DEFAULT_FILTERS,
  buildCompositeCanvas,
  cropStrokes,
  makeCanvas,
  thumbnailDataUrl,
  transformStrokesForFlip,
  transformStrokesForRotation,
  type BaseImage,
  type CropRect,
  type ImageFilters,
  type PenStroke
} from '../lib/image-edit'
import { ConfirmDialog } from './ConfirmDialog'

interface ImageEditorProps {
  source: EditorSource
  onClose: () => void
  onSaved: (meta: import('@shared/types').DocumentMeta, bytes: Uint8Array) => void
  notify: Notify
  registerExport: (handler: (() => void) | null) => void
}

type Tool = 'pan' | 'pen'
type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const MIN_CROP = 0.04
const PEN_COLORS = ['#E11D48', '#1C1917', '#1D4ED8', '#F59E0B', '#ffffff']

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function fileLabel(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function ImageEditor({
  source,
  onClose,
  onSaved,
  notify,
  registerExport
}: ImageEditorProps) {
  const initialBytes = useRef(source.bytes).current
  const initialExt = useRef(sourceExt(source)).current
  const canReplace =
    source.kind === 'library' && ['png', 'jpg', 'jpeg', 'webp'].includes(source.meta.ext)
  const scanSource = useMemo(
    () => ({
      name: sourceName(source),
      ext: initialExt,
      size: source.kind === 'library' ? source.meta.size : source.file.size
    }),
    [initialExt, source]
  )

  const [base, setBase] = useState<BaseImage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState<ImageFilters>({ ...DEFAULT_FILTERS })
  const [strokes, setStrokes] = useState<PenStroke[]>([])
  const [tool, setTool] = useState<Tool>('pan')
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [penSize, setPenSize] = useState(6)
  const [zoom, setZoom] = useState(1)
  const [container, setContainer] = useState({ width: 0, height: 0 })
  const [cropMode, setCropMode] = useState(false)
  const [crop, setCrop] = useState<CropRect>({ x: 0.06, y: 0.06, width: 0.88, height: 0.88 })
  const [exportFormat, setExportFormat] = useState<ImageFormat>(imageExportFormat(initialExt))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)

  const originalRef = useRef<BaseImage | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const currentStroke = useRef<PenStroke | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    imageFromBytes(initialBytes, mimeForExtension(initialExt))
      .then((image) => {
        if (cancelled) return
        const loaded: BaseImage = {
          source: image,
          width: image.naturalWidth,
          height: image.naturalHeight
        }
        originalRef.current = loaded
        setBase(loaded)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setLoadError(reason instanceof Error ? reason.message : 'Cette image ne peut pas être ouverte.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialBytes, initialExt])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const update = () =>
      setContainer({ width: element.clientWidth, height: element.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const display = useMemo(() => {
    if (!base || container.width < 40 || container.height < 40) return null
    const availableWidth = Math.max(80, container.width - 110)
    const availableHeight = Math.max(80, container.height - 110)
    const fit = Math.min(availableWidth / base.width, availableHeight / base.height)
    const scale = Math.max(0.01, fit * zoom)
    return {
      width: base.width * scale,
      height: base.height * scale,
      scale
    }
  }, [base, container.height, container.width, zoom])

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !base || !display) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(display.width * ratio))
    canvas.height = Math.max(1, Math.round(display.height * ratio))
    canvas.style.width = `${display.width}px`
    canvas.style.height = `${display.height}px`
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, display.width, display.height)
    context.save()
    context.filter = [
      `brightness(${filters.brightness}%)`,
      `contrast(${filters.contrast}%)`,
      `saturate(${filters.saturation}%)`,
      `grayscale(${filters.grayscale}%)`
    ].join(' ')
    context.drawImage(base.source, 0, 0, display.width, display.height)
    context.restore()
    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue
      context.strokeStyle = stroke.color
      context.fillStyle = stroke.color
      context.lineWidth = Math.max(1, stroke.widthPx * display.scale)
      if (stroke.points.length === 1) {
        const point = stroke.points[0]
        context.beginPath()
        context.arc(
          point.x * display.width,
          point.y * display.height,
          context.lineWidth / 2,
          0,
          Math.PI * 2
        )
        context.fill()
        continue
      }
      context.beginPath()
      context.moveTo(stroke.points[0].x * display.width, stroke.points[0].y * display.height)
      for (let index = 1; index < stroke.points.length; index += 1) {
        context.lineTo(
          stroke.points[index].x * display.width,
          stroke.points[index].y * display.height
        )
      }
      context.stroke()
    }
    context.restore()
  }, [base, display, filters, strokes])

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (cropMode || tool !== 'pan' || event.button !== 0) return
    const viewport = viewportRef.current
    if (!viewport) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const originLeft = viewport.scrollLeft
    const originTop = viewport.scrollTop
    const move = (moveEvent: PointerEvent) => {
      viewport.scrollLeft = originLeft - (moveEvent.clientX - startX)
      viewport.scrollTop = originTop - (moveEvent.clientY - startY)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const pointOnCanvas = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = previewRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
    }
  }

  const startPen = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'pen' || cropMode || !display || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const canvas = previewRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    canvas.setPointerCapture(event.pointerId)
    const point = pointOnCanvas(event)
    const stroke: PenStroke = {
      id: crypto.randomUUID(),
      color: penColor,
      widthPx: penSize / display.scale,
      points: [point]
    }
    currentStroke.current = stroke
    context.save()
    context.fillStyle = penColor
    context.beginPath()
    context.arc(point.x * display.width, point.y * display.height, penSize / 2, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  const movePen = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = currentStroke.current
    if (!stroke || !display) return
    event.preventDefault()
    const canvas = previewRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const point = pointOnCanvas(event)
    const previous = stroke.points[stroke.points.length - 1]
    stroke.points.push(point)
    context.save()
    context.strokeStyle = stroke.color
    context.lineWidth = Math.max(1, stroke.widthPx * display.scale)
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(previous.x * display.width, previous.y * display.height)
    context.lineTo(point.x * display.width, point.y * display.height)
    context.stroke()
    context.restore()
  }

  const endPen = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = currentStroke.current
    if (!stroke) return
    previewRef.current?.releasePointerCapture(event.pointerId)
    currentStroke.current = null
    setStrokes((current) => [...current, stroke])
    setDirty(true)
  }

  const rotate = (clockwise: boolean) => {
    if (!base) return
    const next = makeCanvas(base.height, base.width)
    const context = next.getContext('2d')
    if (!context) return
    if (clockwise) {
      context.translate(next.width, 0)
      context.rotate(Math.PI / 2)
    } else {
      context.translate(0, next.height)
      context.rotate(-Math.PI / 2)
    }
    context.drawImage(base.source, 0, 0, base.width, base.height)
    setBase({ source: next, width: next.width, height: next.height })
    setStrokes((current) => transformStrokesForRotation(current, clockwise))
    setCropMode(false)
    setDirty(true)
  }

  const flip = (horizontal: boolean) => {
    if (!base) return
    const next = makeCanvas(base.width, base.height)
    const context = next.getContext('2d')
    if (!context) return
    if (horizontal) {
      context.translate(next.width, 0)
      context.scale(-1, 1)
    } else {
      context.translate(0, next.height)
      context.scale(1, -1)
    }
    context.drawImage(base.source, 0, 0, base.width, base.height)
    setBase({ source: next, width: next.width, height: next.height })
    setStrokes((current) => transformStrokesForFlip(current, horizontal))
    setDirty(true)
  }

  const startCrop = () => {
    setCropMode(true)
    setZoom(1)
    setTool('pan')
    setCrop({ x: 0.06, y: 0.06, width: 0.88, height: 0.88 })
  }

  const cancelCrop = () => {
    setCropMode(false)
    setCrop({ x: 0.06, y: 0.06, width: 0.88, height: 0.88 })
  }

  const applyCrop = () => {
    if (!base) return
    const pixelX = Math.round(crop.x * base.width)
    const pixelY = Math.round(crop.y * base.height)
    const pixelWidth = Math.max(1, Math.round(crop.width * base.width))
    const pixelHeight = Math.max(1, Math.round(crop.height * base.height))
    const next = makeCanvas(pixelWidth, pixelHeight)
    const context = next.getContext('2d')
    if (!context) return
    context.drawImage(
      base.source,
      pixelX,
      pixelY,
      pixelWidth,
      pixelHeight,
      0,
      0,
      pixelWidth,
      pixelHeight
    )
    setBase({ source: next, width: pixelWidth, height: pixelHeight })
    setStrokes((current) => cropStrokes(current, crop))
    setCropMode(false)
    setZoom(1)
    setDirty(true)
  }

  const startCropDrag = (event: ReactPointerEvent, handle: CropHandle) => {
    if (!display) return
    event.preventDefault()
    event.stopPropagation()
    const shell = shellRef.current
    if (!shell) return
    const rect = shell.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const origin = { ...crop }

    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / rect.width
      const dy = (moveEvent.clientY - startY) / rect.height
      let next: CropRect

      if (handle === 'move') {
        next = {
          ...origin,
          x: clamp(origin.x + dx, 0, 1 - origin.width),
          y: clamp(origin.y + dy, 0, 1 - origin.height)
        }
      } else {
        let left = origin.x
        let top = origin.y
        let right = origin.x + origin.width
        let bottom = origin.y + origin.height
        if (handle === 'nw' || handle === 'sw') left = clamp(origin.x + dx, 0, right - MIN_CROP)
        if (handle === 'ne' || handle === 'se') right = clamp(right + dx, left + MIN_CROP, 1)
        if (handle === 'nw' || handle === 'ne') top = clamp(origin.y + dy, 0, bottom - MIN_CROP)
        if (handle === 'sw' || handle === 'se') bottom = clamp(bottom + dy, top + MIN_CROP, 1)
        next = { x: left, y: top, width: right - left, height: bottom - top }
      }
      setCrop(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const resetImage = () => {
    if (!originalRef.current) return
    setBase(originalRef.current)
    setStrokes([])
    setFilters({ ...DEFAULT_FILTERS })
    setCropMode(false)
    setCrop({ x: 0.06, y: 0.06, width: 0.88, height: 0.88 })
    setZoom(1)
    setDirty(false)
    setExportFormat(imageExportFormat(initialExt))
    notify('Image réinitialisée.', 'info')
  }

  const buildCanvas = useCallback(
    (format: ImageFormat) => {
      if (!base) throw new Error('Image indisponible.')
      return buildCompositeCanvas(base, strokes, filters, {
        whiteBackground: format === 'jpg'
      })
    },
    [base, filters, strokes]
  )

  const exportCopy = useCallback(async () => {
    if (exporting || saving) return
    if (cropMode) {
      notify('Terminez ou annulez le recadrage avant d’exporter.', 'info')
      return
    }
    setExporting(true)
    try {
      const canvas = buildCanvas(exportFormat)
      const bytes = await canvasToBytes(canvas, exportFormat)
      const suffix = dirty ? ' - modifié' : ''
      const extension = exportFormat === 'jpg' ? 'jpg' : exportFormat
      const result = await window.doclab.saveFile({
        defaultName: `${sanitizeFileName(scanSource.name)}${suffix}.${extension}`,
        data: bytes,
        format: exportFormat
      })
      if (!result.canceled && result.filePath) {
        notify('Image exportée.', 'success', fileLabel(result.filePath))
      }
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'L’export de l’image a échoué.', 'error')
    } finally {
      setExporting(false)
    }
  }, [buildCanvas, cropMode, dirty, exportFormat, exporting, notify, saving, scanSource.name])

  const save = useCallback(async () => {
    if (saving || exporting) return
    if (cropMode) {
      notify('Terminez ou annulez le recadrage avant d’enregistrer.', 'info')
      return
    }
    if (source.kind !== 'library' || !canReplace) {
      await exportCopy()
      return
    }
    setSaving(true)
    try {
      const format = imageExportFormat(source.meta.ext)
      const canvas = buildCanvas(format)
      const bytes = await canvasToBytes(canvas, format)
      const updated = await window.doclab.replaceDocument({
        id: source.meta.id,
        data: bytes,
        width: base?.width,
        height: base?.height
      })
      let meta = updated
      try {
        meta = await window.doclab.saveThumbnail(source.meta.id, thumbnailDataUrl(canvas))
      } catch (reason) {
        console.warn('Miniature non régénérée', reason)
      }
      notify('Image enregistrée.', 'success')
      onSaved(meta, bytes)
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'L’enregistrement a échoué.', 'error')
    } finally {
      setSaving(false)
    }
  }, [
    base?.height,
    base?.width,
    buildCanvas,
    canReplace,
    cropMode,
    exporting,
    notify,
    onSaved,
    saving,
    source
  ])

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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      } else if (!typing && event.key === 'Escape') {
        if (cropMode) cancelCrop()
        else setTool('pan')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cropMode, save])

  const saveLabel = canReplace ? 'Enregistrer' : 'Enregistrer sous'
  const filterChanged =
    filters.brightness !== 100 ||
    filters.contrast !== 100 ||
    filters.saturation !== 100 ||
    filters.grayscale !== 0

  return (
    <div className="editor image-editor">
      <header className="editor-header">
        <div className="editor-title-group">
          <button className="back-button" onClick={requestClose} aria-label="Retour à la bibliothèque">
            <ArrowLeft size={18} />
          </button>
          <span className="editor-doc-icon editor-doc-icon-image">
            <ImageIcon size={20} />
          </span>
          <div className="editor-title-text">
            <div className="editor-title-line">
              <h2 title={scanSource.name}>{scanSource.name}</h2>
              <span className="type-chip type-chip-image">{scanSource.ext.toUpperCase()}</span>
              {dirty ? <span className="dirty-indicator">Modifié</span> : null}
            </div>
            <p>
              {base ? `${base.width} × ${base.height} px` : 'Image'}
              {' · '}
              {formatBytes(scanSource.size)}
              {source.kind === 'external' ? ' · Fichier externe' : ''}
            </p>
          </div>
        </div>

        <div className="editor-actions">
          <button
            className="button button-ghost button-small"
            onClick={() => void exportCopy()}
            disabled={exporting || saving || cropMode}
          >
            <Download size={15} />
            {exporting ? 'Export…' : 'Exporter'}
          </button>
          <button
            className="button button-accent button-small"
            onClick={() => void save()}
            disabled={saving || exporting || cropMode || loading}
          >
            <Save size={15} />
            {saving ? 'Enregistrement…' : saveLabel}
          </button>
        </div>
      </header>

      <div className="editor-body image-editor-body">
        <div className={`image-workspace tool-${tool}`}>
          <div className="image-tool-rail" aria-label="Outils image">
            <button
              className={tool === 'pan' && !cropMode ? 'is-active' : ''}
              onClick={() => setTool('pan')}
              disabled={cropMode}
              title="Déplacer la vue"
              aria-label="Déplacer la vue"
              aria-pressed={tool === 'pan' && !cropMode}
            >
              <Hand size={18} />
            </button>
            <button
              className={tool === 'pen' && !cropMode ? 'is-active' : ''}
              onClick={() => setTool('pen')}
              disabled={cropMode}
              title="Marqueur"
              aria-label="Marqueur"
              aria-pressed={tool === 'pen' && !cropMode}
            >
              <PenLine size={18} />
            </button>
            <button
              className={cropMode ? 'is-active' : ''}
              onClick={() => (cropMode ? cancelCrop() : startCrop())}
              title="Recadrer"
              aria-label="Recadrer"
              aria-pressed={cropMode}
            >
              <Crop size={18} />
            </button>
          </div>

          {cropMode ? (
            <div className="crop-toolbar">
              <span>
                <Crop size={15} />
                Ajustez le cadre de recadrage
              </span>
              <div>
                <button className="button button-mini button-ghost" onClick={cancelCrop}>
                  Annuler
                </button>
                <button className="button button-mini button-accent" onClick={applyCrop}>
                  Appliquer
                </button>
              </div>
            </div>
          ) : null}

          <div
            className="image-viewport"
            ref={viewportRef}
            onPointerDown={startPan}
            style={{ cursor: tool === 'pan' && !cropMode ? 'grab' : 'default' }}
          >
            {loading ? (
              <div className="pdf-stage-message">
                <LoaderCircle className="spin" size={26} />
                <p>Ouverture de l’image…</p>
              </div>
            ) : loadError ? (
              <div className="pdf-stage-message pdf-stage-error">
                <span className="stage-error-icon">IMG</span>
                <h3>Impossible d’ouvrir cette image</h3>
                <p>{loadError}</p>
                <button className="button button-ghost" onClick={onClose}>
                  Retour à la bibliothèque
                </button>
              </div>
            ) : display && base ? (
              <div
                className="image-canvas-shell"
                ref={shellRef}
                style={{ width: display.width, height: display.height }}
              >
                <canvas
                  ref={previewRef}
                  className="image-preview-canvas"
                  onPointerDown={startPen}
                  onPointerMove={movePen}
                  onPointerUp={endPen}
                  onPointerCancel={endPen}
                  style={{ cursor: tool === 'pen' && !cropMode ? 'crosshair' : 'inherit' }}
                />
                {cropMode ? (
                  <div className="crop-layer">
                    <div
                      className="crop-box"
                      style={{
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.width * 100}%`,
                        height: `${crop.height * 100}%`
                      }}
                      onPointerDown={(event) => startCropDrag(event, 'move')}
                    >
                      <span className="crop-grid" aria-hidden="true" />
                      {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                        <button
                          key={handle}
                          className={`crop-handle crop-handle-${handle}`}
                          onPointerDown={(event) => startCropDrag(event, handle)}
                          aria-label={`Ajuster le coin ${handle}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="page-dock">
            <button
              className="dock-button"
              onClick={() => setZoom((current) => clamp(current - 0.15, MIN_ZOOM, MAX_ZOOM))}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Réduire le zoom"
            >
              <Minus size={15} />
            </button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              className="dock-button"
              onClick={() => setZoom((current) => clamp(current + 0.15, MIN_ZOOM, MAX_ZOOM))}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Agrandir le zoom"
            >
              <Plus size={15} />
            </button>
            <span className="dock-divider" />
            <button className="dock-button" onClick={() => setZoom(1)} aria-label="Ajuster à l’écran">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        <aside className="inspector">
          <div className="inspector-pane">
            <div className="inspector-heading">
              <span className="inspector-heading-icon">
                <ImageIcon size={16} />
              </span>
              <div>
                <h3>Image</h3>
                <p>Transformez, retouchez, annotez.</p>
              </div>
            </div>

            <div className="document-summary">
              <div className="summary-row">
                <span>Dimensions</span>
                <strong>{base ? `${base.width} × ${base.height}` : '–'}</strong>
              </div>
              <div className="summary-row">
                <span>Taille</span>
                <strong>{formatBytes(scanSource.size)}</strong>
              </div>
              <div className="summary-row">
                <span>Traits</span>
                <strong>{strokes.length}</strong>
              </div>
            </div>

            <div className="inspector-section">
              <span className="inspector-label">Transformations</span>
              <div className="transform-grid">
                <button
                  className="transform-button"
                  onClick={() => rotate(false)}
                  disabled={cropMode}
                  title="Pivoter à gauche"
                >
                  <RotateCcw size={17} />
                  <span>Gauche</span>
                </button>
                <button
                  className="transform-button"
                  onClick={() => rotate(true)}
                  disabled={cropMode}
                  title="Pivoter à droite"
                >
                  <RotateCw size={17} />
                  <span>Droite</span>
                </button>
                <button
                  className="transform-button"
                  onClick={() => flip(true)}
                  disabled={cropMode}
                  title="Miroir horizontal"
                >
                  <FlipHorizontal2 size={17} />
                  <span>Miroir H</span>
                </button>
                <button
                  className="transform-button"
                  onClick={() => flip(false)}
                  disabled={cropMode}
                  title="Miroir vertical"
                >
                  <FlipVertical2 size={17} />
                  <span>Miroir V</span>
                </button>
              </div>
            </div>

            <div className="inspector-section">
              <div className="inspector-field-head">
                <span className="inspector-label">Réglages</span>
                {filterChanged ? (
                  <button
                    className="link-button"
                    onClick={() => {
                      setFilters({ ...DEFAULT_FILTERS })
                      setDirty(true)
                    }}
                  >
                    Réinitialiser
                  </button>
                ) : null}
              </div>
              <label className="slider-field">
                <span>Luminosité</span>
                <strong>{filters.brightness}%</strong>
                <input
                  type="range"
                  min={50}
                  max={150}
                  value={filters.brightness}
                  onChange={(event) => {
                    setFilters((current) => ({
                      ...current,
                      brightness: Number(event.target.value)
                    }))
                    setDirty(true)
                  }}
                />
              </label>
              <label className="slider-field">
                <span>Contraste</span>
                <strong>{filters.contrast}%</strong>
                <input
                  type="range"
                  min={50}
                  max={150}
                  value={filters.contrast}
                  onChange={(event) => {
                    setFilters((current) => ({
                      ...current,
                      contrast: Number(event.target.value)
                    }))
                    setDirty(true)
                  }}
                />
              </label>
              <label className="slider-field">
                <span>Saturation</span>
                <strong>{filters.saturation}%</strong>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={filters.saturation}
                  onChange={(event) => {
                    setFilters((current) => ({
                      ...current,
                      saturation: Number(event.target.value)
                    }))
                    setDirty(true)
                  }}
                />
              </label>
              <button
                className={`style-toggle ${filters.grayscale === 100 ? 'is-active' : ''}`}
                onClick={() => {
                  setFilters((current) => ({
                    ...current,
                    grayscale: current.grayscale === 100 ? 0 : 100
                  }))
                  setDirty(true)
                }}
                aria-pressed={filters.grayscale === 100}
              >
                <span className="grayscale-dot" />
                Noir et blanc
              </button>
            </div>

            <div className="inspector-section">
              <div className="inspector-field-head">
                <span className="inspector-label">Marqueur</span>
                <div className="marker-actions">
                  <button
                    className="icon-button icon-button-small"
                    onClick={() => {
                      setStrokes((current) => current.slice(0, -1))
                      setDirty(true)
                    }}
                    disabled={strokes.length === 0}
                    title="Annuler le dernier trait"
                    aria-label="Annuler le dernier trait"
                  >
                    <Undo2 size={14} />
                  </button>
                  <button
                    className="icon-button icon-button-small"
                    onClick={() => {
                      setStrokes([])
                      setDirty(true)
                    }}
                    disabled={strokes.length === 0}
                    title="Effacer tous les traits"
                    aria-label="Effacer tous les traits"
                  >
                    <Eraser size={14} />
                  </button>
                </div>
              </div>
              <div className="marker-controls">
                <div className="color-swatches">
                  {PEN_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`color-swatch ${penColor === color ? 'is-active' : ''} ${
                        color === '#ffffff' ? 'swatch-white' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setPenColor(color)}
                      aria-label={`Couleur ${color}`}
                      aria-pressed={penColor === color}
                    />
                  ))}
                </div>
                <label className="slider-field compact">
                  <span>Taille</span>
                  <strong>{penSize} px</strong>
                  <input
                    type="range"
                    min={2}
                    max={28}
                    value={penSize}
                    onChange={(event) => setPenSize(Number(event.target.value))}
                  />
                </label>
              </div>
            </div>

            <div className="inspector-section">
              <span className="inspector-label">Format d’export</span>
              <div className="format-switch" role="group" aria-label="Format d’export">
                {(['png', 'jpg', 'webp'] as const).map((format) => (
                  <button
                    key={format}
                    className={exportFormat === format ? 'is-active' : ''}
                    onClick={() => setExportFormat(format)}
                    aria-pressed={exportFormat === format}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
              {canReplace ? (
                <p className="inspector-note">
                  « Enregistrer » conserve le format d’origine. Le format choisi s’applique aux
                  exports.
                </p>
              ) : null}
            </div>

            <button className="button button-danger-ghost button-full" onClick={resetImage}>
              <RotateCcw size={14} />
              Réinitialiser l’image
            </button>
          </div>
        </aside>
      </div>

      {closeConfirm ? (
        <ConfirmDialog
          title="Quitter sans enregistrer ?"
          subtitle="Vos retouches ne sont pas encore enregistrées."
          confirmLabel="Quitter sans enregistrer"
          cancelLabel="Continuer l’édition"
          onCancel={() => setCloseConfirm(false)}
          onConfirm={onClose}
        >
          <p>
            Les transformations et annotations apportées à <strong>{scanSource.name}</strong>{' '}
            seront perdues.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
