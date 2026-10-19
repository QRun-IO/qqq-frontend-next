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

// The panel's attachments: checked before upload, uploaded as the user, failures inline

import { act, renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AssistantConfig } from '@/types/assistant'
import { server } from '@/mocks/node'
import * as uploads from '@/lib/api/uploads'
import { resetClientErrorsForTesting, setClientErrorSink } from '@/lib/errors/client-errors'
import { useAssistantAttachments } from './use-assistant-attachments'

const READS: AssistantConfig = { enabled: true, features: { attachments: true }, limits: { maxAttachmentBytes: 1024 * 1024 } }

/**
 * A file of a given size (content is never read by the panel).
 *
 * @param name - File name.
 * @param size - Size in bytes.
 * @param type - Content type.
 * @returns The file.
 */
function file(name: string, size: number, type = 'text/plain'): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('useAssistantAttachments', () => {
  afterEach(() => {
    resetClientErrorsForTesting()
    vi.restoreAllMocks()
  })

  it('says a file is too large without uploading it', async () => {
    const upload = vi.fn()
    server.use(http.post('/qqq/v1/uploads', () => { upload(); return HttpResponse.json({}) }))
    const { result } = renderHook(() => useAssistantAttachments(READS, false, null))
    await act(() => result.current.attach(file('scan.pdf', 2 * 1024 * 1024, 'application/pdf')))
    expect(result.current.error).toBe('scan.pdf is 2 MB. The assistant reads files up to 1 MB.')
    expect(result.current.attachments).toEqual([])
    expect(upload).not.toHaveBeenCalled()
  })

  it('attaches an upload with its size and type, sends only the ref and name, and keeps it when the conversation is created', async () => {
    server.use(http.post('/qqq/v1/uploads', () => HttpResponse.json({ ref: 'up_1', fileName: 'notes.txt', sizeBytes: 2048, contentType: 'text/plain', expiresAt: '2026-10-17T00:00:00Z' })))
    const { result, rerender } = renderHook(({ id }) => useAssistantAttachments(READS, false, id), { initialProps: { id: null as number | null } })
    await act(() => result.current.attach(file('notes.txt', 2048)))
    expect(result.current.error).toBeNull()
    expect(result.current.attachments).toEqual([{ uploadRef: 'up_1', fileName: 'notes.txt', sizeBytes: 2048, contentType: 'text/plain' }])
    expect(result.current.forTurn()).toEqual([{ uploadRef: 'up_1', fileName: 'notes.txt' }])

    // the first message creates the conversation: the file stays attached to it
    rerender({ id: 4 })
    expect(result.current.attachments).toHaveLength(1)
    // switching conversations drops it
    rerender({ id: 5 })
    expect(result.current.attachments).toEqual([])
    expect(result.current.forTurn()).toBeUndefined()
  })

  it('discards an upload completed after switching conversations without stopping the new upload', async () => {
    let finishOld!: (value: Awaited<ReturnType<typeof uploads.uploadFile>>) => void
    let finishNew!: (value: Awaited<ReturnType<typeof uploads.uploadFile>>) => void
    vi.spyOn(uploads, 'uploadFile')
      .mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishNew = resolve }))
    const { result, rerender } = renderHook(({ id }) => useAssistantAttachments(READS, false, id), { initialProps: { id: 4 } })
    let oldRequest!: Promise<void>
    act(() => { oldRequest = result.current.attach(file('old.txt', 100)) })
    rerender({ id: 5 })
    let newRequest!: Promise<void>
    act(() => { newRequest = result.current.attach(file('new.txt', 100)) })
    await act(async () => {
      finishOld({ ref: 'old', fileName: 'old.txt', sizeBytes: 100, contentType: 'text/plain', expiresAt: '' })
      await oldRequest
    })
    expect(result.current.attachments).toEqual([])
    expect(result.current.attaching).toBe(true)
    await act(async () => {
      finishNew({ ref: 'new', fileName: 'new.txt', sizeBytes: 100, contentType: 'text/plain', expiresAt: '' })
      await newRequest
    })
    expect(result.current.forTurn()).toEqual([{ uploadRef: 'new', fileName: 'new.txt' }])
    expect(result.current.attaching).toBe(false)
  })

  it('rejects overlapping uploads and drops a stale failure after explicitly leaving a draft', async () => {
    let rejectUpload!: (error: Error) => void
    const upload = vi.spyOn(uploads, 'uploadFile').mockImplementation(() => new Promise((_, reject) => { rejectUpload = reject }))
    const { result, rerender } = renderHook(({ id }) => useAssistantAttachments(READS, false, id), { initialProps: { id: null as number | null } })
    let request!: Promise<void>
    act(() => { request = result.current.attach(file('old.txt', 100)) })
    await act(() => result.current.attach(file('extra.txt', 100)))
    expect(upload).toHaveBeenCalledTimes(1)
    expect(result.current.error).toContain('Wait for the current upload')
    act(() => result.current.clear())
    rerender({ id: 5 })
    await act(async () => { rejectUpload(new Error('old upload failed')); await request })
    expect(result.current.error).toBeNull()
    expect(result.current.attaching).toBe(false)
    expect(result.current.attachments).toEqual([])
  })

  it('shows a failed upload inline and reports it without the file', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const sink = vi.fn().mockResolvedValue(true)
    setClientErrorSink(sink)
    server.use(http.post('/qqq/v1/uploads', () => HttpResponse.json({ error: 'The file could not be read.' }, { status: 400 })))
    const { result } = renderHook(() => useAssistantAttachments(READS, false, null))
    await act(() => result.current.attach(file('private-notes.txt', 100)))
    expect(result.current.error).toMatch(/^Could not attach private-notes\.txt: /)
    expect(result.current.attaching).toBe(false)
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ scope: 'assistant-upload' }))
    expect(JSON.stringify(sink.mock.calls)).not.toContain('private-notes')
    act(() => result.current.dismissError())
    expect(result.current.error).toBeNull()
  })
})
