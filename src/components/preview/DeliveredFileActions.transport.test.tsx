/* Copyright 2026 QRun.IO, Inc. Licensed under the Apache License, Version 2.0. */
import React from 'react'
import { Blob as NodeBlob } from 'node:buffer'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import apiClient from '@/lib/api/client'
import { DeliveredFileActions } from './DeliveredFileActions'

vi.mock('@/lib/api/client', () => ({ default: { get: vi.fn(), getInstance: () => ({ defaults: { baseURL: 'https://api.example/qqq/v1' } }) } }))
vi.mock('./FilePreviewLightbox', () => ({ FilePreviewLightbox: () => <div role="dialog" /> }))
const url = 'https://api.example/qqq/v1/qbit/record-files/files/12/downloads/10000000-0000-0000-0000-000000000001'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())

it.each(['unmount', 'source change'])('aborts an actual deferred receipt on %s without creating a preview', async (change) => {
  let receiptSignal: AbortSignal | undefined
  let rejectReceipt!: (error: Error) => void
  vi.mocked(apiClient.get).mockResolvedValueOnce(new Blob(['%PDF-1.7\nfixture'])).mockImplementationOnce((_route, options) => {
    receiptSignal = options?.signal as AbortSignal
    return new Promise((_resolve, reject) => {
      rejectReceipt = reject
      receiptSignal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
    })
  })
  const view = render(<DeliveredFileActions url={url} fileName="packing.pdf" allowPreview dataQqqId="delivery" />)
  fireEvent.click(screen.getByRole('button', { name: 'Preview file' }))
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
  expect(vi.mocked(apiClient.get).mock.calls[1][0]).toMatch(/\/receipt$/)
  expect(receiptSignal?.aborted).toBe(false)
  if (change === 'unmount') view.unmount()
  else view.rerender(<DeliveredFileActions url={url.replace('/12/', '/13/')} fileName="other.pdf" allowPreview dataQqqId="delivery" />)
  await waitFor(() => expect(receiptSignal?.aborted).toBe(true))
  expect(URL.createObjectURL).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  rejectReceipt(new Error('Late response cannot revive the preview'))
})
