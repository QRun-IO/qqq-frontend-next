/* Copyright 2026 QRun.IO, Inc. Licensed under the Apache License, Version 2.0. */
import { webcrypto } from 'node:crypto'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from './client'
import { fetchTrackedAttachment, trackedDownloadRoute, rasterPreviewBlob, safeAttachmentPreviewBlob, saveAttachmentDownload } from './attachment-download'

vi.mock('./client', () => ({ default: { get: vi.fn(), getInstance: () => ({ defaults: { baseURL: 'https://api.example/qqq/v1' } }) } }))
const get = vi.mocked(apiClient.get)
const route = '/qbit/record-files/files/12/downloads/10000000-0000-0000-0000-000000000001'
const url = 'https://api.example/qqq/v1' + route

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
})

describe('authenticated attachment delivery', () => {
  it('accepts only the exact configured origin and native canonical route', () => {
    expect(trackedDownloadRoute(url, 'https://api.example/qqq/v1', 'https://ui.example')).toBe(route)
    for (const invalid of [url.replace('api.example', 'evil.example'), url + '?token=secret', url + '#fragment',
      url.replace('/qqq/v1/', '/qqq/v1evil/'), url.replace('/files/12/', '/files/%31%32/'),
      url.replace('https://', 'https://user:password@'), 'javascript:alert(1)', '/qbit/elsewhere']) {
      expect(() => trackedDownloadRoute(invalid, 'https://api.example/qqq/v1', 'https://ui.example')).toThrow()
    }
  })

  it('does not attach credentials to rejected destinations', async () => {
    await expect(fetchTrackedAttachment(url.replace('api.example', 'evil.example'))).rejects.toThrow()
    expect(get).not.toHaveBeenCalled()
  })

  it('requires a durable complete receipt and exact hash before returning inert bytes', async () => {
    const blob = new Blob(['ORIGINAL'], { type: 'text/html' })
    const digest = await webcrypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    const sha256 = Buffer.from(digest).toString('hex')
    get.mockResolvedValueOnce(blob).mockResolvedValueOnce({ state: 'BODY_WRITE_COMPLETED', sizeBytes: 8, sha256 })
    const result = await fetchTrackedAttachment(url)
    expect(result.type).toBe('application/octet-stream')
    expect(await result.text()).toBe('ORIGINAL')
    expect(get.mock.calls[1][0]).toBe(`${get.mock.calls[0][0]}/receipt`)
  })

  it('refuses unknown/interrupted receipts and mismatched bytes even after HTTP success', async () => {
    for (const receipt of [{ state: 'UNKNOWN', sizeBytes: 8, sha256: 'a'.repeat(64) },
      { state: 'INTERRUPTED', sizeBytes: 8, sha256: 'a'.repeat(64) },
      { state: 'BODY_WRITE_COMPLETED', sizeBytes: 8, sha256: 'a'.repeat(64) },
      { state: 'BODY_WRITE_COMPLETED', sizeBytes: 9, sha256: 'a'.repeat(64) }]) {
      get.mockResolvedValueOnce(new Blob(['ORIGINAL'])).mockResolvedValueOnce(receipt)
      await expect(fetchTrackedAttachment(url)).rejects.toThrow()
    }
  })
})


describe('tracked raster preview', () => {
  it('rejects active HTML, SVG and unsandboxed PDF content', async () => {
    for (const source of ['<html><script>alert(1)</script>', '<svg xmlns="http://www.w3.org/2000/svg">', '%PDF-1.7']) {
      await expect(rasterPreviewBlob(new Blob([source], { type: 'image/png' }))).rejects.toThrow('Inline preview is unavailable')
    }
  })
  it('selects a fixed raster type from bytes rather than uploaded metadata', async () => {
    const blob = new Blob([new Uint8Array([0x89, 80, 78, 71, 13, 10, 26, 10])], { type: 'text/html' })
    expect((await rasterPreviewBlob(blob)).type).toBe('image/png')
  })
})


it('admits only an exact PDF header for the dedicated inert canvas renderer', async () => {
  expect((await safeAttachmentPreviewBlob(new Blob(['%PDF-1.7\nfixture']))).type).toBe('application/pdf')
  for (const header of ['<html>%PDF-1.7', '%PDF-9.9', '%PDF-1.x']) {
    await expect(safeAttachmentPreviewBlob(new Blob([header]))).rejects.toThrow()
  }
})


it('uses a new uniquely correlated body and receipt for each preview/download invocation', async () => {
  const blob = new Blob(['ORIGINAL'])
  const sha256 = Buffer.from(await webcrypto.subtle.digest('SHA-256', await blob.arrayBuffer())).toString('hex')
  for (let i = 0; i < 2; i++) get.mockResolvedValueOnce(blob).mockResolvedValueOnce({ state: 'BODY_WRITE_COMPLETED', sizeBytes: 8, sha256 })
  await fetchTrackedAttachment(url)
  await fetchTrackedAttachment(url)
  const first = String(get.mock.calls[0][0]), second = String(get.mock.calls[2][0])
  expect(first).not.toBe(second)
  expect(first).toMatch(/^\/qbit\/record-files\/files\/12\/downloads\/[a-f0-9-]{36}$/)
  expect(second).toMatch(/^\/qbit\/record-files\/files\/12\/downloads\/[a-f0-9-]{36}$/)
  expect(get.mock.calls[1][0]).toBe(first + '/receipt')
  expect(get.mock.calls[3][0]).toBe(second + '/receipt')
})

it('does not request or save bytes after cancellation', async () => {
  const lifetime = new AbortController()
  lifetime.abort()
  await expect(fetchTrackedAttachment(url, lifetime.signal)).rejects.toThrow()
  await expect(saveAttachmentDownload({ url, delivery: 'AUTHENTICATED_FETCH' }, 'file', lifetime.signal)).rejects.toThrow()
  expect(get).not.toHaveBeenCalled()
})

it('propagates caller cancellation into the receipt request', async () => {
  const lifetime = new AbortController()
  get.mockResolvedValueOnce(new Blob(['ORIGINAL']))
  let receiptSignal: AbortSignal | undefined
  get.mockImplementationOnce((_path, options) => new Promise((_resolve, reject) => {
    receiptSignal = options?.signal as AbortSignal
    receiptSignal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
  }))
  const work = fetchTrackedAttachment(url, lifetime.signal)
  const rejected = expect(work).rejects.toThrow('Cancelled')
  await vi.waitFor(() => expect(receiptSignal).toBeDefined())
  lifetime.abort()
  await rejected
  expect(receiptSignal?.aborted).toBe(true)
  expect(get.mock.calls[0][1]?.signal).toBe(receiptSignal)
})
