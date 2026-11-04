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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveredFileActions } from './DeliveredFileActions'
import * as delivery from '@/lib/api/attachment-download'

vi.mock('@/lib/api/attachment-download', () => ({ fetchTrackedAttachment: vi.fn(), safeAttachmentPreviewBlob: vi.fn(), saveAttachmentDownload: vi.fn() }))
vi.mock('./FilePreviewLightbox', () => ({ FilePreviewLightbox: ({ items, onClose }: { items: { url: string }[]; onClose: () => void }) =>
  <div role="dialog"><span>{items[0].url}</span><button onClick={onClose}>Close preview</button></div> }))
const URL_VALUE = 'https://api.example/credential-bound-transfer'

describe('metadata authenticated delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => 'blob:verified'), revokeObjectURL: vi.fn() }))
    vi.mocked(delivery.fetchTrackedAttachment).mockResolvedValue(new Blob(['verified']))
    vi.mocked(delivery.safeAttachmentPreviewBlob).mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }))
    vi.mocked(delivery.saveAttachmentDownload).mockResolvedValue()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('never renders an authenticated capability in href/src and verifies only on request', async () => {
    const result = render(<DeliveredFileActions url={URL_VALUE} fileName="Packing.pdf" allowPreview dataQqqId="delivery" />)
    expect(delivery.fetchTrackedAttachment).not.toHaveBeenCalled()
    expect(result.container.querySelector('a, img, iframe')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Preview file' }))
    await screen.findByRole('dialog')
    expect(delivery.fetchTrackedAttachment).toHaveBeenCalledWith(URL_VALUE, expect.any(AbortSignal))
    expect(delivery.safeAttachmentPreviewBlob).toHaveBeenCalledWith(expect.any(Blob))
    expect(screen.getByRole('dialog')).toHaveTextContent('blob:verified')
    expect(result.container.innerHTML).not.toContain(URL_VALUE)
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }))
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:verified'))
  })

  it('shows receipt refusal and never opens a preview', async () => {
    vi.mocked(delivery.fetchTrackedAttachment).mockRejectedValue(new Error('No durable receipt'))
    render(<DeliveredFileActions url={URL_VALUE} fileName="Packing.pdf" allowPreview dataQqqId="delivery" />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview file' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No durable receipt')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('saves through the shared receipt gate and does not invent a plain link fallback', async () => {
    vi.mocked(delivery.saveAttachmentDownload).mockRejectedValue(new Error('Access revoked'))
    const result = render(<DeliveredFileActions url={URL_VALUE} fileName="Label.zpl" allowPreview={false} dataQqqId="delivery" />)
    fireEvent.click(screen.getByRole('button', { name: 'Download file' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Access revoked')
    expect(delivery.saveAttachmentDownload).toHaveBeenCalledWith({ url: URL_VALUE, delivery: 'AUTHENTICATED_FETCH' }, 'Label.zpl', expect.any(AbortSignal))
    expect(result.container.querySelector('a')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Preview file' })).not.toBeInTheDocument()
  })

  it('does not allocate a blob when its view unmounts during verification', async () => {
    let finish!: (blob: Blob) => void
    vi.mocked(delivery.fetchTrackedAttachment).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const result = render(<DeliveredFileActions url={URL_VALUE} fileName="Packing.pdf" allowPreview dataQqqId="delivery" />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview file' }))
    const signal = vi.mocked(delivery.fetchTrackedAttachment).mock.calls[0][1]
    result.unmount(); finish(new Blob(['verified']))
    await waitFor(() => expect(signal?.aborted).toBe(true))
    expect(delivery.safeAttachmentPreviewBlob).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
