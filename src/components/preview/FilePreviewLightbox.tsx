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

/**
 * @file FilePreviewLightbox — the accessible preview dialog for FILE_PREVIEW values: the full-size
 * image with zoom, a same-origin PDF, a video or audio player, or a file card with open and
 * download links; with the file's details and arrow-key navigation across the gallery. Loaded
 * on demand by {@link FilePreviewGallery}.
 */

'use client'

import React, { useCallback, useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, Download, ExternalLink, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'

import type { FilePreviewItem } from '@/lib/utils/file-preview'
import { apiUrl } from '@/lib/api/client'
import { attachmentUrl } from '@/lib/utils/adornment-utils'
import { cn } from '@/lib/utils/cn'
import { formatBytes, isSameOrigin } from '@/lib/utils/file-preview'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'
import { FileKindIcon } from './FileKindIcon'

/** Zoom steps of an image preview (1 = fit to the window). */
export const ZOOM_STEPS = [1, 1.5, 2, 3, 4]

/** Props for {@link FilePreviewLightbox}. */
export interface FilePreviewLightboxProps {
  /** The files the preview steps through. */
  items: FilePreviewItem[]
  /** Index of the file shown. */
  index: number
  /** Called with the index to show next. */
  onIndexChange: (index: number) => void
  /** Called when the preview closes. */
  onClose: () => void
}

/**
 * The preview dialog. Escape closes it, focus is trapped while it is open and returns to the
 * thumbnail that opened it; Left/Right (and Home/End) step through the items; `+`, `-` and `0`
 * zoom an image, as do the toolbar buttons and a double click.
 *
 * @param props - See {@link FilePreviewLightboxProps}.
 * @returns The dialog.
 */
export function FilePreviewLightbox({ items, index, onIndexChange, onClose }: FilePreviewLightboxProps) {
  const restoreFocus = useRestoreFocus(true)
  const item = items[Math.min(Math.max(index, 0), items.length - 1)]
  const count = items.length
  const [zoom, setZoom] = useState(1)
  const [failed, setFailed] = useState(false)
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    setZoom(1)
    setFailed(false)
    setNatural(null)
  }, [index])

  // warm the browser cache with the neighbouring images, so stepping through is instant
  useEffect(() => {
    if (count < 2 || typeof Image === 'undefined') return
    for (const neighbour of [items[(index + 1) % count], items[(index - 1 + count) % count]]) {
      if (neighbour?.kind === 'image' && neighbour.url) new Image().src = neighbour.url
    }
  }, [items, index, count])

  const go = useCallback((delta: number) => {
    if (count > 1) onIndexChange((index + delta + count) % count)
  }, [count, index, onIndexChange])

  const zoomBy = useCallback((direction: 1 | -1) => {
    setZoom((current) => {
      const position = ZOOM_STEPS.indexOf(current)
      const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, position + direction))]
      return next ?? 1
    })
  }, [])

  if (!item) return null
  const isImage = item.kind === 'image' && !failed
  const width = item.width ?? natural?.width
  const height = item.height ?? natural?.height

  /**
   * Keyboard navigation and zoom; keys typed into a media player's controls are left to it.
   *
   * @param event - The key event.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('video, audio, iframe, input, textarea, select')) return
    if (event.altKey || event.ctrlKey || event.metaKey) return
    let handled = true
    if (event.key === 'ArrowRight') go(1)
    else if (event.key === 'ArrowLeft') go(-1)
    else if (event.key === 'Home' && count > 1) onIndexChange(0)
    else if (event.key === 'End' && count > 1) onIndexChange(count - 1)
    else if (isImage && (event.key === '+' || event.key === '=')) zoomBy(1)
    else if (isImage && event.key === '-') zoomBy(-1)
    else if (isImage && event.key === '0') setZoom(1)
    else handled = false
    if (handled) event.preventDefault()
  }

  const details = [
    item.mimeType && { label: 'Type', value: item.mimeType },
    item.sizeBytes !== undefined && { label: 'Size', value: formatBytes(item.sizeBytes) },
    width && height && { label: 'Dimensions', value: `${width} × ${height} px` },
  ].filter(Boolean) as Array<{ label: string; value: string }>

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-black/80" />
        <Dialog.Content
          onCloseAutoFocus={restoreFocus}
          onKeyDown={handleKeyDown}
          className="fixed inset-2 z-[2001] flex flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-xl focus:outline-none sm:inset-6"
          data-qqq-id="file-preview-dialog"
          data-preview-kind={item.kind}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold" title={item.fileName} data-qqq-id="file-preview-title">
                {item.fileName}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground" aria-live="polite" data-qqq-id="file-preview-position">
                {count > 1 ? `${index + 1} of ${count}` : 'Preview'}
                {count > 1 && <span className="sr-only">. Use the left and right arrow keys to see the others.</span>}
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-1" role="toolbar" aria-label="Preview actions">
              {isImage && (
                <>
                  <ToolbarButton label="Zoom out" onClick={() => zoomBy(-1)} disabled={zoom <= ZOOM_STEPS[0]} id="zoom-out"><ZoomOut className="h-4 w-4" aria-hidden="true" /></ToolbarButton>
                  <ToolbarButton label={zoom === 1 ? 'Fit to window' : `Zoom ${Math.round(zoom * 100)}%, fit to window`} onClick={() => setZoom(1)} id="zoom-fit">
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                    <span className="ml-1 min-w-9 text-xs tabular-nums" aria-hidden="true">{Math.round(zoom * 100)}%</span>
                  </ToolbarButton>
                  <ToolbarButton label="Zoom in" onClick={() => zoomBy(1)} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} id="zoom-in"><ZoomIn className="h-4 w-4" aria-hidden="true" /></ToolbarButton>
                </>
              )}
              <FileActions item={item} />
              <Dialog.Close asChild>
                <button type="button" aria-label="Close preview" data-qqq-id="file-preview-close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-muted/40">
            <PreviewStage item={item} zoom={zoom} failed={failed} onFailed={() => setFailed(true)}
              onNaturalSize={setNatural} onToggleZoom={() => setZoom((current) => (current === 1 ? 2 : 1))} />
            {count > 1 && (
              <>
                <NavButton side="left" label="Previous file" onClick={() => go(-1)}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></NavButton>
                <NavButton side="right" label="Next file" onClick={() => go(1)}><ChevronRight className="h-5 w-5" aria-hidden="true" /></NavButton>
              </>
            )}
          </div>

          {(details.length > 0 || item.caption) && (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-border px-3 py-2 text-xs sm:px-4" data-qqq-id="file-preview-details">
              {item.caption && <p className="w-full text-sm text-foreground">{item.caption}</p>}
              {details.length > 0 && (
                <dl className="flex flex-wrap gap-x-6 gap-y-1">
                  {details.map((detail) => (
                    <div key={detail.label} className="flex gap-1.5">
                      <dt className="text-muted-foreground">{detail.label}</dt>
                      <dd className="font-medium tabular-nums">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * The previewed file itself, by kind.
 *
 * @param props - The item, zoom and callbacks.
 * @returns The stage content.
 */
function PreviewStage({ item, zoom, failed, onFailed, onNaturalSize, onToggleZoom }: {
  item: FilePreviewItem
  zoom: number
  failed: boolean
  onFailed: () => void
  onNaturalSize: (size: { width: number; height: number }) => void
  onToggleZoom: () => void
}) {
  const [fitWidth, setFitWidth] = useState<number | null>(null)

  if (failed || item.kind === 'other' || !item.url) {
    return <Unavailable item={item} reason={failed ? 'This file could not be loaded.' : 'No preview is available for this type of file.'} />
  }

  if (item.kind === 'image') {
    const zoomed = zoom > 1 && fitWidth
    return (
      <div className={cn('absolute inset-0 overflow-auto p-4', !zoomed && 'flex items-center justify-center')} data-qqq-id="file-preview-stage">
        {/* eslint-disable-next-line @next/next/no-img-element -- record URLs from any allowed origin; the static export has no image optimizer */}
        <img
          key={item.url}
          src={item.url}
          alt={item.alt}
          decoding="async"
          draggable={false}
          onDoubleClick={onToggleZoom}
          onLoad={(event) => {
            const image = event.currentTarget
            onNaturalSize({ width: image.naturalWidth, height: image.naturalHeight })
            setFitWidth(image.getBoundingClientRect().width || null)
          }}
          onError={onFailed}
          className={cn('select-none', zoomed ? 'mx-auto max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain')}
          style={zoomed ? { width: `${Math.round(fitWidth * zoom)}px` } : undefined}
          data-qqq-id="file-preview-image"
          data-zoom={zoom}
        />
      </div>
    )
  }

  if (item.kind === 'pdf') {
    // frames are limited to the dashboard's own origin by its Content-Security-Policy
    if (!isSameOrigin(item.url)) {
      return <Unavailable item={item} reason="This PDF is on another site, so it opens in a new tab instead of here." />
    }
    return <iframe src={item.url} title={item.fileName} className="absolute inset-0 h-full w-full border-0 bg-white" data-qqq-id="file-preview-pdf" />
  }

  if (item.kind === 'video') {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <video key={item.url} src={item.url} controls preload="metadata" className="max-h-full max-w-full" onError={onFailed} data-qqq-id="file-preview-video">
          <track kind="captions" />
        </video>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4">
      <FileKindIcon kind="audio" className="h-16 w-16 text-muted-foreground" />
      <audio key={item.url} src={item.url} controls preload="metadata" className="w-full max-w-md" onError={onFailed} data-qqq-id="file-preview-audio" />
    </div>
  )
}

/**
 * The fallback for a file that cannot be shown here: its icon, name and open/download links.
 *
 * @param props - The item and why it is not shown.
 * @returns The fallback panel.
 */
function Unavailable({ item, reason }: { item: FilePreviewItem; reason: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" data-qqq-id="file-preview-unavailable">
      <FileKindIcon kind={item.kind} className="h-16 w-16 text-muted-foreground" />
      <p className="max-w-md break-all text-sm font-medium">{item.fileName}</p>
      <p className="max-w-md text-sm text-muted-foreground">{reason}</p>
    </div>
  )
}

/**
 * Open-in-new-tab and download links for the full-size file.
 *
 * @param props - The item.
 * @returns The links.
 */
function FileActions({ item }: { item: FilePreviewItem }) {
  if (!item.url) return null
  // backend field downloads honour ?download=1; other URLs rely on the download attribute (same origin)
  const backendFile = item.url.startsWith(apiUrl('/table/'))
  const downloadHref = backendFile ? attachmentUrl(item.url) : item.url
  const linkClass = 'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className={linkClass} title="Open original" data-qqq-id="file-preview-open">
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Open original (opens in a new tab)</span>
      </a>
      <a href={downloadHref} download={item.fileName} className={linkClass} title="Download" data-qqq-id="file-preview-download">
        <Download className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Download {item.fileName}</span>
      </a>
    </>
  )
}

/**
 * An icon button of the toolbar.
 *
 * @param props - Label, handler, state and icon.
 * @returns The button.
 */
function ToolbarButton({ label, onClick, disabled, id, children }: { label: string; onClick: () => void; disabled?: boolean; id: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} data-qqq-id={`file-preview-${id}`}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40">
      {children}
    </button>
  )
}

/**
 * A previous/next button over the stage.
 *
 * @param props - Side, label, handler and icon.
 * @returns The button.
 */
function NavButton({ side, label, onClick, children }: { side: 'left' | 'right'; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} data-qqq-id={`file-preview-${side === 'left' ? 'previous' : 'next'}`}
      className={cn('absolute top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        side === 'left' ? 'left-2' : 'right-2')}>
      {children}
    </button>
  )
}

export default FilePreviewLightbox
