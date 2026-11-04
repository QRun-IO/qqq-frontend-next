/* Copyright 2026 QRun.IO, Inc. Licensed under the Apache License, Version 2.0. */
/** @file Preview transport gating, failure and object URL lifetime tests. */
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAttachmentPreview } from './use-attachment-preview'
import { useAttachmentUrl } from './use-collaboration-record'
import { fetchTrackedAttachment, safeAttachmentPreviewBlob } from '@/lib/api/attachment-download'
vi.mock('./use-collaboration-record', () => ({ useAttachmentUrl: vi.fn() }))
vi.mock('@/lib/api/attachment-download', () => ({ fetchTrackedAttachment: vi.fn(), safeAttachmentPreviewBlob: vi.fn() }))
const create = vi.fn(() => 'blob:verified')
const revoke = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true })
  create.mockReturnValue('blob:verified')
})
it('does not expose tracked URLs before verification and revokes the raster preview on unmount', async () => {
  vi.mocked(useAttachmentUrl).mockReturnValue({ data: { url: 'https://api/attempt', delivery: 'AUTHENTICATED_FETCH' }, isError: false } as ReturnType<typeof useAttachmentUrl>)
  const bytes = new Blob(['bytes'])
  let resolve!: (value: Blob) => void
  vi.mocked(fetchTrackedAttachment).mockReturnValue(new Promise<Blob>((done) => { resolve = done }))
  vi.mocked(safeAttachmentPreviewBlob).mockResolvedValue(bytes)
  const hook = renderHook(() => useAttachmentPreview(12, true))
  expect(hook.result.current.data).toBeUndefined()
  expect(create).not.toHaveBeenCalled()
  resolve(bytes)
  await waitFor(() => expect(hook.result.current.data?.url).toBe('blob:verified'))
  hook.unmount()
  expect(revoke).toHaveBeenCalledWith('blob:verified')
})
it('surfaces a failed receipt without a preview URL or local object allocation', async () => {
  vi.mocked(useAttachmentUrl).mockReturnValue({ data: { url: 'https://api/attempt', delivery: 'AUTHENTICATED_FETCH' }, isError: false } as ReturnType<typeof useAttachmentUrl>)
  vi.mocked(fetchTrackedAttachment).mockRejectedValue(new Error('Audit unknown'))
  const hook = renderHook(() => useAttachmentPreview(12, true))
  await waitFor(() => expect(hook.result.current.isError).toBe(true))
  expect(hook.result.current.data).toBeUndefined()
  expect(create).not.toHaveBeenCalled()
})
it('preserves ordinary signed previews without making an authenticated arbitrary URL fetch', () => {
  vi.mocked(useAttachmentUrl).mockReturnValue({ data: { url: 'https://storage/signed' }, isError: false } as ReturnType<typeof useAttachmentUrl>)
  const hook = renderHook(() => useAttachmentPreview(12, true))
  expect(hook.result.current.data?.url).toBe('https://storage/signed')
  expect(fetchTrackedAttachment).not.toHaveBeenCalled()
})


it('aborts work on source changes and close, and never returns a revoked URL on reopen', async () => {
  vi.mocked(useAttachmentUrl).mockReturnValue({ data: { url: 'https://api/first', delivery: 'AUTHENTICATED_FETCH' }, isError: false } as ReturnType<typeof useAttachmentUrl>)
  vi.mocked(fetchTrackedAttachment).mockResolvedValueOnce(new Blob(['image']))
  vi.mocked(safeAttachmentPreviewBlob).mockResolvedValue(new Blob(['image']))
  const hook = renderHook(({ enabled }) => useAttachmentPreview(12, enabled), { initialProps: { enabled: true } })
  await waitFor(() => expect(hook.result.current.data?.url).toBe('blob:verified'))
  const first = vi.mocked(fetchTrackedAttachment).mock.calls[0][1]
  hook.rerender({ enabled: false })
  expect(first?.aborted).toBe(true)
  expect(revoke).toHaveBeenCalledWith('blob:verified')
  vi.mocked(fetchTrackedAttachment).mockImplementation(() => new Promise<Blob>(() => {}))
  hook.rerender({ enabled: true })
  expect(hook.result.current.data).toBeUndefined()
  const second = vi.mocked(fetchTrackedAttachment).mock.calls[1][1]
  vi.mocked(useAttachmentUrl).mockReturnValue({ data: { url: 'https://api/second', delivery: 'AUTHENTICATED_FETCH' }, isError: false } as ReturnType<typeof useAttachmentUrl>)
  hook.rerender({ enabled: true })
  expect(second?.aborted).toBe(true)
  const third = vi.mocked(fetchTrackedAttachment).mock.calls[2][1]
  hook.unmount()
  expect(third?.aborted).toBe(true)
})
