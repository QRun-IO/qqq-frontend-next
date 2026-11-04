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

/** @file Bounded PDF input; credentials are sent only to the configured native file API. */
import apiClient from './client'

export const PDF_BYTE_LIMIT = 20 * 1024 * 1024
export const PDF_PAGE_LIMIT = 1000
export const PDF_PIXEL_LIMIT = 8_000_000

/** Validate a local blob or exact configured backend file path before any I/O.
 * @param supplied - The preview URL.
 * @returns Validated URL with no cross-origin credential forwarding.
 */
export function pdfPreviewSource(supplied: string): URL {
  const origin = window.location.origin
  const url = new URL(supplied, origin)
  if (url.protocol === 'blob:' && url.origin === origin && !url.search && !url.hash) return url
  const base = new URL((apiClient.getInstance().defaults.baseURL ?? '/qqq/v1').replace(/\/+$/, '') + '/', origin)
  const relative = url.pathname.startsWith(base.pathname) ? url.pathname.slice(base.pathname.length) : ''
  // Exactly table/{tableName}/{primaryKey}/{fieldName}/{filename}; never a query,
  // process or another authenticated table operation. Encoded ordinary filenames
  // remain supported, but encoded routing delimiters and controls do not.
  const fileRoute = /^table\/[^/]+\/[^/]+\/[^/]+\/[^/]+$/.test(relative)
    && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(relative)
  if (!/^https?:$/.test(url.protocol) || url.origin !== base.origin || url.username || url.password
    || /[\\\u0000-\u0020]/.test(supplied) || !fileRoute || url.hash) {
    throw new Error('This PDF is not available through a trusted file preview source.')
  }
  return url
}

/** Read bounded bytes without ever framing the uploaded file or trusting its MIME type.
 * @param supplied - Local blob or validated backend file URL.
 * @param signal - Dialog/page lifetime cancellation.
 * @returns A bounded, header-checked PDF byte array for the parser worker.
 */
export async function loadPdfPreviewBytes(supplied: string, signal: AbortSignal): Promise<Uint8Array> {
  const url = pdfPreviewSource(supplied)
  let blob: Blob
  if (url.protocol === 'blob:') {
    // Blob retrieval is local browser memory, not an authenticated API request.
    const response = await fetch(url, { signal, credentials: 'omit' })
    if (!response.ok) throw new Error('PDF preview could not be read.')
    blob = await response.blob()
  } else {
    const bound = new AbortController()
    const abort = () => bound.abort()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) bound.abort()
    try {
      blob = await apiClient.get<Blob>(url.href, { responseType: 'blob', signal: bound.signal, timeout: 30_000,
        onDownloadProgress: (progress) => { if (progress.loaded > PDF_BYTE_LIMIT) bound.abort() },
      })
    } finally {
      signal.removeEventListener('abort', abort)
    }
  }
  signal.throwIfAborted()
  if (!(blob instanceof Blob) || blob.size > PDF_BYTE_LIMIT) throw new Error('PDF preview exceeds 20 MiB.')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (!/^%PDF-[12]\.[0-9]/.test(String.fromCharCode(...bytes.slice(0, 8)))) throw new Error('The file is not a supported PDF.')
  signal.throwIfAborted()
  return bytes
}
