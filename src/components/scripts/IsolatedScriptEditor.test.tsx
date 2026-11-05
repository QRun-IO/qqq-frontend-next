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

/** @file Isolated source workflow tests; no real compiler or legacy script process. */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import * as api from '@/lib/api/scripting'
import { IsolatedScriptEditor } from './IsolatedScriptEditor'

vi.mock('@/lib/api/scripting', async (original) => {
  const actual = await original<typeof import('@/lib/api/scripting')>()
  return { ...actual, getScriptProject: vi.fn(), getScriptDraft: vi.fn(), saveScriptDraft: vi.fn(),
    compileScriptRevision: vi.fn(), testScriptContext: vi.fn(), publishScriptBuild: vi.fn(), getScriptApiTypes: vi.fn(), importScriptDraft: vi.fn() }
})
const discovery = vi.hoisted(() => ({ installed: true }))
vi.mock('@/lib/api/ui-api-extensions', () => ({ useUiApiExtensionInstalled: () => discovery.installed }))
vi.mock('./TypeScriptSourceEditor', async () => {
  const { CodeEditor } = await import('./CodeEditor')
  return { TypeScriptSourceEditor: (props: import('./TypeScriptSourceEditor').TypeScriptSourceEditorProps) => <CodeEditor
    id="fixture-source" ariaLabel={`TypeScript source: ${props.active}`} language="typescript" autocomplete
    apiCompletions={[{ text: 'qqq.query(', description: 'Authorized reads' }]}
    value={props.files.find((file) => file.path === props.active)!.content} readOnly={props.readOnly} onChange={props.onChange} /> }
})

const PROJECT: api.ScriptProject = {
  scriptId: 7, executionMode: 'ISOLATED', latestRevisionId: 10, revisions: [{ id: 10, sequence: 1, message: 'Initial', author: 'alice' }],
  builds: [], publications: [], actions: ['draft', 'check', 'test', 'publish'], workerAvailable: true, importAvailable: false,
}

/** Mount with an isolated query cache for every editor test. */
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><IsolatedScriptEditor scriptId={7} label="Context script" /></QueryClientProvider>)
}

describe('isolated source editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    discovery.installed = true
    vi.mocked(api.getScriptProject).mockResolvedValue(PROJECT)
    vi.mocked(api.getScriptDraft).mockResolvedValue({ revisionId: 10, sourceSha256: 'a'.repeat(64), files: [{ path: 'src/index.ts', content: 'export async function main() { return {}; }' }] })
    vi.mocked(api.compileScriptRevision).mockResolvedValue({ buildId: 20, success: true, artifactId: 30, artifactVersion: 1, diagnostics: [] })
    vi.mocked(api.testScriptContext).mockResolvedValue({ executionId: 40, status: 'OK', message: null, contextJson: '{"hello":"world"}' })
    vi.mocked(api.publishScriptBuild).mockResolvedValue(50)
  })

  it('keeps build, context test and publication distinct, then invalidates the build on edits', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByRole('textbox', { name: 'TypeScript source: src/index.ts' })
    expect(screen.getByRole('button', { name: 'Test context' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish tested build' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Build saved revision' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Test context' })).toBeEnabled())
    expect(api.compileScriptRevision).toHaveBeenCalledWith(7, 10, 'src/index.ts', [], expect.any(AbortSignal))
    expect(api.publishScriptBuild).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Test context' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish tested build' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Publish tested build' }))
    await screen.findByText('Published immutable version 50.')
    expect(api.publishScriptBuild).toHaveBeenCalledWith(7, 20, '', expect.any(AbortSignal))
    fireEvent.change(screen.getByRole('textbox', { name: 'TypeScript source: src/index.ts' }), { target: { value: 'export const changed = true;' } })
    expect(screen.getByRole('button', { name: 'Build saved revision' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publish tested build' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
  })

  it('saves the observed base revision and never invokes publication automatically', async () => {
    const user = userEvent.setup()
    vi.mocked(api.saveScriptDraft).mockRejectedValue(new Error('Source changed; reload'))
    mount()
    const editor = await screen.findByRole('textbox', { name: 'TypeScript source: src/index.ts' })
    fireEvent.change(editor, { target: { value: 'new source' } })
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByText('Source changed; reload')
    expect(api.saveScriptDraft).toHaveBeenCalledWith(7, 10, [{ path: 'src/index.ts', content: 'new source' }], '', expect.any(AbortSignal))
    expect(api.compileScriptRevision).not.toHaveBeenCalled()
    expect(api.publishScriptBuild).not.toHaveBeenCalled()
    expect(editor).toHaveValue('new source')
  })

  it('fails closed on missing extension and disables unavailable workers and unauthorized actions', async () => {
    discovery.installed = false
    const first = mount()
    expect(screen.getByText(/requires the scripting API extension/)).toBeVisible()
    expect(api.getScriptProject).not.toHaveBeenCalled()
    first.unmount()
    discovery.installed = true
    vi.mocked(api.getScriptProject).mockResolvedValue({ ...PROJECT, workerAvailable: false, actions: [] })
    mount()
    expect(await screen.findByRole('button', { name: 'Build saved revision' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'TypeScript source: src/index.ts' })).toHaveAttribute('readonly')
  })

  it('suggests the isolated read broker without offering legacy write helpers', async () => {
    const user = userEvent.setup()
    mount()
    const editor = await screen.findByRole('textbox', { name: 'TypeScript source: src/index.ts' })
    fireEvent.change(editor, { target: { value: 'qqq.qu' } })
    await user.click(editor)
    await user.keyboard('{End}{Control>} {/Control}')
    await waitFor(() => expect(screen.getByRole('option', { name: /qqq.query/ })).toBeVisible())
    expect(screen.queryByRole('option', { name: /api.insert/ })).not.toBeInTheDocument()
  })

  it('keeps timed-out mutations uncertain after refreshing history instead of retrying them', async () => {
    const user = userEvent.setup()
    vi.mocked(api.compileScriptRevision).mockRejectedValue(new AxiosError('Timeout', 'ECONNABORTED'))
    mount()
    await screen.findByRole('textbox', { name: 'TypeScript source: src/index.ts' })
    await user.click(screen.getByRole('button', { name: 'Build saved revision' }))
    await screen.findByText(/Server work may still finish/)
    expect(screen.getByRole('button', { name: 'Build saved revision' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Source revision' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Refresh server history' }))
    await waitFor(() => expect(api.getScriptProject).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Build saved revision' })).toBeDisabled()
    expect(api.compileScriptRevision).toHaveBeenCalledTimes(1)
    expect(api.publishScriptBuild).not.toHaveBeenCalled()
  })

  it('imports only an explicit immutable commit into the normal draft lifecycle', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getScriptProject).mockResolvedValue({ ...PROJECT, importAvailable: true })
    vi.mocked(api.importScriptDraft).mockResolvedValue(10)
    mount()
    await screen.findByRole('textbox', { name: 'TypeScript source: src/index.ts' })
    await user.click(screen.getByText('Import / sync from an exact GitHub commit'))
    await user.type(screen.getByRole('textbox', { name: 'GitHub repository' }), 'acme/scripts')
    await user.type(screen.getByRole('textbox', { name: 'Commit SHA' }), 'main')
    expect(screen.getByRole('button', { name: 'Import commit as draft' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Commit SHA' }), { target: { value: 'a'.repeat(40) } })
    await user.type(screen.getByRole('textbox', { name: 'Source subdirectory' }), 'scripts')
    await user.click(screen.getByRole('button', { name: 'Import commit as draft' }))
    await waitFor(() => expect(api.importScriptDraft).toHaveBeenCalledWith(7, 10, 'acme/scripts', 'a'.repeat(40), 'scripts', expect.any(AbortSignal)))
    expect(api.compileScriptRevision).not.toHaveBeenCalled()
    expect(api.publishScriptBuild).not.toHaveBeenCalled()
  })
})
