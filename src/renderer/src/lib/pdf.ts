import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjs }
export type { PDFDocumentProxy, PDFPageProxy }

export interface OpenedPdf {
  document: PDFDocumentProxy
  destroy: () => Promise<void>
}

export async function openPdf(bytes: Uint8Array): Promise<OpenedPdf> {
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false
  })
  const document = await loadingTask.promise
  return {
    document,
    destroy: async () => {
      await loadingTask.destroy()
    }
  }
}

export async function renderPdfThumbnail(bytes: Uint8Array): Promise<string> {
  const opened = await openPdf(bytes)
  try {
    const page = await opened.document.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1.6, 720 / Math.max(base.width, base.height))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponible.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport }).promise
    return canvas.toDataURL('image/png')
  } finally {
    await opened.destroy()
  }
}

export function renderPdfPageToCanvas(
  page: PDFPageProxy,
  scale: number,
  canvas: HTMLCanvasElement,
  devicePixelRatio = window.devicePixelRatio || 1
): { viewport: ReturnType<PDFPageProxy['getViewport']>; renderTask: ReturnType<PDFPageProxy['render']> } {
  const viewport = page.getViewport({ scale })
  canvas.width = Math.max(1, Math.floor(viewport.width * devicePixelRatio))
  canvas.height = Math.max(1, Math.floor(viewport.height * devicePixelRatio))
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponible.')
  context.save()
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.restore()

  const renderTask = page.render({
    canvasContext: context,
    viewport,
    transform: devicePixelRatio === 1 ? undefined : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
  })

  return { viewport, renderTask }
}
