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

// Tests for AssociatedScriptViewer (record developer view associated scripts)

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api/developer', () => ({
  getAssociatedScriptLogs: vi.fn(),
  queryScriptRevisionFiles: vi.fn(),
  queryScriptRevisions: vi.fn(),
  queryScriptTypeFileSchemas: vi.fn(),
  storeRecordAssociatedScript: vi.fn(),
  storeScriptRevision: vi.fn(),
  testScript: vi.fn(),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
}))

import type { QFieldMetaData, QRecord } from '@/types'
import type { AssociatedScriptData } from '@/lib/api/developer'
import {
  getAssociatedScriptLogs,
  queryScriptRevisionFiles,
  queryScriptRevisions,
  queryScriptTypeFileSchemas,
  storeRecordAssociatedScript,
  storeScriptRevision,
  testScript,
} from '@/lib/api/developer'
import { toast } from '@/lib/hooks/use-toast'
import { AssociatedScriptViewer, type AssociatedScriptViewerProps } from './AssociatedScriptViewer'

const FIELD = 'greetingScriptId'

/**
 * Build tester field metadata.
 * @param name - Field name.
 * @param label - Field label.
 * @param defaultValue - Default value.
 * @returns The field.
 */
function field(name: string, label: string, defaultValue?: string): QFieldMetaData {
  return { name, label, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], defaultValue }
}

const scriptType: QRecord = {
  tableName: 'scriptType',
  values: {
    id: 101, name: 'Greeting Script Type', fileMode: 1,
    helpText: 'Greeting scripts return a greeting for the given name.',
    sampleCode: "return 'Hello, ' + input.name;",
  },
}
const script: QRecord = { tableName: 'script', values: { id: 101, name: 'Alpha Greeting', scriptTypeId: 101, currentScriptRevisionId: 102 } }
const revisions: QRecord[] = [
  { tableName: 'scriptRevision', values: { id: 102, scriptId: 101, sequenceNo: 2, commitMessage: 'Friendlier greeting', author: 'Owned author', createDate: '2026-09-25T01:27:36Z' } },
  { tableName: 'scriptRevision', values: { id: 101, scriptId: 101, sequenceNo: 1, commitMessage: 'Initial version', author: 'Owned author', createDate: '2026-09-24T01:27:36Z' } },
]
const files: Record<number, QRecord[]> = {
  101: [{ tableName: 'scriptRevisionFile', values: { id: 1, scriptRevisionId: 101, fileName: 'Script.js', contents: "return 'Hi';" } }],
  102: [{ tableName: 'scriptRevisionFile', values: { id: 2, scriptRevisionId: 102, fileName: 'Script.js', contents: "return 'Hello, friend';" } }],
}
const data: AssociatedScriptData = {
  associatedScript: { fieldName: FIELD, scriptTypeId: 101 },
  scriptType,
  script,
  scriptRevisions: revisions,
  testInputFields: [field('name', 'Greeting Name', 'World')],
  testOutputFields: [field('greeting', 'Greeting')],
}

/**
 * Render the viewer with a fresh query client.
 * @param overrides - Props to override.
 * @returns The render result plus the onChanged spy.
 */
function renderViewer(overrides: Partial<AssociatedScriptViewerProps> = {}) {
  const onChanged = vi.fn(async () => undefined)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={client}>
      <AssociatedScriptViewer
        tableName="scriptLab"
        recordId={1}
        fieldLabel="Greeting Script"
        data={data}
        scriptId={101}
        canCreate
        canEdit
        canTest
        onChanged={onChanged}
        {...overrides}
      />
    </QueryClientProvider>,
  )
  return { ...result, onChanged }
}

/**
 * The card of the associated script field.
 * @returns The card element.
 */
function card(): HTMLElement {
  return document.querySelector(`[data-qqq-id="associated-script-${FIELD}"]`) as HTMLElement
}

/**
 * Query an element by data-qqq-id.
 * @param id - The data-qqq-id.
 * @returns The element, or null.
 */
function byQqqId(id: string): HTMLElement | null {
  return document.querySelector(`[data-qqq-id="${id}"]`)
}

/**
 * Wait for an element with a data-qqq-id.
 * @param id - The data-qqq-id.
 * @returns The element.
 */
function findByQqqId(id: string): Promise<HTMLElement> {
  return waitFor(() => {
    const element = byQqqId(id)
    if (!element) throw new Error(`No element with data-qqq-id ${id}`)
    return element
  })
}

describe('AssociatedScriptViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queryScriptRevisions).mockResolvedValue(revisions)
    vi.mocked(queryScriptRevisionFiles).mockImplementation(async (id) => files[Number(id)] ?? [])
  })

  it('lists versions newest first, marks the current one and shows its code', async () => {
    renderViewer()

    expect(within(card()).getByRole('heading', { name: 'Greeting Script' })).toBeInTheDocument()
    expect(await screen.findByText("return 'Hello, friend';")).toHaveAttribute('data-qqq-id', `script-code-${FIELD}-Script.js`)
    const current = byQqqId('script-version-102')!
    expect(current).toHaveAttribute('aria-pressed', 'true')
    expect(current).toHaveTextContent('Version 2')
    expect(current).toHaveTextContent('CURRENT')
    expect(current).toHaveTextContent('Friendlier greeting')
    expect(current).toHaveTextContent(/2026-09-2\d \d\d:\d\d:\d\d [AP]M .+ by Owned author/)
    expect(byQqqId('script-version-101')).not.toHaveTextContent('CURRENT')
    expect(screen.getByRole('heading', { name: 'Version 2 (Current)' })).toBeInTheDocument()
    expect(screen.getByText('Script.js', { selector: 'figcaption' })).toBeInTheDocument()
    expect(byQqqId(`button-edit-script-${FIELD}`)).toHaveTextContent(/^Edit$/)
    expect(byQqqId(`select-script-file-${FIELD}`)).toBeNull()
    expect(queryScriptRevisions).toHaveBeenCalledWith(101)
  })

  it('shows the one file of a single-file script as Script.js whatever name it was stored under', async () => {
    // The backend's create-script route stores the first revision's file as "script".
    vi.mocked(queryScriptRevisionFiles).mockResolvedValue([
      { tableName: 'scriptRevisionFile', values: { id: 3, scriptRevisionId: 102, fileName: 'script', contents: '// Edit this new script to define its code.' } },
    ])
    renderViewer()

    expect(await screen.findByText('// Edit this new script to define its code.')).toHaveAttribute('data-qqq-id', `script-code-${FIELD}-Script.js`)
    expect(byQqqId(`script-code-${FIELD}-script`)).toBeNull()
    expect(byQqqId(`select-script-file-${FIELD}`)).toBeNull()
  })

  it('selects an older version and offers Edit and Activate', async () => {
    const user = userEvent.setup()
    renderViewer()

    await user.click(await findByQqqId('script-version-101'))
    expect(await screen.findByText("return 'Hi';")).toBeInTheDocument()
    expect(byQqqId('script-version-101')).toHaveAttribute('aria-pressed', 'true')
    expect(byQqqId('script-version-102')).toHaveAttribute('aria-pressed', 'false')
    expect(byQqqId(`button-edit-script-${FIELD}`)).toHaveTextContent('Edit and Activate')
  })

  it('hides Edit without storeScriptRevision and Test without testScript', async () => {
    renderViewer({ canEdit: false, canTest: false })

    await screen.findByText("return 'Hello, friend';")
    expect(byQqqId(`button-edit-script-${FIELD}`)).toBeNull()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Code', 'Logs', 'Docs'])
    expect(byQqqId(`script-tab-${FIELD}-test`)).toBeNull()
  })

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    vi.mocked(getAssociatedScriptLogs).mockResolvedValue([])
    renderViewer()

    const code = byQqqId(`script-tab-${FIELD}-code`)!
    expect(code).toHaveAttribute('aria-selected', 'true')
    code.focus()
    await user.keyboard('{ArrowRight}')
    expect(byQqqId(`script-tab-${FIELD}-logs`)).toHaveAttribute('aria-selected', 'true')
    expect(byQqqId(`script-tab-${FIELD}-logs`)).toHaveFocus()
    await user.keyboard('{End}')
    expect(byQqqId(`script-tab-${FIELD}-docs`)).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(code).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', code.id)
  })

  it('saves a new version with the edited code and commit message, then selects it', async () => {
    const user = userEvent.setup()
    vi.mocked(storeScriptRevision).mockResolvedValue({ scriptId: 101, scriptRevisionId: 103, scriptRevisionSequenceNo: 3 })
    const { onChanged } = renderViewer()

    await screen.findByText("return 'Hello, friend';")
    await user.click(byQqqId(`button-edit-script-${FIELD}`)!)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-qqq-id', `dialog-script-editor-${FIELD}`)
    expect(within(dialog).getByRole('heading', { name: 'Editing Code for Script: Alpha Greeting' })).toBeInTheDocument()
    const editor = within(dialog).getByLabelText('Script.js')
    expect(editor).toHaveAttribute('id', `script-edit-${FIELD}-Script-js`)
    expect(editor).toHaveValue("return 'Hello, friend';")
    await user.clear(editor)
    await user.type(editor, "return 'Howdy';")
    const commit = within(dialog).getByLabelText('Commit message')
    expect(commit).toHaveAttribute('id', `script-commit-message-${FIELD}`)
    await user.type(commit, 'Howdy instead')

    vi.mocked(queryScriptRevisions).mockResolvedValue([
      { tableName: 'scriptRevision', values: { id: 103, scriptId: 101, sequenceNo: 3, commitMessage: 'Howdy instead', author: 'Me', createDate: '2026-09-25T02:00:00Z' } },
      ...revisions,
    ])
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(storeScriptRevision).toHaveBeenCalledWith({ scriptId: 101, commitMessage: 'Howdy instead', files: { 'Script.js': "return 'Howdy';" } })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith('Saved New Script Version')
    expect(onChanged).toHaveBeenCalled()
    await waitFor(() => expect(byQqqId('script-version-103')).toHaveAttribute('aria-pressed', 'true'))
  })

  it('sends the default commit message and keeps the dialog open with the backend error', async () => {
    const user = userEvent.setup()
    vi.mocked(storeScriptRevision).mockRejectedValue(new Error('You do not have permission to run this process.'))
    renderViewer()

    await screen.findByText("return 'Hello, friend';")
    await user.click(byQqqId(`button-edit-script-${FIELD}`)!)
    const dialog = await screen.findByRole('dialog')
    await user.click(byQqqId(`button-save-script-${FIELD}`)!)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('You do not have permission to run this process.')
    expect(storeScriptRevision).toHaveBeenCalledWith(expect.objectContaining({ commitMessage: 'No commit message given' }))
    expect(toast.success).not.toHaveBeenCalled()

    await user.click(byQqqId(`button-cancel-script-${FIELD}`)!)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes the editor with Escape', async () => {
    const user = userEvent.setup()
    renderViewer()

    await screen.findByText("return 'Hello, friend';")
    await user.click(byQqqId(`button-edit-script-${FIELD}`)!)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(storeScriptRevision).not.toHaveBeenCalled()
  })

  it('tests the selected version and shows outputs per output field and the log lines', async () => {
    const user = userEvent.setup()
    vi.mocked(testScript).mockResolvedValue({
      outputObject: { greeting: 'Hello, Ada! (22 characters)' },
      logLines: [{ timestamp: '2026-09-25T01:02:03Z', text: 'Tested with Ada' }],
    })
    renderViewer()

    await screen.findByText("return 'Hello, friend';")
    await user.click(byQqqId(`script-tab-${FIELD}-test`)!)
    const input = screen.getByLabelText('Greeting Name')
    expect(input).toHaveAttribute('id', `script-test-${FIELD}-name`)
    expect(input).toHaveValue('World')
    await user.clear(input)
    await user.type(input, 'Ada')
    await user.click(byQqqId(`button-test-script-${FIELD}`)!)

    expect(testScript).toHaveBeenCalledWith({ scriptId: 101, files: { 'Script.js': "return 'Hello, friend';" }, inputValues: { name: 'Ada' } })
    const output = byQqqId(`script-test-output-${FIELD}`)!
    await waitFor(() => expect(byQqqId(`script-test-output-${FIELD}-greeting`)).toHaveTextContent('Greeting: Hello, Ada! (22 characters)'))
    expect(within(output).queryByRole('alert')).toBeNull()
    const lines = byQqqId(`script-test-log-lines-${FIELD}`)!
    expect(within(lines).getByText('Tested with Ada')).toBeInTheDocument()
    expect(within(lines).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Timestamp', 'Log Line'])
    // a narrow output card (tablet with the sidebar, QRun-IO/qqq#708) scrolls the log table inside it
    expect(lines.parentElement).toHaveClass('overflow-x-auto')
  })

  it('shows the exception message chain and process errors of a test', async () => {
    const user = userEvent.setup()
    vi.mocked(testScript).mockResolvedValueOnce({ outputObject: {}, logLines: [], exceptionMessage: 'Greeting script failed\ncaused by: root' })
    renderViewer()

    await screen.findByText("return 'Hello, friend';")
    await user.click(byQqqId(`script-tab-${FIELD}-test`)!)
    await user.click(byQqqId(`button-test-script-${FIELD}`)!)
    const error = await findByQqqId(`script-test-error-${FIELD}`)
    expect(error).toHaveAttribute('role', 'alert')
    expect(error.textContent).toBe('Greeting script failed\ncaused by: root')

    vi.mocked(testScript).mockRejectedValueOnce(new Error('You do not have permission to run this process.'))
    await user.click(byQqqId(`button-test-script-${FIELD}`)!)
    await waitFor(() => expect(byQqqId(`script-test-error-${FIELD}`)).toHaveTextContent('You do not have permission to run this process.'))
  })

  it('shows the run logs of the selected version', async () => {
    const user = userEvent.setup()
    vi.mocked(getAssociatedScriptLogs).mockResolvedValue([
      {
        tableName: 'scriptLog',
        values: {
          id: 102, startTimestamp: '2026-09-25T03:00:00Z', runTimeMillis: 1234, hadError: true, input: '{"name":"Bo"}', output: null, error: 'Boom',
          scriptLogLine: [
            { tableName: 'scriptLogLine', values: { text: 'first' } },
            { tableName: 'scriptLogLine', values: { text: 'second' } },
          ],
        },
      },
      { tableName: 'scriptLog', values: { id: 101, startTimestamp: '2026-09-25T02:00:00Z', runTimeMillis: 5, hadError: false, input: 'in', output: 'out' } },
    ])
    renderViewer()

    await screen.findByText("return 'Hello, friend';")
    await user.click(byQqqId(`script-tab-${FIELD}-logs`)!)
    const table = await findByQqqId(`script-logs-${FIELD}`)
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent))
      .toEqual(['Timestamp', 'Run Time (ms)', 'Had Error?', 'Input', 'Output', 'Logs'])
    const failed = byQqqId('script-log-102')!
    expect(failed).toHaveTextContent('1234')
    expect(failed).toHaveTextContent('Yes')
    expect(failed).toHaveTextContent('Boom')
    expect(within(failed).getByText(/first\s+second/)).toBeInTheDocument()
    expect(byQqqId('script-log-101')).toHaveTextContent('No')
    expect(screen.getByRole('heading', { name: 'Script Logs (Version 2)' })).toBeInTheDocument()
    expect(getAssociatedScriptLogs).toHaveBeenCalledWith('scriptLab', 1, FIELD, 102)
  })

  it('says when a version has no logs', async () => {
    const user = userEvent.setup()
    vi.mocked(getAssociatedScriptLogs).mockResolvedValue([])
    renderViewer()

    await screen.findByText("return 'Hello, friend';")
    await user.click(byQqqId(`script-tab-${FIELD}-logs`)!)
    expect(await screen.findByText('No logs available for this version.')).toBeInTheDocument()
  })

  it('shows the script type documentation and example code', async () => {
    const user = userEvent.setup()
    renderViewer()

    await user.click(byQqqId(`script-tab-${FIELD}-docs`)!)
    expect(byQqqId(`script-docs-help-${FIELD}`)).toHaveTextContent('Greeting scripts return a greeting for the given name.')
    expect(byQqqId(`script-docs-example-${FIELD}`)).toHaveTextContent("return 'Hello, ' + input.name;")
  })

  it('offers Create New Version when the script has no versions', async () => {
    vi.mocked(queryScriptRevisions).mockResolvedValue([])
    renderViewer()

    expect(await screen.findByText('There are not any versions of this script.')).toBeInTheDocument()
    expect(byQqqId(`button-edit-script-${FIELD}`)).toHaveTextContent('Create New Version')
  })

  it('lists pre-defined files of a multi-file script type in a file select', async () => {
    const user = userEvent.setup()
    vi.mocked(queryScriptTypeFileSchemas).mockResolvedValue([
      { tableName: 'scriptTypeFileSchema', values: { id: 1, name: 'main.js', fileType: 'javascript' } },
      { tableName: 'scriptTypeFileSchema', values: { id: 2, name: 'template.vm', fileType: 'velocity' } },
    ])
    vi.mocked(queryScriptRevisionFiles).mockResolvedValue([
      { tableName: 'scriptRevisionFile', values: { id: 3, fileName: 'main.js', contents: 'main();' } },
      { tableName: 'scriptRevisionFile', values: { id: 4, fileName: 'template.vm', contents: '$name' } },
    ])
    renderViewer({ data: { ...data, scriptType: { ...scriptType, values: { ...scriptType.values, fileMode: 2 } } } })

    expect(await screen.findByText('main();')).toHaveAttribute('data-qqq-id', `script-code-${FIELD}-main.js`)
    const select = byQqqId(`select-script-file-${FIELD}`)!
    expect(select).toBe(screen.getByLabelText('File'))
    await user.selectOptions(select, 'template.vm')
    expect(screen.getByText('$name')).toHaveAttribute('data-qqq-id', `script-code-${FIELD}-template.vm`)
    expect(queryScriptTypeFileSchemas).toHaveBeenCalledWith(101)
  })

  it('offers Create Script for an empty field and creates it with the Material defaults', async () => {
    const user = userEvent.setup()
    vi.mocked(storeRecordAssociatedScript).mockResolvedValue({ scriptId: 7 })
    const { onChanged } = renderViewer({ scriptId: null, data: { ...data, script: undefined, scriptRevisions: undefined } })

    expect(within(card()).getByText('No script has been created in this field for this record at this time.')).toBeInTheDocument()
    await user.click(byQqqId(`button-create-script-${FIELD}`)!)

    expect(storeRecordAssociatedScript).toHaveBeenCalledWith('scriptLab', 1, FIELD, '// Edit this new script to define its code.', 'Initial version')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(queryScriptRevisions).not.toHaveBeenCalled()
  })

  it('does not offer Create Script without table edit permission', async () => {
    renderViewer({ scriptId: null, canCreate: false, data: { ...data, script: undefined } })
    expect(screen.getByText('No script has been created in this field for this record at this time.')).toBeInTheDocument()
    expect(byQqqId(`button-create-script-${FIELD}`)).toBeNull()
  })

  it('shows a create failure as an alert', async () => {
    const user = userEvent.setup()
    vi.mocked(storeRecordAssociatedScript).mockRejectedValue(new Error('Permission denied.'))
    renderViewer({ scriptId: null, data: { ...data, script: undefined } })

    await user.click(byQqqId(`button-create-script-${FIELD}`)!)
    expect(await within(card()).findByRole('alert')).toHaveTextContent('Permission denied.')
  })
})
