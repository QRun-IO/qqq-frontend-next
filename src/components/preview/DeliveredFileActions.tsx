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

/** @file Receipt-gated actions for metadata-declared authenticated file delivery. */
'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchTrackedAttachment, safeAttachmentPreviewBlob, saveAttachmentDownload } from '@/lib/api/attachment-download'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { kindOfMimeType, type FilePreviewItem } from '@/lib/utils/file-preview'
import { FilePreviewLightbox } from './FilePreviewLightbox'

/** Props supplied by generic FILE_DOWNLOAD field metadata. */
interface Props {
  url: string
  fileName: string
  allowPreview: boolean
  dataQqqId: string
}

/**
 * Authenticated URLs are never href/src values. Only verified inert blobs can preview.
 * @param props - Current authorized delivery and display-only name.
 * @returns Explicit download/preview controls and any visible audit failure.
 */
export function DeliveredFileActions({ url, fileName, allowPreview, dataQqqId }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [preview, setPreview] = useState<FilePreviewItem>()
  const alive = useRef(true)
  const activeOperation = useRef<AbortController | undefined>(undefined)
  useEffect(() => {
    alive.current = true
    setPreview(undefined); setPending(false); setError(undefined)
    return () => { alive.current = false; activeOperation.current?.abort() }
  }, [url])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  /** Download always goes through the existing authenticated receipt verifier.
   * @param signal - Current operation lifetime, including source changes/unmount.
   */
  async function download(signal: AbortSignal) {
    await saveAttachmentDownload({ url, delivery: 'AUTHENTICATED_FETCH' }, fileName, signal)
  }

  /** Load an authorized bounded body, then restrict preview to verified raster/PDF.
   * @param signal - Current operation lifetime, including source changes/unmount.
   */
  async function openPreview(signal: AbortSignal) {
    const original = await fetchTrackedAttachment(url, signal)
    signal.throwIfAborted()
    const blob = await safeAttachmentPreviewBlob(original)
    signal.throwIfAborted()
    if (!alive.current) return
    setPreview({ url: URL.createObjectURL(blob), fileName, mimeType: blob.type, kind: kindOfMimeType(blob.type),
      alt: fileName, sizeBytes: blob.size, previewable: true, thumbnailSize: 160 })
  }

  /** Keep all failures visible; an audit failure never becomes an ordinary link.
   * @param action - Receipt-gated operation selected by the user.
   */
  async function perform(action: (signal: AbortSignal) => Promise<void>) {
    activeOperation.current?.abort()
    const controller = new AbortController()
    activeOperation.current = controller
    setPending(true); setError(undefined)
    try { await action(controller.signal) }
    catch (failure) {
      if (alive.current && activeOperation.current === controller && !controller.signal.aborted) setError(getErrorMessage(failure))
      throw failure
    } finally {
      if (activeOperation.current === controller) {
        activeOperation.current = undefined
        if (alive.current) setPending(false)
      }
    }
  }

  return <span className="inline-flex flex-wrap items-center gap-2" data-qqq-id={dataQqqId}>
    <span>{fileName}</span>
    <button type="button" className="text-link underline disabled:opacity-50 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center" disabled={pending}
      data-qqq-id={dataQqqId + '-download'} onClick={() => { void perform(download).catch(() => {}) }}>Download file</button>
    {allowPreview && <button type="button" className="text-link underline disabled:opacity-50 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center" disabled={pending}
      data-qqq-id={dataQqqId + '-preview'} onClick={() => { void perform(openPreview).catch(() => {}) }}>Preview file</button>}
    {pending && <span role="status">Verifying file delivery…</span>}
    {error && <span role="alert" className="text-destructive">{error}</span>}
    {preview && <FilePreviewLightbox items={[preview]} index={0} onIndexChange={() => {}} onClose={() => setPreview(undefined)} onDownload={() => perform(download)} />}
  </span>
}
