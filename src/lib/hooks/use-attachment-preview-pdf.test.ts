/* Copyright 2026 QRun.IO, Inc. Licensed under the Apache License, Version 2.0. */
/** @file Real receipt, hash and byte-policy integration for tracked PDF previews. */
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import apiClient from '@/lib/api/client'
import { loadPdfPreviewBytes, pdfPreviewSource } from '@/lib/api/pdf-preview'
import { useAttachmentUrl } from './use-collaboration-record'
import { useAttachmentPreview } from './use-attachment-preview'

vi.mock('@/lib/api/client', () => ({ default: { get: vi.fn(), getInstance: () => ({ defaults: { baseURL: '/qqq/v1' } }) } }))
vi.mock('./use-collaboration-record', () => ({ useAttachmentUrl: vi.fn() }))
const get = vi.mocked(apiClient.get)
const source = '/qqq/v1/qbit/record-files/files/12/downloads/10000000-0000-0000-0000-000000000001'
const create = vi.fn<(blob: Blob) => string>()
const revoke = vi.fn()
const pdf = '%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
  Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true })
  create.mockReturnValue(`blob:${window.location.origin}/verified-pdf`)
  vi.mocked(useAttachmentUrl).mockReturnValue({ data: { url: source, delivery: 'AUTHENTICATED_FETCH' }, isError: false } as ReturnType<typeof useAttachmentUrl>)
})

/** Exact real digest for the synthetic returned body, independent of MIME metadata.
 * @param body - Fixed trusted fixture bytes.
 * @returns Native completed receipt.
 */
async function receipt(body: Blob) {
  return { state: 'BODY_WRITE_COMPLETED', sizeBytes: body.size,
    sha256: Buffer.from(await webcrypto.subtle.digest('SHA-256', await body.arrayBuffer())).toString('hex') }
}

it('admits a tracked PDF only after receipt verification and passes a local blob to the existing PDF loader', async () => {
  const body = new Blob([pdf], { type: 'text/html' })
  const completed = await receipt(body)
  let finish!: (value: typeof completed) => void
  get.mockResolvedValueOnce(body).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  const hook = renderHook(() => useAttachmentPreview(12, true))
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  expect(hook.result.current.data).toBeUndefined()
  expect(create).not.toHaveBeenCalled()
  await act(async () => finish(completed))
  await waitFor(() => expect(hook.result.current.data?.url).toBe(`blob:${window.location.origin}/verified-pdf`))
  const local = create.mock.calls[0][0]
  expect(local.type).toBe('application/pdf')
  expect(await local.text()).toBe(pdf)
  expect(get.mock.calls[1][0]).toBe(`${get.mock.calls[0][0]}/receipt`)
  expect(() => pdfPreviewSource(source)).toThrow()
  const fetchLocal = vi.fn().mockResolvedValue({ ok: true, blob: async () => local })
  vi.stubGlobal('fetch', fetchLocal)
  const signal = new AbortController().signal
  expect(new TextDecoder().decode(await loadPdfPreviewBytes(hook.result.current.data!.url, signal))).toBe(pdf)
  expect(fetchLocal).toHaveBeenCalledWith(new URL(hook.result.current.data!.url), { signal, credentials: 'omit' })
  expect(get).toHaveBeenCalledTimes(2)
  hook.unmount()
  expect(revoke).toHaveBeenCalledWith(`blob:${window.location.origin}/verified-pdf`)
})

it.each(['%PDF-9.9\ninvalid', '<svg xmlns="http://www.w3.org/2000/svg"/>', '<html>%PDF-1.7</html>'])(
  'refuses invalid or active content despite a matching receipt: %s', async (content) => {
    const body = new Blob([content], { type: 'application/pdf' })
    get.mockResolvedValueOnce(body).mockResolvedValueOnce(await receipt(body))
    const hook = renderHook(() => useAttachmentPreview(12, true))
    await waitFor(() => expect(hook.result.current.isError).toBe(true))
    expect(hook.result.current.data).toBeUndefined()
    expect(create).not.toHaveBeenCalled()
  })

it.each(['unknown', 'mismatch'])('does not expose PDF bytes after a %s receipt', async (failure) => {
  const body = new Blob([pdf])
  const evidence = await receipt(body)
  if (failure === 'unknown') evidence.state = 'UNKNOWN'
  else evidence.sha256 = '0'.repeat(64)
  get.mockResolvedValueOnce(body).mockResolvedValueOnce(evidence)
  const hook = renderHook(() => useAttachmentPreview(12, true))
  await waitFor(() => expect(hook.result.current.isError).toBe(true))
  expect(hook.result.current.data).toBeUndefined()
  expect(create).not.toHaveBeenCalled()
})

it('cancels a pending PDF receipt on close without allocating a preview URL', async () => {
  get.mockResolvedValueOnce(new Blob([pdf]))
  let signal: AbortSignal | undefined
  get.mockImplementationOnce((_path, config) => new Promise((_resolve, reject) => {
    signal = config?.signal as AbortSignal
    signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
  }))
  const hook = renderHook(() => useAttachmentPreview(12, true))
  await waitFor(() => expect(signal).toBeDefined())
  hook.unmount()
  expect(signal?.aborted).toBe(true)
  expect(create).not.toHaveBeenCalled()
})
