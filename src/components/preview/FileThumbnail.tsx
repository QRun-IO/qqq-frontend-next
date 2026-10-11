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
 * @file FileThumbnail — a FILE_PREVIEW value as a fixed-size, lazily loaded thumbnail (or a
 * file-type icon) that opens the preview lightbox: through the surrounding
 * {@link FilePreviewGallery} when there is one, else for this file alone.
 */

'use client'

import React, { useState } from 'react'

import type { QFieldMetaData, QRecord } from '@/types'
import type { FilePreviewItem } from '@/lib/utils/file-preview'
import { cn } from '@/lib/utils/cn'
import { FileKindIcon } from './FileKindIcon'
import { LightboxHost, useFilePreviewGallery } from './FilePreviewGallery'

/** Props for {@link FileThumbnail}. */
interface FileThumbnailProps {
  /** The adorned field. */
  field: QFieldMetaData
  /** The record holding the value. */
  record: QRecord
  /** The resolved preview (see `filePreview`). */
  item: FilePreviewItem
  /** Edge of the thumbnail box in CSS pixels; defaults to the adornment's `thumbnailMaxSize`. */
  size?: number
  /** Show the file name beside the thumbnail (record views). */
  showName?: boolean
  /** The `data-qqq-id` of the value. */
  dataQqqId: string
  /** Additional classes for the root. */
  className?: string
}

/**
 * Renders the thumbnail. The box has a fixed size, so loading never shifts the layout; a pulse
 * shows until the image loads, and the file-type icon replaces an image that fails to load.
 * Clicks and keys do not reach an enclosing row, so a grid row does not also navigate.
 *
 * @param props - See {@link FileThumbnailProps}.
 * @returns The thumbnail, as a button when the value is previewable.
 */
export function FileThumbnail({ field, record, item, size, showName = false, dataQqqId, className }: FileThumbnailProps) {
  const gallery = useFilePreviewGallery()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const edge = size ?? item.thumbnailSize
  const image = item.kind === 'image' && item.thumbnailUrl && !failed

  const box = (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted"
      style={{ width: edge, height: edge }}
      data-qqq-id={`${dataQqqId}-thumbnail`}
    >
      {image ? (
        <>
          {!loaded && <span className="absolute inset-0 animate-pulse bg-muted-foreground/15" aria-hidden="true" data-qqq-id={`${dataQqqId}-thumbnail-loading`} />}
          {/* eslint-disable-next-line @next/next/no-img-element -- record URLs from any allowed origin; the static export has no image optimizer */}
          <img
            src={item.thumbnailUrl}
            alt={item.previewable ? '' : item.alt}
            width={edge}
            height={edge}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn('h-full w-full', edge > 64 ? 'object-contain' : 'object-cover')}
          />
        </>
      ) : (
        <FileKindIcon kind={item.kind} className="h-1/2 w-1/2 text-muted-foreground" />
      )}
    </span>
  )

  // the name sits under the thumbnail, no wider than it, so narrow value columns do not break it up
  const name = showName ? <span className="block truncate text-sm text-foreground" style={{ maxWidth: edge }}>{item.fileName}</span> : null
  const layout = showName ? 'inline-flex flex-col items-start gap-1' : 'inline-flex items-center gap-2'

  if (!item.previewable) {
    return (
      <span className={cn(layout, className)} data-qqq-id={dataQqqId} title={item.fileName}>
        {box}
        {name}
        {!image && !showName && <span className="sr-only">{item.fileName}</span>}
      </span>
    )
  }

  /**
   * Opens the preview within the gallery, or alone when the value is not part of one.
   *
   * @param event - The click.
   */
  const open = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.preventDefault()
    // Safari does not focus a clicked button; focus it so closing the preview returns here
    event.currentTarget.focus()
    if (!gallery?.open(record, field)) setStandalone(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation() }}
        aria-haspopup="dialog"
        aria-label={`Preview ${item.fileName}`}
        title={item.fileName}
        className={cn('group max-w-full cursor-zoom-in rounded-md text-left', layout, 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1', className)}
        data-qqq-id={dataQqqId}
        data-preview-kind={item.kind}
      >
        <span className="contents [&>span:first-child]:transition-shadow group-hover:[&>span:first-child]:shadow-md">{box}</span>
        {name}
      </button>
      {standalone && <LightboxHost items={[item]} index={0} onIndexChange={() => undefined} onClose={() => setStandalone(false)} />}
    </>
  )
}
