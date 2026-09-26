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

// Tests for ScriptEditorDialog (multi-file script editor, API selects, tools)

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api/developer', () => ({
  storeScriptRevision: vi.fn(),
  testScript: vi.fn(),
}))

const tableState = vi.hoisted(() => ({ fields: {} as Record<string, unknown> }))
vi.mock('@/lib/hooks/use-metadata', () => ({
  useTableMetaData: (name: string) => ({ data: { name, label: name, fields: tableState.fields } }),
}))

vi.mock('@/lib/api/possible-values', () => ({
  fetchTablePossibleValues: vi.fn(async (_table: string, field: string) => (field === 'apiName'
    ? [{ id: 'sampleApi', label: 'Sample API' }]
    : [{ id: '2025.Q4', label: '2025.Q4' }, { id: '2026.Q1', label: '2026.Q1' }])),
}))

import { storeScriptRevision, testScript } from '@/lib/api/developer'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { API_REQUIRED_MESSAGE, ScriptEditorDialog, type ScriptEditorDialogProps } from './ScriptEditorDialog'

const FILES: ScriptEditorDialogProps['files'] = [
  { name: 'main.js', fileType: 'javascript', contents: 'main();' },
  { name: 'template.vm', fileType: 'velocity', contents: '#if($a)A#end' },
  { name: 'data.json', fileType: 'json', contents: '{"a":1}' },
]

/**
 * Render the dialog with a fresh query client.
 * @param overrides - Props to override.
 * @returns Spies for the callbacks.
 */
function renderDialog(overrides: Partial<ScriptEditorDialogProps> = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn(async () => undefined)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ScriptEditorDialog
        idKey="lab"
        title="Editing Code for Script: Owned"
        files={FILES}
        scriptId={7}
        onClose={onClose}
        onSaved={onSaved}
        {...overrides}
      />
    </QueryClientProvider>,
  )
  return { onClose, onSaved }
}

describe('ScriptEditorDialog', () => {
  beforeEach(() => {
    tableState.fields = {}
    vi.mocked(storeScriptRevision).mockReset()
    vi.mocked(testScript).mockReset()
  })

  it('opens the first file in one pane, colored by its file type; each pane picks its file', async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const editor = within(dialog).getByLabelText('main.js')
    expect(editor).toHaveValue('main();')
    const select = within(dialog).getByLabelText('File in editor 1')
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual(['main.js', 'template.vm', 'data.json'])
    await user.selectOptions(select, 'template.vm')
    expect(within(dialog).getByLabelText('template.vm')).toHaveValue('#if($a)A#end')
    expect(dialog.querySelector('.qqq-code-overlay .qqq-code-directive')).toHaveTextContent('#if')
  })

  it('splits the editor into panes and closes a split', async () => {
    const user = userEvent.setup()
    renderDialog()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: /Close editor split/ })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Open a new editor split' }))
    await user.selectOptions(within(dialog).getByLabelText('File in editor 2'), 'data.json')
    expect(within(dialog).getByLabelText('main.js')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('data.json')).toHaveValue('{"a":1}')
    // only the last pane offers another split
    expect(within(dialog).getAllByRole('button', { name: 'Open a new editor split' })).toHaveLength(1)
    await user.click(within(dialog).getByRole('button', { name: 'Close editor split 1' }))
    expect(within(dialog).queryByLabelText('main.js')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('data.json')).toBeInTheDocument()
  })

  it('stores every file, the commit message and no API when the scripts model has no API fields', async () => {
    const user = userEvent.setup()
    vi.mocked(storeScriptRevision).mockResolvedValue({ scriptRevisionId: 9 })
    const { onSaved } = renderDialog()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByLabelText(/API Name/)).not.toBeInTheDocument()
    const editor = within(dialog).getByLabelText('main.js')
    await user.clear(editor)
    await user.type(editor, 'changed();')
    await user.type(within(dialog).getByLabelText('Commit message'), 'Change main{Enter}')
    await waitFor(() => expect(storeScriptRevision).toHaveBeenCalledWith({
      scriptId: 7,
      commitMessage: 'Change main',
      files: { 'main.js': 'changed();', 'template.vm': '#if($a)A#end', 'data.json': '{"a":1}' },
      apiName: undefined,
      apiVersion: undefined,
    }))
    expect(onSaved).toHaveBeenCalledWith(9)
  })

  it('requires an API name and version when script revisions carry them, then stores them', async () => {
    const user = userEvent.setup()
    tableState.fields = { apiName: { name: 'apiName' }, apiVersion: { name: 'apiVersion' } }
    vi.mocked(storeScriptRevision).mockResolvedValue({ scriptRevisionId: 10 })
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const apiName = await within(dialog).findByLabelText(/API Name/)
    const apiVersion = within(dialog).getByLabelText(/API Version/)
    expect(apiName).toHaveAttribute('aria-required', 'true')
    await waitFor(() => expect((apiVersion as HTMLSelectElement).options).toHaveLength(3))
    expect(fetchTablePossibleValues).toHaveBeenCalledWith('scriptRevision', 'apiName')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(API_REQUIRED_MESSAGE)
    expect(storeScriptRevision).not.toHaveBeenCalled()

    await user.selectOptions(apiName, 'sampleApi')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(API_REQUIRED_MESSAGE)
    await user.selectOptions(apiVersion, '2026.Q1')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(storeScriptRevision).toHaveBeenCalledWith(expect.objectContaining({
      apiName: 'sampleApi', apiVersion: '2026.Q1', commitMessage: 'No commit message given',
    })))
  })

  it('starts from the edited revision\'s API name and version', async () => {
    tableState.fields = { apiName: { name: 'apiName' }, apiVersion: { name: 'apiVersion' } }
    renderDialog({ initialApiName: 'sampleApi', initialApiVersion: '2025.Q4' })
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByLabelText(/API Name/)).toHaveValue('sampleApi'))
    expect(within(dialog).getByLabelText(/API Version/)).toHaveValue('2025.Q4')
  })

  it('shows the docs and tests the unsaved code beside the editor', async () => {
    const user = userEvent.setup()
    vi.mocked(testScript).mockResolvedValue({ outputObject: { result: 'ran' }, logLines: [] })
    renderDialog({
      scriptType: { tableName: 'scriptType', values: { id: 1, helpText: 'Owned help', sampleCode: 'sample();' } },
      testFields: { inputFields: [{ name: 'who', label: 'Who', type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] }], outputFields: [{ name: 'result', label: 'Result', type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] }] },
    })
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Docs' }))
    expect(within(dialog).getByRole('button', { name: 'Docs' })).toHaveAttribute('aria-pressed', 'true')
    expect(dialog.querySelector('[data-qqq-id="script-docs-help-lab-editor"]')).toHaveTextContent('Owned help')

    await user.click(within(dialog).getByRole('button', { name: 'Test' }))
    expect(within(dialog).getByRole('button', { name: 'Docs' })).toHaveAttribute('aria-pressed', 'false')
    const editor = within(dialog).getByLabelText('main.js')
    await user.clear(editor)
    await user.type(editor, 'unsaved();')
    await user.type(within(dialog).getByLabelText('Who'), 'Ada')
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(testScript).toHaveBeenCalledWith(expect.objectContaining({
      scriptId: 7, inputValues: { who: 'Ada' }, files: expect.objectContaining({ 'main.js': 'unsaved();' }),
    })))
    expect(await within(dialog).findByText('ran')).toBeInTheDocument()
    expect(storeScriptRevision).not.toHaveBeenCalled()
  })

  it('does not close on Escape (Material keeps unsaved code), and asks before unloading changes', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    const dialog = screen.getByRole('dialog')
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()

    const unchanged = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unchanged)
    expect(unchanged.defaultPrevented).toBe(false)
    await user.type(within(dialog).getByLabelText('main.js'), ' more')
    const changed = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(changed)
    expect(changed.defaultPrevented).toBe(true)

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('lets keyboard users leave the code box with Esc then Tab without closing the dialog', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    const dialog = screen.getByRole('dialog')
    const editor = within(dialog).getByLabelText('main.js')
    await user.click(editor)
    await user.keyboard('{Tab}')
    expect(editor).toHaveFocus()
    expect(editor).toHaveValue('main();  ')
    await user.keyboard('{Escape}{Tab}')
    expect(editor).not.toHaveFocus()
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
  })
})
