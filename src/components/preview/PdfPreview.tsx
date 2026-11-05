/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** @file Canvas-only PDF pages with a real parser worker, bounded resources and no document actions. */
'use client'
import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFDocumentLoadingTask, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { loadPdfPreviewBytes, PDF_PAGE_LIMIT, PDF_PIXEL_LIMIT } from '@/lib/api/pdf-preview'

/** No document-selected auxiliary URL is fetched by the main thread. */
class NoExternalPdfData {
  /** Reject an auxiliary request instead of resolving any document-selected URL.
   * @returns A rejected resource request.
   */
  async fetch(): Promise<Uint8Array> { throw new Error('External PDF resources are disabled') }
}

/** Render a PDF as pixels/text only; the browser never navigates to the uploaded content.
 * @param props - Authorized source URL and accessible document name.
 * @returns Bounded page controls, canvas and optional plain text.
 */
export function PdfPreview({ url, fileName }: { url: string; fileName: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(true)
  const [text, setText] = useState('')
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    let task: PDFDocumentLoadingTask | undefined
    let worker: Worker | undefined
    let disposed = false
    setDocument(null); setPage(1); setError(false); setBusy(true)
    const timeout = setTimeout(() => { abort.abort(); worker?.terminate(); if (!disposed) { setError(true); setBusy(false) } }, 30_000)
    void (async () => {
      const bytes = await loadPdfPreviewBytes(url, abort.signal)
      const pdf = await import('pdfjs-dist')
      abort.signal.throwIfAborted()
      // Supplying a real port avoids PDF.js's main-thread fake-worker fallback.
      worker = new Worker('/pdf-generated/pdf-6.4.299.worker.js', { type: 'module', name: 'qqq-pdf-preview' })
      workerRef.current = worker
      const parser = pdf.PDFWorker.create({ port: worker })
      task = pdf.getDocument({ data: bytes, worker: parser, enableXfa: false,
        useWorkerFetch: false, useWasm: false, BinaryDataFactory: NoExternalPdfData,
        disableAutoFetch: true, disableRange: true, disableStream: true,
        maxImageSize: PDF_PIXEL_LIMIT, canvasMaxAreaInBytes: PDF_PIXEL_LIMIT * 4,
        disableFontFace: true, useSystemFonts: true, stopAtErrors: true, verbosity: 0,
      })
      const loaded = await task.promise
      if (loaded.numPages < 1 || loaded.numPages > PDF_PAGE_LIMIT) throw new Error('PDF page limit exceeded')
      if (!disposed && !abort.signal.aborted) setDocument(loaded)
    })().catch(() => { if (!disposed) { setError(true); setBusy(false); worker?.terminate() } }).finally(() => clearTimeout(timeout))
    return () => {
      disposed = true; abort.abort(); clearTimeout(timeout)
      worker?.terminate(); workerRef.current = null
      void task?.destroy().catch(() => {})
    }
  }, [url])

  useEffect(() => {
    if (!document || !canvas.current || error) return
    let disposed = false
    let render: RenderTask | undefined
    let loadedPage: PDFPageProxy | undefined
    let cancelText: (() => void) | undefined
    setBusy(true); setText('')
    const target = canvas.current
    const timeout = setTimeout(() => { render?.cancel(); cancelText?.(); workerRef.current?.terminate(); if (!disposed) { setError(true); setBusy(false) } }, 15_000)
    void (async () => {
      const pdfPage = await document.getPage(page)
      loadedPage = pdfPage
      if (disposed) return
      const natural = pdfPage.getViewport({ scale: 1 })
      if (!Number.isFinite(natural.width * natural.height) || natural.width <= 0 || natural.height <= 0) throw new Error('Invalid page size')
      const desired = Math.min(2, window.devicePixelRatio || 1) * zoom * Math.min(1.5, 1000 / natural.width)
      const scale = Math.min(desired, 8192 / natural.width, 8192 / natural.height, Math.sqrt(PDF_PIXEL_LIMIT / (natural.width * natural.height)))
      const viewport = pdfPage.getViewport({ scale })
      target.width = Math.max(1, Math.floor(viewport.width)); target.height = Math.max(1, Math.floor(viewport.height))
      const context = target.getContext('2d', { alpha: false })
      if (!context) throw new Error('Canvas unavailable')
      // No annotation, form, action, link, HTML or scripting layer is created.
      render = pdfPage.render({ canvas: target, canvasContext: context, viewport, annotationMode: 0 })
      await render.promise
      if (disposed) return
      const reader = pdfPage.streamTextContent().getReader()
      cancelText = () => { void reader.cancel().catch(() => {}) }
      const parts: string[] = []
      let characters = 0
      let items = 0
      try {
        while (!disposed && characters < 100_000 && items < 10_000) {
          const chunk = await reader.read()
          if (chunk.done || disposed) break
          for (const item of chunk.value.items) {
            if (++items > 10_000 || characters >= 100_000) break
            if ('str' in item) {
              const part = item.str.slice(0, 100_000 - characters)
              parts.push(part); characters += part.length + 1
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      }
      if (!disposed) { setText(parts.join(' ')); setBusy(false) }
    })().catch(() => { if (!disposed) { setError(true); setBusy(false) } }).finally(() => {
      clearTimeout(timeout)
      // PDF.js defers cleanup if a cancelled render still has pending work.
      loadedPage?.cleanup()
    })
    return () => { disposed = true; clearTimeout(timeout); render?.cancel(); cancelText?.() }
  }, [document, page, zoom, error])

  const button = 'min-h-11 rounded border border-border px-3 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring'
  return <section className="absolute inset-0 flex flex-col" aria-label={'PDF preview: ' + fileName} data-qqq-id="file-preview-pdf">
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card p-2" role="toolbar" aria-label="PDF page controls">
      <button type="button" className={button} disabled={!document || busy || error || page <= 1} onClick={() => setPage(page - 1)} data-qqq-id="pdf-previous">Previous page</button>
      <span role="status" aria-live="polite">{document ? 'Page ' + page + ' of ' + document.numPages : 'Loading PDF'}</span>
      <button type="button" className={button} disabled={!document || busy || error || page >= document.numPages} onClick={() => setPage(page + 1)} data-qqq-id="pdf-next">Next page</button>
      <button type="button" className={button} disabled={!document || busy || error || zoom <= 0.5} onClick={() => setZoom(zoom - 0.25)} data-qqq-id="pdf-zoom-out">Zoom out</button>
      <button type="button" className={button} disabled={!document || busy || error || zoom >= 2} onClick={() => setZoom(zoom + 0.25)} data-qqq-id="pdf-zoom-in">Zoom in</button>
    </div>
    {error ? <p role="alert" className="p-4">This PDF could not be safely previewed within the preview limits. Use Download to retain the original.</p>
      : <div className="min-h-0 flex-1 overflow-auto p-3" aria-busy={busy}>
        {busy && <p role="status">Rendering PDF page…</p>}
        <canvas ref={canvas} className="mx-auto max-w-full bg-white" role="img" aria-label={fileName + ', page ' + page} />
        <details className="mt-3 rounded border border-border bg-card p-3"><summary className="cursor-pointer" data-qqq-id="pdf-page-text">Page text</summary><p className="whitespace-pre-wrap">{text || 'No extractable text on this page.'}</p></details>
      </div>}
  </section>
}
