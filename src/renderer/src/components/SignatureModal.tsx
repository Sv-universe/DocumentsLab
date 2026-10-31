import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Eraser, ImageUp, PenLine, RotateCcw, Upload } from 'lucide-react'
import type { SignatureAsset } from '../lib/pdf-types'
import { loadImage, readFileAsDataUrl } from '../lib/image'
import { Modal } from './Modal'

interface SignatureModalProps {
  onClose: () => void
  onUse: (signature: SignatureAsset) => void
}

interface Point {
  x: number
  y: number
}

interface Stroke {
  points: Point[]
  color: string
  width: number
}

const COLORS = ['#1C1917', '#1D4ED8', '#C81E1E']
const WIDTHS = [2.2, 3.4, 4.8]
const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 240

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 1) {
    const [point] = stroke.points
    context.beginPath()
    context.fillStyle = stroke.color
    context.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2)
    context.fill()
    return
  }
  context.beginPath()
  context.strokeStyle = stroke.color
  context.lineWidth = stroke.width
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (let index = 1; index < stroke.points.length; index += 1) {
    context.lineTo(stroke.points[index].x, stroke.points[index].y)
  }
  context.stroke()
}

export function SignatureModal({ onClose, onUse }: SignatureModalProps) {
  const [mode, setMode] = useState<'draw' | 'upload'>('draw')
  const [color, setColor] = useState(COLORS[0])
  const [penWidth, setPenWidth] = useState(WIDTHS[1])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [drawing, setDrawing] = useState(false)
  const [uploadedSrc, setUploadedSrc] = useState('')
  const [uploadedAspect, setUploadedAspect] = useState(1)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentStroke = useRef<Stroke | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = CANVAS_WIDTH * ratio
    canvas.height = CANVAS_HEIGHT * ratio
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    for (const stroke of strokes) drawStroke(context, stroke)
  }, [strokes])

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
    }
  }

  const startStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    currentStroke.current = { points: [point], color, width: penWidth }
    setDrawing(true)
    setError('')
    const context = canvas.getContext('2d')
    if (context) drawStroke(context, currentStroke.current)
  }

  const continueStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !currentStroke.current) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const point = pointFromEvent(event)
    const points = currentStroke.current.points
    const previous = points[points.length - 1]
    points.push(point)
    context.beginPath()
    context.strokeStyle = currentStroke.current.color
    context.lineWidth = currentStroke.current.width
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.moveTo(previous.x, previous.y)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  const endStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    canvas?.releasePointerCapture(event.pointerId)
    if (currentStroke.current && currentStroke.current.points.length > 0) {
      const finished = currentStroke.current
      currentStroke.current = null
      setStrokes((current) => [...current, finished])
    }
    setDrawing(false)
  }

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const image = await loadImage(dataUrl)
      setUploadedSrc(dataUrl)
      setUploadedAspect(image.naturalWidth / Math.max(1, image.naturalHeight))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image illisible.')
    }
  }

  const use = () => {
    if (mode === 'upload') {
      if (!uploadedSrc) {
        setError('Choisissez d’abord une image de signature.')
        return
      }
      onUse({ src: uploadedSrc, aspect: uploadedAspect })
      return
    }
    if (strokes.length === 0 || !canvasRef.current) {
      setError('Dessinez votre signature dans le cadre.')
      return
    }
    onUse({
      src: canvasRef.current.toDataURL('image/png'),
      aspect: CANVAS_WIDTH / CANVAS_HEIGHT
    })
  }

  return (
    <Modal
      title="Ajouter votre signature"
      subtitle="Elle sera intégrée au PDF exporté. Votre signature ne quitte jamais cet appareil."
      size="large"
      className="signature-modal"
      onClose={onClose}
      footer={
        <>
          <span className="signature-footnote">
            <PenLine size={14} />
            Signature locale, aplatie à l’enregistrement
          </span>
          <div className="modal-footer-actions">
            <button className="button button-ghost" onClick={onClose}>
              Annuler
            </button>
            <button className="button button-accent" onClick={use}>
              Utiliser cette signature
            </button>
          </div>
        </>
      }
    >
      <div className="signature-tabs" role="tablist">
        <button
          className={mode === 'draw' ? 'is-active' : ''}
          onClick={() => setMode('draw')}
          role="tab"
          aria-selected={mode === 'draw'}
        >
          <PenLine size={15} />
          Dessiner
        </button>
        <button
          className={mode === 'upload' ? 'is-active' : ''}
          onClick={() => setMode('upload')}
          role="tab"
          aria-selected={mode === 'upload'}
        >
          <ImageUp size={15} />
          Importer une image
        </button>
      </div>

      {mode === 'draw' ? (
        <div className="signature-draw-pane">
          <div className="signature-pad-wrap">
            <canvas
              ref={canvasRef}
              className="signature-pad"
              onPointerDown={startStroke}
              onPointerMove={continueStroke}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
              aria-label="Zone de dessin de la signature"
            />
            {strokes.length === 0 ? (
              <div className="signature-placeholder" aria-hidden="true">
                <span>Signez ici</span>
                <small>À la souris, au trackpad ou au stylet</small>
              </div>
            ) : null}
            <div className="signature-baseline" aria-hidden="true" />
          </div>

          <div className="signature-controls">
            <div className="signature-control-group">
              <span className="control-label">Encre</span>
              <div className="color-swatches">
                {COLORS.map((value) => (
                  <button
                    key={value}
                    className={`color-swatch ${color === value ? 'is-active' : ''}`}
                    style={{ backgroundColor: value }}
                    onClick={() => setColor(value)}
                    aria-label={`Couleur ${value}`}
                    aria-pressed={color === value}
                  />
                ))}
              </div>
            </div>
            <div className="signature-control-group">
              <span className="control-label">Trait</span>
              <div className="width-swatches">
                {WIDTHS.map((value) => (
                  <button
                    key={value}
                    className={`width-swatch ${penWidth === value ? 'is-active' : ''}`}
                    onClick={() => setPenWidth(value)}
                    aria-label={`Épaisseur ${value}`}
                    aria-pressed={penWidth === value}
                  >
                    <span style={{ width: value * 3, height: value * 3 }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="signature-control-actions">
              <button
                className="button button-mini button-ghost"
                onClick={() => setStrokes((current) => current.slice(0, -1))}
                disabled={strokes.length === 0}
              >
                <RotateCcw size={13} />
                Annuler
              </button>
              <button
                className="button button-mini button-ghost"
                onClick={() => setStrokes([])}
                disabled={strokes.length === 0}
              >
                <Eraser size={13} />
                Effacer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="signature-upload-pane">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          {uploadedSrc ? (
            <div className="uploaded-signature-preview">
              <img src={uploadedSrc} alt="Aperçu de la signature importée" />
              <button
                className="button button-mini button-ghost"
                onClick={() => setUploadedSrc('')}
              >
                Changer d’image
              </button>
            </div>
          ) : (
            <button className="upload-drop" onClick={() => fileInputRef.current?.click()}>
              <span className="upload-drop-icon">
                <Upload size={24} />
              </span>
              <strong>Choisir une image de signature</strong>
              <span>PNG transparent recommandé · JPG, PNG ou WebP</span>
            </button>
          )}
          <p className="signature-upload-note">
            Pour un meilleur résultat, utilisez une image détourée sur fond transparent.
          </p>
        </div>
      )}

      {error ? <p className="field-error signature-error">{error}</p> : null}
    </Modal>
  )
}
