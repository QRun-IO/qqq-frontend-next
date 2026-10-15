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
 * @file Editor for a FILE_UPLOAD field whose value is an upload ref (`valueIsUploadRef`, UI API
 * 1.7.0), such as the profile photo. The user drops or picks an image, crops it square, and it
 * goes to `POST /uploads`; the field's value becomes the returned ref, saved with the rest of the
 * form. The server re-checks and re-encodes everything; the checks here only spare a round trip.
 */
'use client'

import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ImagePlus, Trash2, ZoomIn } from 'lucide-react'
import { uploadFile } from '@/lib/api/uploads'
import { AuthContext } from '@/lib/auth/auth-provider'
import { useMyProfile } from '@/lib/hooks/use-my-profile'
import { cn } from '@/lib/utils/cn'
import { ALERT_CLASS, BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from '@/components/ui/controls'
import { UserAvatar } from '@/components/ui/UserAvatar'

/** Edge of the cropped image sent to the server (it resizes from here). */
const OUTPUT_EDGE = 512

/** Settings from the field's FILE_UPLOAD adornment. */
export interface ImageUploadSettings {
  /** Accepted MIME types. */
  accept: string[]
  /** Largest accepted file in bytes, if limited. */
  maxBytes?: number
  /** Preview and crop guide shape. */
  shape: 'square' | 'circle'
}

/**
 * Reads FILE_UPLOAD adornment values into settings.
 *
 * @param values - The adornment's values.
 * @returns Settings, or null when the field is not an upload-ref image field.
 */
export function imageUploadSettings(values: Record<string, unknown> | undefined): ImageUploadSettings | null {
  if (!values || values.valueIsUploadRef !== true) return null
  const accept = typeof values.accept === 'string' && values.accept ? values.accept.split(',').map((type) => type.trim()) : ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  return {
    accept: accept.filter((type) => type && type !== 'image/svg+xml'),
    maxBytes: typeof values.maxBytes === 'number' && values.maxBytes > 0 ? values.maxBytes : undefined,
    shape: values.imageShape === 'square' ? 'square' : 'circle',
  }
}

/**
 * Why a picked file can't be used, if it can't.
 *
 * @param file - The picked file.
 * @param settings - The field's settings.
 * @returns A message, or null when the file looks acceptable.
 */
export function imageFileProblem(file: File, settings: ImageUploadSettings): string | null {
  if (!settings.accept.includes(file.type)) return 'Use a PNG, JPEG, WebP or GIF image.'
  if (settings.maxBytes && file.size > settings.maxBytes) {
    return `That image is too large: the limit is ${Math.max(1, Math.round(settings.maxBytes / (1024 * 1024)))} MB.`
  }
  return null
}

/**
 * The image field: preview, drop zone, choose/replace and remove.
 *
 * @param props - The value, how to change it, and the field's settings.
 * @returns The editor.
 */
export function ImageUploadField({
  id,
  label,
  value,
  onChange,
  settings,
  disabled,
  describedBy,
  'data-qqq-id': dataQqqId,
}: {
  id: string
  label: string
  /** The saved URL, a pending upload ref, or null. */
  value: unknown
  onChange: (value: string | null) => void
  settings: ImageUploadSettings
  disabled: boolean
  describedBy?: string
  'data-qqq-id'?: string
}) {
  const user = useContext(AuthContext)?.user
  const { displayName } = useMyProfile()
  const input = useRef<HTMLInputElement>(null)
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  // a pending ref shows the local crop; a saved or cleared value drops it
  useEffect(() => {
    if (typeof value === 'string' && value.startsWith('/')) setPreview(null)
    if (value === null || value === undefined || value === '') setPreview(null)
  }, [value])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const pick = useCallback(
    (file: File | undefined) => {
      if (!file) return
      const problem = imageFileProblem(file, settings)
      setError(problem)
      if (!problem) setCropSource(URL.createObjectURL(file))
    },
    [settings]
  )

  const closeCrop = () => {
    if (cropSource) URL.revokeObjectURL(cropSource)
    setCropSource(null)
    if (input.current) input.current.value = ''
  }

  const confirm = async (blob: Blob) => {
    closeCrop()
    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadFile(new File([blob], 'photo.png', { type: 'image/png' }))
      setPreview(URL.createObjectURL(blob))
      onChange(uploaded.ref)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'The photo could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  const current = preview ?? (typeof value === 'string' && value.startsWith('/') ? value : undefined)
  const busy = disabled || uploading
  return (
    <div className="space-y-2" data-qqq-id={dataQqqId}>
      <span id={`${id}-label`} className="block text-sm font-medium text-foreground">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={[describedBy, error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
        onDragOver={(event) => {
          if (busy) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!busy) pick(event.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-4 rounded-lg border border-dashed border-input p-3 transition-colors',
          dragging && 'border-primary bg-primary/5'
        )}
        data-qqq-id={`${dataQqqId}-dropzone`}
      >
        <UserAvatar
          src={current}
          name={displayName ?? user?.name ?? user?.email}
          size={72}
          className={settings.shape === 'square' ? 'rounded-md' : undefined}
          data-qqq-id={`${dataQqqId}-preview`}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            {uploading ? 'Uploading…' : 'Drop an image here, or choose one. You can crop it before saving.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON_CLASS} disabled={busy} onClick={() => input.current?.click()} data-qqq-id={`${dataQqqId}-choose`}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {current ? 'Replace photo' : 'Choose photo'}
            </button>
            {current && (
              <button
                type="button"
                className={BUTTON_CLASS}
                disabled={busy}
                onClick={() => {
                  setPreview(null)
                  onChange(null)
                }}
                data-qqq-id={`${dataQqqId}-remove`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove
              </button>
            )}
          </div>
        </div>
        <input
          ref={input}
          id={id}
          type="file"
          accept={settings.accept.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => pick(event.target.files?.[0])}
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className={ALERT_CLASS}>
          {error}
        </p>
      )}
      {cropSource && <CropDialog src={cropSource} shape={settings.shape} onCancel={closeCrop} onConfirm={confirm} />}
    </div>
  )
}

/**
 * Square crop: drag (or arrow keys) to move, slider (or +/-) to zoom.
 *
 * @param props - The picked image and what to do with the crop.
 * @returns The dialog.
 */
function CropDialog({
  src,
  shape,
  onCancel,
  onConfirm,
}: {
  src: string
  shape: 'square' | 'circle'
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [edge, setEdge] = useState(280)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [failed, setFailed] = useState(false)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const element = new Image()
    element.onload = () => setImage(element)
    element.onerror = () => setFailed(true)
    element.src = src
  }, [src])

  useEffect(() => {
    const node = viewport.current
    if (!node) return
    const measure = () => setEdge(node.clientWidth || 280)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    return () => observer?.disconnect()
  }, [image])

  const baseScale = image ? edge / Math.min(image.naturalWidth, image.naturalHeight) : 1
  const scale = baseScale * zoom
  const width = image ? image.naturalWidth * scale : edge
  const height = image ? image.naturalHeight * scale : edge
  const clamp = useCallback(
    (x: number, y: number) => ({ x: Math.min(0, Math.max(edge - width, x)), y: Math.min(0, Math.max(edge - height, y)) }),
    [edge, width, height]
  )

  // centre the image whenever it loads or the viewport changes size; keep it covering on zoom
  useEffect(() => {
    if (image) setOffset({ x: (edge - image.naturalWidth * baseScale) / 2, y: (edge - image.naturalHeight * baseScale) / 2 })
  }, [image, edge, baseScale])
  useEffect(() => setOffset((current) => clamp(current.x, current.y)), [clamp])

  const zoomTo = (next: number) => {
    const bounded = Math.min(4, Math.max(1, next))
    const centre = { x: (edge / 2 - offset.x) / scale, y: (edge / 2 - offset.y) / scale }
    const nextScale = baseScale * bounded
    setZoom(bounded)
    setOffset(clamp(edge / 2 - centre.x * nextScale, edge / 2 - centre.y * nextScale))
  }

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const step = event.shiftKey ? 40 : 10
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[event.key]) {
      event.preventDefault()
      setOffset(clamp(offset.x + moves[event.key][0], offset.y + moves[event.key][1]))
    } else if (event.key === '+' || event.key === '=') zoomTo(zoom + 0.1)
    else if (event.key === '-') zoomTo(zoom - 0.1)
  }

  const crop = () => {
    if (!image) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_EDGE
    canvas.height = OUTPUT_EDGE
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, -offset.x / scale, -offset.y / scale, edge / scale, edge / scale, 0, 0, OUTPUT_EDGE, OUTPUT_EDGE)
    canvas.toBlob((blob) => (blob ? onConfirm(blob) : setFailed(true)), 'image/png')
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-foreground/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[1110] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xl"
          data-qqq-id="image-crop-dialog"
        >
          <Dialog.Title className="text-lg font-semibold">Crop your photo</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            Drag the image, or use the arrow keys, to choose what shows. Zoom with the slider.
          </Dialog.Description>
          {failed ? (
            <p role="alert" className={ALERT_CLASS}>
              That image couldn&apos;t be opened. Use a PNG, JPEG, WebP or GIF image.
            </p>
          ) : (
            <div
              ref={viewport}
              tabIndex={0}
              role="application"
              aria-label="Photo crop area. Arrow keys move the photo; plus and minus zoom."
              onKeyDown={onKeyDown}
              onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
              }}
              onPointerMove={(event) => {
                if (drag.current) setOffset(clamp(drag.current.ox + event.clientX - drag.current.x, drag.current.oy + event.clientY - drag.current.y))
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              className="relative mx-auto aspect-square w-full max-w-[280px] cursor-grab touch-none overflow-hidden rounded-md bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              data-qqq-id="image-crop-area"
            >
              {image && (
                // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview being cropped
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
                  style={{ width, height, transform: `translate(${offset.x}px, ${offset.y}px)` }}
                />
              )}
              <div
                aria-hidden="true"
                className={cn('pointer-events-none absolute inset-0 ring-1 ring-white/70', shape === 'circle' ? 'rounded-full' : 'rounded-md')}
                style={{ boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)' }}
              />
            </div>
          )}
          <label className="flex items-center gap-3 text-sm">
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              disabled={!image}
              onChange={(event) => zoomTo(Number(event.target.value))}
              className="min-w-0 flex-1 accent-primary"
              data-qqq-id="image-crop-zoom"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" className={BUTTON_CLASS} data-qqq-id="image-crop-cancel">
                Cancel
              </button>
            </Dialog.Close>
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!image || failed} onClick={crop} data-qqq-id="image-crop-use">
              Use photo
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
