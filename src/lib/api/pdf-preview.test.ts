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

import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { loadPdfPreviewBytes, pdfPreviewSource, PDF_BYTE_LIMIT } from './pdf-preview'
const mock = vi.hoisted(() => ({ get: vi.fn(), base: '/qqq/v1' }))
vi.mock('./client', () => ({ default: { get: mock.get, getInstance: () => ({ defaults: { baseURL: mock.base } }) } }))
beforeEach(() => { vi.clearAllMocks(); mock.base = '/qqq/v1'; vi.stubGlobal('Blob', NodeBlob) })
afterEach(() => vi.unstubAllGlobals())
it('rejects external origins, dashboard pages and credential-bearing URLs before requests', async () => {
  for (const url of ['https://elsewhere.example/qqq/v1/table/a/1/file/a.pdf', '/app/table/1', 'javascript:alert(1)', 'blob:https://elsewhere.example/id', 'https://user:pass@localhost/qqq/v1/table/a/1/file/a.pdf']) {
    await expect(loadPdfPreviewBytes(url, new AbortController().signal)).rejects.toThrow()
  }
  expect(mock.get).not.toHaveBeenCalled()
})
it('accepts a local blob and native file source with a header-checked byte result', async () => {
  expect(pdfPreviewSource('blob:' + window.location.origin + '/fixture').protocol).toBe('blob:')
  mock.get.mockResolvedValue(new Blob(['%PDF-1.7\nsynthetic']))
  expect(await loadPdfPreviewBytes('/qqq/v1/table/a/1/file/a.pdf', new AbortController().signal)).toBeInstanceOf(Uint8Array)
  expect(mock.get).toHaveBeenCalledWith(window.location.origin + '/qqq/v1/table/a/1/file/a.pdf', expect.objectContaining({ timeout: 30_000, responseType: 'blob' }))
})
it('rejects mislabeled active content and oversized input', async () => {
  mock.get.mockResolvedValueOnce(new Blob(['<html><script>bad()</script>'], { type: 'application/pdf' }))
  await expect(loadPdfPreviewBytes('/qqq/v1/table/a/1/file/a.pdf', new AbortController().signal)).rejects.toThrow('not a supported PDF')
  mock.get.mockResolvedValueOnce(new Blob([new Uint8Array(PDF_BYTE_LIMIT + 1)]))
  await expect(loadPdfPreviewBytes('/qqq/v1/table/a/1/file/a.pdf', new AbortController().signal)).rejects.toThrow('20 MiB')
})
it('does not pass authentication to local blob retrieval and honors cancellation', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['%PDF-2.0\n']) })
  vi.stubGlobal('fetch', fetcher)
  const signal = new AbortController()
  await loadPdfPreviewBytes('blob:' + window.location.origin + '/fixture', signal.signal)
  expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ credentials: 'omit', signal: signal.signal }))
  signal.abort()
  await expect(loadPdfPreviewBytes('blob:' + window.location.origin + '/fixture', signal.signal)).rejects.toThrow()
})

it('allows only the exact separately hosted configured API origin for native file bytes', async () => {
  mock.base = 'https://api.example.test/qqq/v1'
  mock.get.mockResolvedValue(new Blob(['%PDF-1.7\n']))
  await loadPdfPreviewBytes('https://api.example.test/qqq/v1/table/a/1/file/a.pdf', new AbortController().signal)
  expect(mock.get).toHaveBeenCalledTimes(1)
  await expect(loadPdfPreviewBytes('https://other.example.test/qqq/v1/table/a/1/file/a.pdf', new AbortController().signal)).rejects.toThrow()
  expect(mock.get).toHaveBeenCalledTimes(1)
})

it('rejects other table operations and encoded route delimiters before authenticated I/O', async () => {
  for (const suffix of ['a/query', 'a/1', 'a/1/file', 'a/1/file/a.pdf/extra', 'a/1/file/a%2fb.pdf', 'a/1/file/a%5cb.pdf', 'a/1/file/a%00.pdf']) {
    await expect(loadPdfPreviewBytes('/qqq/v1/table/' + suffix, new AbortController().signal)).rejects.toThrow('trusted file preview source')
  }
  expect(mock.get).not.toHaveBeenCalled()
  expect(pdfPreviewSource('/qqq/v1/table/a/1/file/packing%20slip.pdf?inline=true').pathname).toBe('/qqq/v1/table/a/1/file/packing%20slip.pdf')
})
