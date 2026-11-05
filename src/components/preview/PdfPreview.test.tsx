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

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { PdfPreview } from './PdfPreview'
const mocks = vi.hoisted(() => ({ load: vi.fn(), getDocument: vi.fn(), create: vi.fn(), terminate: vi.fn(), destroy: vi.fn(), render: vi.fn(), cancel: vi.fn(), reader: vi.fn(), cleanup: vi.fn() }))
vi.mock('@/lib/api/pdf-preview', () => ({ loadPdfPreviewBytes: mocks.load, PDF_PAGE_LIMIT: 1000, PDF_PIXEL_LIMIT: 8_000_000 }))
vi.mock('pdfjs-dist', () => ({ PDFWorker: { create: mocks.create }, getDocument: mocks.getDocument }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('Worker', class { terminate = mocks.terminate })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D)
  mocks.load.mockResolvedValue(new Uint8Array([1]))
  mocks.destroy.mockResolvedValue(undefined)
  mocks.render.mockReturnValue({ promise: Promise.resolve(), cancel: mocks.cancel })
  mocks.reader.mockImplementation(() => {
    let read = false
    return { read: async () => read ? { done: true } : (read = true, { done: false, value: { items: [{ str: '<script>inert page text</script>' }] } }), cancel: async () => {}, releaseLock: () => {} }
  })
  mocks.getDocument.mockReturnValue({ destroy: mocks.destroy, promise: Promise.resolve({ numPages: 2, getPage: async () => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
    render: mocks.render, cleanup: mocks.cleanup, streamTextContent: () => ({ getReader: mocks.reader }),
  }) }) })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('renders pixels and inert text with explicit worker/data-only policy, then cancels on close', async () => {
  const user = userEvent.setup()
  const view = render(<PdfPreview url="blob:http://localhost/fixture" fileName="Packing slip.pdf" />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled())
  expect(mocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Uint8Array), useWorkerFetch: false, useWasm: false, enableXfa: false, maxImageSize: 8_000_000 }))
  expect(mocks.getDocument.mock.calls[0][0].url).toBeUndefined()
  expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({ annotationMode: 0 }))
  await waitFor(() => expect(mocks.cleanup).toHaveBeenCalledTimes(1))
  expect(document.querySelector('iframe,object,embed,script')).toBeNull()
  await waitFor(() => expect(screen.getByText('<script>inert page text</script>')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(screen.getByRole('img')).toHaveAccessibleName('Packing slip.pdf, page 2'))
  view.unmount()
  expect(mocks.terminate).toHaveBeenCalled()
  expect(mocks.destroy).toHaveBeenCalled()
})
it('starts the packaged worker from a .js URL, because hosts serve .mjs as application/octet-stream and module workers refuse it', async () => {
  const urls: string[] = []
  vi.stubGlobal('Worker', class { terminate = mocks.terminate; constructor(url: string) { urls.push(url) } })
  render(<PdfPreview url="blob:http://localhost/fixture" fileName="Packing slip.pdf" />)
  await waitFor(() => expect(urls).toHaveLength(1))
  expect(urls[0]).toMatch(/^\/pdf-generated\/pdf-[\d.]+\.worker\.js$/)
})
it('rejects page counts outside the bound without rendering', async () => {
  mocks.getDocument.mockReturnValue({ destroy: mocks.destroy, promise: Promise.resolve({ numPages: 1001 }) })
  render(<PdfPreview url="blob:http://localhost/fixture" fileName="Huge.pdf" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('preview limits')
  expect(mocks.render).not.toHaveBeenCalled()
  expect(mocks.terminate).toHaveBeenCalled()
})
it('stops before starting a parser when closed during input loading', async () => {
  let resolve!: (bytes: Uint8Array) => void
  mocks.load.mockImplementation(() => new Promise<Uint8Array>((done) => { resolve = done }))
  const view = render(<PdfPreview url="blob:http://localhost/fixture" fileName="Slow.pdf" />)
  view.unmount(); resolve(new Uint8Array([1]))
  await new Promise((done) => setTimeout(done, 0))
  expect(mocks.getDocument).not.toHaveBeenCalled()
})

it('bounds streamed text before materializing a full page string', async () => {
  const reader = { read: vi.fn().mockResolvedValue({ done: false, value: { items: [{ str: 'x'.repeat(200_000) }] } }), cancel: vi.fn().mockResolvedValue(undefined), releaseLock: vi.fn() }
  mocks.reader.mockReturnValue(reader)
  render(<PdfPreview url="blob:http://localhost/fixture" fileName="Text.pdf" />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled())
  expect(reader.read).toHaveBeenCalledTimes(1)
  expect(reader.cancel).toHaveBeenCalled()
  expect(document.querySelector('details p')?.textContent?.length).toBe(100_000)
})
it('keeps navigation busy during text transfer and cancels that transfer on close', async () => {
  let finish!: (value: { done: boolean }) => void
  const reader = { read: vi.fn(() => new Promise<{ done: boolean }>((resolve) => { finish = resolve })), cancel: vi.fn(async () => { finish({ done: true }) }), releaseLock: vi.fn() }
  mocks.reader.mockReturnValue(reader)
  const view = render(<PdfPreview url="blob:http://localhost/fixture" fileName="Text.pdf" />)
  await waitFor(() => expect(reader.read).toHaveBeenCalled())
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  view.unmount()
  await waitFor(() => expect(reader.cancel).toHaveBeenCalled())
  expect(mocks.terminate).toHaveBeenCalled()
})
