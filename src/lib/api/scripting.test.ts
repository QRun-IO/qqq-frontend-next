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

/** @file Isolated scripting transport uses semantic routes and validates server bodies. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from './client'
import { compileScriptRevision, createScriptBinding, getScriptDraft, getScriptHooks, getScriptProject, saveScriptDraft, setScriptBindingEnabled, testScriptContext, testScriptHook } from './scripting'

vi.mock('./client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

describe('isolated scripting transport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses a saved revision, bounded wait and cancellation for a semantic build', async () => {
    const response = { buildId: 3, success: true, diagnostics: [], artifactId: 4, artifactVersion: 1 }
    vi.mocked(apiClient.post).mockResolvedValue(response)
    const signal = new AbortController().signal
    await expect(compileScriptRevision(7, 2, 'src/index.ts', [], signal)).resolves.toEqual(response)
    expect(apiClient.post).toHaveBeenCalledWith('/qbit/scripting/projects/7/builds', { revisionId: 2, entryPoint: 'src/index.ts', capabilities: [] }, { signal, timeout: 150_000 })
  })

  it('refuses invalid identities and malformed source or execution results', async () => {
    await expect(getScriptProject('../processes/testScript')).rejects.toThrow('Invalid script identity')
    expect(apiClient.get).not.toHaveBeenCalled()
    vi.mocked(apiClient.get).mockResolvedValue({ revisionId: 1, sourceSha256: 'a'.repeat(64), files: [] })
    await expect(getScriptDraft(7, 1)).rejects.toThrow()
    vi.mocked(apiClient.post).mockResolvedValue({ executionId: 1, status: true })
    await expect(testScriptContext(7, 1, {}, [])).rejects.toThrow()
  })

  it('sends optimistic source identity without actor or worker overrides', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 5 })
    const files = [{ path: 'src/index.ts', content: 'export const value = 1;' }]
    await expect(saveScriptDraft(7, 4, files, 'Update')).resolves.toBe(5)
    expect(apiClient.post).toHaveBeenCalledWith('/qbit/scripting/projects/7/drafts', { baseRevisionId: 4, files, message: 'Update' }, { signal: undefined })
  })
})

describe('record hook transport', () => {
  it('accepts exactly the nine supported phases and rejects unknown or excessive phase metadata', async () => {
    const events = ['PRE_INSERT', 'PRE_UPDATE', 'PRE_DELETE', 'POST_INSERT', 'POST_UPDATE', 'POST_DELETE', 'AFTER_INSERT', 'AFTER_UPDATE', 'AFTER_DELETE']
    const phases = events.map((event) => ({ event, patchableFields: [] }))
    const view = { targets: [{ tableName: 'orders', label: 'Orders', phases }], bindings: [], historyLimited: false, nextBindingId: null }
    vi.mocked(apiClient.get).mockResolvedValue(view)
    await expect(getScriptHooks(7)).resolves.toEqual(view)
    vi.mocked(apiClient.get).mockResolvedValue({ ...view, targets: [{ ...view.targets[0], phases: [...phases, phases[0]] }] })
    await expect(getScriptHooks(7)).rejects.toThrow()
    vi.mocked(apiClient.get).mockResolvedValue({ ...view, targets: [{ ...view.targets[0], phases: [{ event: 'AFTER_ARBITRARY', patchableFields: [] }] }] })
    await expect(getScriptHooks(7)).rejects.toThrow()
  })

  beforeEach(() => vi.clearAllMocks())

  it('uses project-scoped binding routes and explicit keyset history without generic writes', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ targets: [], bindings: [], historyLimited: false, nextBindingId: null })
    const signal = new AbortController().signal
    await getScriptHooks(7, signal, 12)
    expect(apiClient.get).toHaveBeenCalledWith('/qbit/scripting/projects/7/hooks', { signal, params: { beforeBindingId: 12 } })
    vi.mocked(apiClient.post).mockResolvedValue({ id: 5 })
    const input = { name: 'Warehouse', tableName: 'orders', event: 'PRE_UPDATE' as const, publicationId: 8, capabilities: [], patchableFields: ['status'] }
    await expect(createScriptBinding(7, input, signal)).resolves.toBe(5)
    expect(apiClient.post).toHaveBeenCalledWith('/qbit/scripting/projects/7/bindings', input, { signal })
    await setScriptBindingEnabled(7, 5, false, signal)
    expect(apiClient.post).toHaveBeenCalledWith('/qbit/scripting/projects/7/bindings/5/state', { enabled: false }, { signal })
  })

  it('bounds selected-record test input and rejects malformed worker decisions', async () => {
    const input = { tableName: 'orders', event: 'PRE_UPDATE' as const, recordId: '42', changes: { status: 'NEW' } }
    const answer = { executionId: 1, status: 'OK', message: null, contextJson: null, hook: { action: 'PATCH', message: null, patch: { status: 'SIMULATED' } } }
    vi.mocked(apiClient.post).mockResolvedValue(answer)
    const signal = new AbortController().signal
    await expect(testScriptHook(7, 2, input, signal)).resolves.toEqual(answer)
    expect(apiClient.post).toHaveBeenCalledWith('/qbit/scripting/projects/7/builds/2/test-hook', input, { signal, timeout: 150_000 })
    vi.mocked(apiClient.post).mockClear()
    await expect(testScriptHook(7, 2, { ...input, changes: { status: { nested: 'not scalar' } } })).rejects.toThrow()
    expect(apiClient.post).not.toHaveBeenCalled()
    vi.mocked(apiClient.post).mockResolvedValue({ ...answer, hook: { action: 'EXECUTE', message: null, patch: null } })
    await expect(testScriptHook(7, 2, input)).rejects.toThrow()
  })
})
