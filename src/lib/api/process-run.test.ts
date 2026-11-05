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

/** @file Screen-less process runs for dynamic components (Material's QController.processRun contract). */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ init: vi.fn(), status: vi.fn() }))
vi.mock('./processes', () => ({ processInit: mocks.init, processStatus: mocks.status }))

import { processRunValues, runProcessToCompletion } from './process-run'

beforeEach(() => vi.clearAllMocks())

describe('processRunValues', () => {
  it('reads a query string, FormData and a plain object', () => {
    const form = new FormData(); form.append('workflowId', '7'); form.append('file', new File(['x'], 'x.txt'))
    expect(processRunValues('workflowId=1&name=a%20b')).toEqual({ workflowId: '1', name: 'a b' })
    expect(processRunValues(form)).toEqual({ workflowId: '7' })
    expect(processRunValues({ a: 1 })).toEqual({ a: 1 })
    expect(processRunValues(undefined)).toEqual({})
  })
})

describe('runProcessToCompletion', () => {
  it('returns the values of a process that completes on init', async () => {
    mocks.init.mockResolvedValue({ type: 'COMPLETE', processUUID: 'p', values: { workflow: '{}' } })
    expect(await runProcessToCompletion('getWorkflowRevision', 'workflowId=1')).toEqual({ values: { workflow: '{}' } })
    expect(mocks.init).toHaveBeenCalledWith('getWorkflowRevision', expect.objectContaining({ values: { workflowId: '1' } }))
  })
  it('polls an async job until it completes', async () => {
    mocks.init.mockResolvedValue({ type: 'JOB_STARTED', processUUID: 'p', jobUUID: 'j' })
    mocks.status.mockResolvedValueOnce({ type: 'RUNNING', processUUID: 'p' }).mockResolvedValueOnce({ type: 'COMPLETE', processUUID: 'p', values: { ok: true } })
    expect(await runProcessToCompletion('x', {}, { pollIntervalMillis: 1 })).toEqual({ values: { ok: true } })
    expect(mocks.status).toHaveBeenCalledTimes(2)
  })
  it('reports a refusal with the user-facing text, and a timeout, without throwing', async () => {
    mocks.init.mockResolvedValue({ type: 'ERROR', error: 'denied', userFacingError: 'You may not do that', status: 403 })
    expect(await runProcessToCompletion('x', {})).toEqual({ error: 'You may not do that', userFacingError: 'You may not do that' })
    mocks.init.mockResolvedValue({ type: 'JOB_STARTED', processUUID: 'p', jobUUID: 'j' })
    mocks.status.mockResolvedValue({ type: 'RUNNING', processUUID: 'p' })
    expect((await runProcessToCompletion('x', {}, { pollIntervalMillis: 1, timeoutMillis: 5 })).error).toMatch(/Timed out/)
  })
})
