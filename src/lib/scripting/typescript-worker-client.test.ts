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


/** @file Worker lifecycle tests prove deadlines, bounded queueing and unmount termination. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { TypeScriptWorkerClient, type IdeWorker } from './typescript-worker-client'
import type { IdeRequest } from './typescript-session'

/** Trusted transport fixture; no compiler code or script execution. */
function worker() {
  return { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() } as IdeWorker & { postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }
}
const files = [{ path: 'src/main.ts', content: 'export const value = 1;' }]
afterEach(() => vi.useRealTimers())

describe('TypeScript analysis worker lifetime', () => {
  it('accepts matching results and terminates on idle and unmount', async () => {
    vi.useFakeTimers()
    const fixture = worker()
    const client = new TypeScriptWorkerClient(() => fixture)
    const pending = client.request('diagnostics', files, files[0].path, 0)
    const message = fixture.postMessage.mock.calls[0][0] as IdeRequest
    fixture.onmessage!({ data: { protocol: 'qqq-typescript-ide/1', version: '6.0.3', id: message.id, result: { diagnostics: [] } } } as MessageEvent)
    await expect(pending).resolves.toEqual({ diagnostics: [] })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fixture.terminate).toHaveBeenCalledTimes(1)
    client.dispose()
    await expect(client.request('hover', files, files[0].path, 0)).rejects.toThrow('closed')
  })

  it('kills stalled compiler work and rejects every queued operation without retry', async () => {
    vi.useFakeTimers()
    const fixture = worker()
    const factory = vi.fn(() => fixture)
    const client = new TypeScriptWorkerClient(factory)
    const first = client.request('diagnostics', files, files[0].path, 0)
    const second = client.request('hover', files, files[0].path, 0)
    const outcomes = Promise.allSettled([first, second])
    await vi.advanceTimersByTimeAsync(10_001)
    expect((await outcomes).every((result) => result.status === 'rejected')).toBe(true)
    expect(fixture.terminate).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledTimes(1)
    client.dispose()
  })

  it('rejects oversized requests before worker creation and closes invalid envelopes', async () => {
    const fixture = worker()
    const factory = vi.fn(() => fixture)
    const client = new TypeScriptWorkerClient(factory)
    await expect(client.request('diagnostics', [{ path: 'src/a.ts', content: 'x'.repeat(262145) }], 'src/a.ts', 0)).rejects.toThrow('limits')
    expect(factory).not.toHaveBeenCalled()
    const pending = client.request('diagnostics', files, files[0].path, 0)
    fixture.onmessage!({ data: { protocol: 'wrong', version: '6.0.3', id: 1, result: {} } } as MessageEvent)
    await expect(pending).rejects.toThrow('invalid response')
    expect(fixture.terminate).toHaveBeenCalledTimes(1)
    client.dispose()
  })

  it('caps queued work and rejects pending operations immediately on disposal', async () => {
    const fixture = worker()
    const client = new TypeScriptWorkerClient(() => fixture)
    const pending = Array.from({ length: 4 }, () => client.request('diagnostics', files, files[0].path, 0))
    const outcomes = Promise.allSettled(pending)
    await expect(client.request('hover', files, files[0].path, 0)).rejects.toThrow('queue')
    client.dispose()
    expect((await outcomes).every((result) => result.status === 'rejected')).toBe(true)
    expect(fixture.terminate).toHaveBeenCalledTimes(1)
  })
})

