/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0.
 */

/** @file Receipt-gated downloads through the configured authenticated API only. */
import apiClient from './client'

const LIMIT = 20 * 1024 * 1024
const ROUTE = /^\/qbit\/record-files\/files\/[1-9][0-9]{0,9}\/downloads\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/

/** Validate both authority and exact native route before attaching credentials.
 * @param supplied - Server-provided delivery URL, never assumed safe.
 * @param configured - Trusted API base configuration.
 * @param browserOrigin - Browser origin for a relative API deployment.
 * @returns A relative route for the existing authenticated client.
 */
export function trackedDownloadRoute(supplied: string, configured: string, browserOrigin: string): string {
  const base = new URL(configured.replace(/\/+$/, '') + '/', browserOrigin)
  const url = new URL(supplied, browserOrigin)
  if (!/^https?:$/.test(base.protocol) || url.origin !== base.origin || url.username || url.password || url.search || url.hash
    || /[\\\u0000-\u0020%]/.test(supplied) || !url.pathname.startsWith(base.pathname)) throw new Error('Invalid authenticated download destination')
  const relative = '/' + url.pathname.slice(base.pathname.length)
  if (!ROUTE.test(relative)) throw new Error('Invalid authenticated download route')
  return relative
}

/** Fetch bounded bytes and require independently durable server-write evidence.
 * @param url - Exact configured native content route.
 * @param signal - Optional caller lifetime; cancellation covers body and receipt requests.
 * @returns An inert blob after current-authorized receipt and hash verification.
 */
export async function fetchTrackedAttachment(url: string, signal?: AbortSignal): Promise<Blob> {
  const validated = trackedDownloadRoute(url, apiClient.getInstance().defaults.baseURL ?? '/qqq/v1', window.location.origin)
  // The last coordinate is correlation, never authority. Every body GET is a new
  // currently-authorized, durably unique attempt for the same exact immutable file.
  const route = validated.slice(0, validated.lastIndexOf('/') + 1) + crypto.randomUUID()
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  try {
    controller.signal.throwIfAborted()
    const blob = await apiClient.get<Blob>(route, {
      responseType: 'blob', signal: controller.signal, timeout: 120_000,
      headers: { Accept: 'application/octet-stream', 'X-Record-Files-Download': '1' },
      onDownloadProgress: (progress) => { if (progress.loaded > LIMIT) controller.abort() },
    })
    controller.signal.throwIfAborted()
    if (!(blob instanceof Blob) || blob.size > LIMIT) throw new Error('Attachment exceeds the download limit')
    const receipt = await apiClient.get<{ state?: string; sizeBytes?: number; sha256?: string }>(`${route}/receipt`, { signal: controller.signal, timeout: 120_000, headers: { 'X-Record-Files-Download': '1' } })
    controller.signal.throwIfAborted()
    if (receipt.state !== 'BODY_WRITE_COMPLETED' || receipt.sizeBytes !== blob.size || !/^[a-f0-9]{64}$/.test(receipt.sha256 ?? '')) {
      throw new Error('The server could not confirm the download audit; the file was not saved')
    }
    const bytes = await blob.arrayBuffer()
    controller.signal.throwIfAborted()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    controller.signal.throwIfAborted()
    const actual = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
    if (actual !== receipt.sha256) throw new Error('Attachment integrity verification failed')
    return new Blob([blob], { type: 'application/octet-stream' })
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}

/** Save only verified tracked bytes; ordinary signed links keep their existing path.
 * @param delivery - Authorized owner delivery descriptor.
 * @param fileName - User-visible download filename.
 * @param signal - Optional operation lifetime; cancelled work cannot trigger save.
 */
export async function saveAttachmentDownload(delivery: { url: string; delivery?: string }, fileName: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  const tracked = delivery.delivery === 'AUTHENTICATED_FETCH'
  const blob = tracked ? await fetchTrackedAttachment(delivery.url, signal) : undefined
  signal?.throwIfAborted()
  const url = blob ? URL.createObjectURL(blob) : delivery.url
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener noreferrer'
    link.click()
  } finally {
    if (tracked) setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** Allow only raster image formats in the existing image element preview.
 * @param blob - Receipt-verified original bytes.
 * @returns Blob with a fixed safe raster media type, never an uploaded active type.
 */
export async function rasterPreviewBlob(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  const type = bytes[0] === 0x89 && ascii(1, 4) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 ? 'image/png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg'
      : ['GIF87a', 'GIF89a'].includes(ascii(0, 6)) ? 'image/gif'
        : ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' ? 'image/webp' : null
  if (!type) throw new Error('Inline preview is unavailable for this file type. Use Download.')
  return new Blob([blob], { type })
}

/** Select a fixed inert media type for the dedicated image/PDF canvas renderers.
 * @param blob - Exact owner bytes already verified against their durable receipt.
 * @returns Raster bytes or PDF bytes for the script-free PDF.js canvas consumer.
 */
export async function safeAttachmentPreviewBlob(blob: Blob): Promise<Blob> {
  const header = String.fromCharCode(...new Uint8Array(await blob.slice(0, 8).arrayBuffer()))
  if (/^%PDF-[12]\.[0-9]$/.test(header)) return new Blob([blob], { type: 'application/pdf' })
  return rasterPreviewBlob(blob)
}
