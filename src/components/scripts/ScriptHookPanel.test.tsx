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

/** @file Hook administration keeps dry runs, publication and active bindings distinct. */

import React, { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as api from '@/lib/api/scripting'
import { ScriptHookPanel } from './ScriptHookPanel'

vi.mock('@/lib/api/scripting', async (original) => {
  const actual = await original<typeof import('@/lib/api/scripting')>()
  return { ...actual, getScriptHooks: vi.fn(), createScriptBinding: vi.fn(), setScriptBindingEnabled: vi.fn(), testScriptHook: vi.fn() }
})
vi.mock('./CodeEditor', () => ({ CodeEditor: (props: { ariaLabel: string; value: string; readOnly?: boolean; onChange?: (value: string) => void }) => <textarea
  aria-label={props.ariaLabel} value={props.value} readOnly={props.readOnly} onChange={(event) => props.onChange?.(event.target.value)} /> }))

const PROJECT: api.ScriptProject = { scriptId: 7, executionMode: 'ISOLATED', latestRevisionId: 10, revisions: [], builds: [],
  publications: [{ id: 50, revisionId: 10, artifactId: 30, version: 2, status: null, actor: 'alice', createdAt: null }],
  actions: ['view', 'bind', 'test'], workerAvailable: true, importAvailable: false }
const VIEW: api.ScriptHookView = { targets: [{ tableName: 'orders', label: 'Orders', phases: [{ event: 'PRE_UPDATE', patchableFields: ['status'] }, { event: 'POST_DELETE', patchableFields: [] }] }],
  bindings: [{ id: 40, name: 'Production', tableName: 'orders', event: 'PRE_UPDATE', publicationId: 2, enabled: true, grants: [], patchableFields: ['status'] }], historyLimited: true, nextBindingId: 5 }
const RESULT: api.ScriptHookResult = { executionId: 60, status: 'OK', message: null, contextJson: null, hook: { action: 'PATCH', message: null, patch: { status: 'SIMULATED' } } }
const tested = vi.fn()

/**
 * Mirror the editor's shared cancellation/error runner without executing script text.
 * @param props - Current authorized project.
 * @returns Isolated hook panel fixture.
 */
function Harness({ project }: { project: api.ScriptProject }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <><ScriptHookPanel scriptId={7} project={project} build={{ buildId: 20, success: true, artifactId: 30, artifactVersion: 1, diagnostics: [] }}
    disabled={busy} capabilities={() => []} onTested={tested} run={(work) => {
      setBusy(true)
      void work(new AbortController().signal).catch((failure: Error) => setError(failure.message)).finally(() => setBusy(false))
    }} />{error && <p role="alert">{error}</p>}</>
}

/**
 * Start an isolated React Query cache for one project fixture.
 * @param project - Project permissions and runtime availability.
 * @returns Rendered hook controls.
 */
function mount(project = PROJECT) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><Harness project={project} /></QueryClientProvider>)
}

describe('record hook controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getScriptHooks).mockImplementation(async (_project, _signal, cursor) => cursor === 5
      ? { ...VIEW, bindings: [{ ...VIEW.bindings[0], id: 1, name: 'Old publication', publicationId: 1 }], nextBindingId: null, historyLimited: false } : VIEW)
    vi.mocked(api.testScriptHook).mockResolvedValue(RESULT)
    vi.mocked(api.createScriptBinding).mockResolvedValue(99)
    vi.mocked(api.setScriptBindingEnabled).mockResolvedValue(40)
  })

  it('loads on demand and simulates the selected record without activating a binding', async () => {
    const user = userEvent.setup()
    mount()
    expect(api.getScriptHooks).not.toHaveBeenCalled()
    await user.click(screen.getByText('Record hooks: test and bindings'))
    await screen.findByRole('combobox', { name: 'Hook table' })
    await user.type(screen.getByRole('textbox', { name: 'Selected record ID' }), '42')
    fireEvent.change(screen.getByRole('textbox', { name: 'Proposed hook test changes' }), { target: { value: '{"status":"PROPOSED"}' } })
    await user.click(screen.getByRole('button', { name: 'Test hook without writes' }))
    await screen.findByText('Hook dry run: OK. No record changes were applied.')
    expect(api.testScriptHook).toHaveBeenCalledWith(7, 20, { tableName: 'orders', event: 'PRE_UPDATE', recordId: '42', changes: { status: 'PROPOSED' } }, expect.any(AbortSignal))
    expect(tested).toHaveBeenCalledWith(RESULT)
    expect(api.createScriptBinding).not.toHaveBeenCalled()
    expect(api.setScriptBindingEnabled).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Simulated hook decision' })).toHaveValue(JSON.stringify(RESULT.hook, null, 2))
  })

  it.each(['AFTER_INSERT', 'AFTER_UPDATE', 'AFTER_DELETE'] as const)('explains %s and dry-runs only metadata-authorized observations', async (phase) => {
    const user = userEvent.setup()
    vi.mocked(api.getScriptHooks).mockResolvedValue({ ...VIEW, targets: [{ ...VIEW.targets[0], phases: [{ event: phase, patchableFields: [] }] }] })
    mount()
    await user.click(screen.getByText('Record hooks: test and bindings'))
    expect(await screen.findByRole('combobox', { name: 'Hook event' })).toHaveValue(phase)
    expect(screen.queryByRole('textbox', { name: 'Proposed hook test changes' })).not.toBeInTheDocument()
    expect(screen.getByText(/AFTER scripts may only return ALLOW/)).toHaveTextContent(phase === 'AFTER_DELETE' ? 'never deleted record values' : 'read the currently authorized record at delivery time')
    await user.type(screen.getByRole('textbox', { name: 'Selected record ID' }), '42')
    await user.click(screen.getByRole('button', { name: 'Test hook without writes' }))
    await waitFor(() => expect(api.testScriptHook).toHaveBeenCalledWith(7, 20, { tableName: 'orders', event: phase, recordId: '42', changes: {} }, expect.any(AbortSignal)))
    expect(api.createScriptBinding).not.toHaveBeenCalled()
  })

  it('creates a pinned enabled binding only after its explicit action and permits disabling it', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Record hooks: test and bindings'))
    await screen.findByRole('textbox', { name: 'Binding name' })
    await user.type(screen.getByRole('textbox', { name: 'Binding name' }), 'Warehouse')
    await user.click(screen.getByRole('checkbox', { name: 'status' }))
    await user.click(screen.getByRole('button', { name: 'Create enabled binding' }))
    await screen.findByText('Binding 99 is enabled.')
    expect(api.createScriptBinding).toHaveBeenCalledWith(7, { name: 'Warehouse', tableName: 'orders', event: 'PRE_UPDATE', publicationId: 50, capabilities: [], patchableFields: ['status'] }, expect.any(AbortSignal))
    await user.click(screen.getByRole('button', { name: 'Disable Production' }))
    await waitFor(() => expect(api.setScriptBindingEnabled).toHaveBeenCalledWith(7, 40, false, expect.any(AbortSignal)))
  })

  it('pages retained bindings and can disable one pinned to an old publication', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByText('Record hooks: test and bindings'))
    await user.click(await screen.findByRole('button', { name: 'Older bindings' }))
    await user.click(await screen.findByRole('button', { name: 'Disable Old publication' }))
    await waitFor(() => expect(api.setScriptBindingEnabled).toHaveBeenCalledWith(7, 1, false, expect.any(AbortSignal)))
    expect(api.getScriptHooks).toHaveBeenCalledWith(7, expect.any(AbortSignal), 5)
    await user.click(screen.getByRole('button', { name: 'First binding page' }))
    await screen.findByRole('button', { name: 'Disable Production' })
  })

  it('returns to the newest page after creating from an older page and identifies controls', async () => {
    const user = userEvent.setup()
    const rendered = mount()
    await user.click(screen.getByText('Record hooks: test and bindings'))
    await user.click(await screen.findByRole('button', { name: 'Older bindings' }))
    await screen.findByRole('button', { name: 'Disable Old publication' })
    await user.type(screen.getByRole('textbox', { name: 'Binding name' }), 'New binding')
    await user.click(screen.getByRole('button', { name: 'Create enabled binding' }))
    await screen.findByText('Binding 99 is enabled.')
    await screen.findByRole('button', { name: 'Disable Production' })
    expect(screen.queryByRole('button', { name: 'First binding page' })).not.toBeInTheDocument()
    for (const control of rendered.container.querySelectorAll('summary, select, input, button')) {
      expect(control.getAttribute('data-qqq-id')).toMatch(/^script-hook/)
    }
  })

  it('disables unauthorized actions and allows emergency disable when the worker is unavailable', async () => {
    const user = userEvent.setup()
    const rendered = mount({ ...PROJECT, actions: ['view'] })
    await user.click(screen.getByText('Record hooks: test and bindings'))
    expect(await screen.findByRole('button', { name: 'Disable Production' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create enabled binding' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Test hook without writes' })).toBeDisabled()
    rendered.unmount()
    mount({ ...PROJECT, workerAvailable: false })
    await user.click(screen.getByText('Record hooks: test and bindings'))
    expect(await screen.findByRole('button', { name: 'Disable Production' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Test hook without writes' })).toBeDisabled()
  })

  it('shows a denied action and retains the pinned binding for inspection', async () => {
    const user = userEvent.setup()
    vi.mocked(api.setScriptBindingEnabled).mockRejectedValue(new Error('Current target permission required'))
    mount()
    await user.click(screen.getByText('Record hooks: test and bindings'))
    await user.click(await screen.findByRole('button', { name: 'Disable Production' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('Current target permission required')
    expect(screen.getByRole('button', { name: 'Disable Production' })).toBeEnabled()
  })
})
