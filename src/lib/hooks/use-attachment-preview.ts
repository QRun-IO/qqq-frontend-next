/* Copyright 2026 QRun.IO, Inc. Licensed under the Apache License, Version 2.0. */
/** @file Component-scoped, receipt-verified raster and PDF attachment previews. */
'use client'
import { useEffect, useState } from 'react'
import { fetchTrackedAttachment, safeAttachmentPreviewBlob } from '@/lib/api/attachment-download'
import { loadSignedPdfPreviewBlob } from '@/lib/api/pdf-preview'
import { useAttachmentUrl } from './use-collaboration-record'

/** Resolve tracked raster/PDF previews only after durable receipt and hash verification.
 * @param id - Exact immutable attachment version.
 * @param enabled - Whether the visible UI needs its content.
 * @param pdf - Whether an ordinary signed PDF also needs local canvas preparation.
 * @returns The existing query controls and a safe, component-owned preview URL.
 */
export function useAttachmentPreview(id: number, enabled: boolean, pdf = false) {
  const query = useAttachmentUrl(id, 'preview', enabled)
  const [resolved, setResolved] = useState<{ source: string; url?: string; error?: Error }>()
  const source = query.data?.url
  const tracked = query.data?.delivery === 'AUTHENTICATED_FETCH'
  useEffect(() => {
    if (!enabled || !source || (!tracked && !pdf)) return
    const abort = new AbortController()
    let disposed = false
    let objectUrl: string | undefined
    const body = tracked
      ? fetchTrackedAttachment(source, abort.signal).then(safeAttachmentPreviewBlob)
      : loadSignedPdfPreviewBlob(source, abort.signal)
    void body.then((blob) => {
      if (disposed) return
      objectUrl = URL.createObjectURL(blob)
      setResolved({ source, url: objectUrl })
    }).catch((error: unknown) => {
      if (!disposed) setResolved({ source, error: error instanceof Error ? error : new Error('Preview unavailable') })
    })
    return () => {
      disposed = true
      abort.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setResolved(undefined)
    }
  }, [enabled, source, tracked, pdf])
  const current = enabled && resolved?.source === source ? resolved : undefined
  return { ...query, data: tracked || pdf ? (current?.url ? { url: current.url } : undefined) : query.data,
    error: current?.error ?? query.error, isError: !!current?.error || query.isError }
}
