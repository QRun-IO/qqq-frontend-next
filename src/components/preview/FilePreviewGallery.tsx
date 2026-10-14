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
 * @file FilePreviewGallery — groups the FILE_PREVIEW values of a set of records (a grid page, a
 * child list, a record) so the preview lightbox steps through them with the arrow keys. The
 * lightbox code loads only when a preview first opens.
 */

'use client'

import React, { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react'

import type { QFieldMetaData, QRecord } from '@/types'
import type { FilePreviewItem } from '@/lib/utils/file-preview'
import { filePreviewItems } from '@/lib/utils/file-preview'

import { FilePreviewLightbox } from './FilePreviewLightboxLazy'

/** What a thumbnail asks of the gallery around it. */
interface FilePreviewGalleryContextValue {
  /**
   * Opens the preview at a record's field.
   *
   * @returns `false` when the value is not part of this gallery.
   */
  open: (record: QRecord, field: QFieldMetaData) => boolean
}

const FilePreviewGalleryContext = createContext<FilePreviewGalleryContextValue | null>(null)

/** Props for {@link FilePreviewGallery}. */
interface FilePreviewGalleryProps {
  /** Records on screen, in display order. */
  records: QRecord[]
  /** Fields shown for them, in display order (fields without FILE_PREVIEW are ignored). */
  fields: QFieldMetaData[]
  /** Selected table variant as v1 JSON, for backend file URLs. */
  tableVariant?: string
  /** The content holding the thumbnails. */
  children: React.ReactNode
}

/**
 * Provides the gallery to the thumbnails rendered inside it.
 *
 * @param props - See {@link FilePreviewGalleryProps}.
 * @returns The children, plus the lightbox while one is open.
 */
export function FilePreviewGallery({ records, fields, tableVariant, children }: FilePreviewGalleryProps) {
  const entries = useMemo(() => filePreviewItems(records, fields, tableVariant), [records, fields, tableVariant])
  const [index, setIndex] = useState<number | null>(null)

  const open = useCallback((record: QRecord, field: QFieldMetaData) => {
    const position = entries.findIndex((entry) => entry.record === record && entry.field.name === field.name)
    if (position < 0) return false
    setIndex(position)
    return true
  }, [entries])

  const value = useMemo(() => ({ open }), [open])
  const items = useMemo(() => entries.map((entry) => entry.item), [entries])

  return (
    <FilePreviewGalleryContext.Provider value={value}>
      {children}
      {index !== null && items.length > 0 && (
        <LightboxHost items={items} index={Math.min(index, items.length - 1)} onIndexChange={setIndex} onClose={() => setIndex(null)} />
      )}
    </FilePreviewGalleryContext.Provider>
  )
}

/**
 * The gallery around a thumbnail, if any.
 *
 * @returns The gallery, or `null` outside one.
 */
export function useFilePreviewGallery(): FilePreviewGalleryContextValue | null {
  return useContext(FilePreviewGalleryContext)
}

/**
 * Loads and shows the lightbox.
 *
 * @param props - The lightbox props.
 * @returns The lazily loaded lightbox.
 */
export function LightboxHost(props: { items: FilePreviewItem[]; index: number; onIndexChange: (index: number) => void; onClose: () => void }) {
  return (
    <Suspense fallback={null}>
      <FilePreviewLightbox {...props} />
    </Suspense>
  )
}
