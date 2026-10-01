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

// Tests for ScriptViewerWidget

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'

vi.mock('@/lib/api/tables', () => ({
  getRecord: vi.fn(),
  queryRecords: vi.fn(),
}))

const metaState = vi.hoisted(() => ({ processes: {} as Record<string, unknown>, tables: {} as Record<string, unknown> }))
vi.mock('@/lib/hooks/use-metadata', () => ({
  useMetaData: () => ({ data: { processes: metaState.processes, tables: metaState.tables, apps: {} } }),
  useTableMetaData: () => ({ data: undefined }),
}))

import type { QRecord, QWidgetMetaData } from '@/types'
import type { QueryRecordsRequest } from '@/lib/api/tables'
import { getRecord, queryRecords } from '@/lib/api/tables'
import { ScriptViewerWidget } from './ScriptViewerWidget'

const getRecordMock = vi.mocked(getRecord)
const queryRecordsMock = vi.mocked(queryRecords)

const meta: QWidgetMetaData = { name: 'scriptViewer', label: 'Script Viewer', type: 'scriptViewer', hasPermission: true }
const payload = { type: 'scriptViewer', queryParams: { id: '1' } }

const script: QRecord = { tableName: 'script', values: { id: 1, name: 'Owned script', scriptTypeId: 1, currentScriptRevisionId: 1 } }
const singleFileType: QRecord = { tableName: 'scriptType', values: { id: 1, name: 'Owned type', fileMode: 1, helpText: 'Owned help', sampleCode: "return 'sample';" } }
const revisions: QRecord[] = [
  {
    tableName: 'scriptRevision',
    values: { id: 2, scriptId: 1, sequenceNo: 2, commitMessage: 'Owned second revision', author: 'Owned author', createDate: '2026-09-25T01:27:36Z', apiName: 'sampleApi', apiVersion: '2026.Q1' },
    displayValues: { apiName: 'Sample API', apiVersion: '2026.Q1' },
  },
  { tableName: 'scriptRevision', values: { id: 1, scriptId: 1, sequenceNo: 1, commitMessage: 'Owned first revision', author: 'Owned author', createDate: '2026-09-24T01:27:36Z', apiName: null, apiVersion: null } },
]
const files: Record<number, QRecord[]> = {
  1: [{ tableName: 'scriptRevisionFile', values: { id: 1, scriptRevisionId: 1, fileName: 'Script.js', contents: "return 'owned one';" } }],
  2: [{ tableName: 'scriptRevisionFile', values: { id: 2, scriptRevisionId: 2, fileName: 'Script.js', contents: "return 'owned two';" } }],
}

/**
 * Render the widget with a fresh query client.
 * @param data - Widget payload.
 * @returns The render result.
 */
function renderWidget(data: unknown = payload) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ScriptViewerWidget widgetMetaData={meta} data={data as typeof payload} />
    </QueryClientProvider>,
  )
}

/**
 * The code block showing exactly this text (highlighted code is split into token spans).
 * @param code - The code text.
 * @returns The code block.
 */
function codeElement(code: string): HTMLElement {
  const match = Array.from(document.querySelectorAll<HTMLElement>('[data-qqq-id^="script-code-"]')).find((element) => element.textContent === code)
  if (!match) throw new Error(`No code block showing ${code}`)
  return match
}

/**
 * Serve the scripts tables for one script type.
 * @param scriptType - The script type record.
 * @param extraTables - Other table responses by name.
 */
function mockScripts(scriptType: QRecord = singleFileType, extraTables: Record<string, QRecord[]> = {}) {
  getRecordMock.mockImplementation(async (table: string) => (table === 'scriptType' ? scriptType : script))
  queryRecordsMock.mockImplementation(async (table: string, request: QueryRecordsRequest) => {
    if (table === 'scriptRevision') return { records: revisions }
    if (extraTables[table]) return { records: extraTables[table] }
    const revisionId = request.filter.criteria?.[0]?.values[0] as number
    return { records: files[revisionId] ?? [] }
  })
}

describe('ScriptViewerWidget', () => {
  beforeEach(() => {
    getRecordMock.mockReset()
    queryRecordsMock.mockReset()
    metaState.processes = {}
    metaState.tables = {}
  })

  it('selects the current revision by default and shows its highlighted file', async () => {
    mockScripts()
    const { container } = renderWidget()

    const code = await waitFor(() => codeElement("return 'owned one';"))
    expect(code.querySelector('.qqq-code-keyword')).toHaveTextContent('return')
    expect(code.querySelector('.qqq-code-string')).toHaveTextContent("'owned one'")
    expect(getRecordMock).toHaveBeenCalledWith('script', '1')
    expect(getRecordMock).toHaveBeenCalledWith('scriptType', 1)
    expect(queryRecordsMock).toHaveBeenCalledWith('scriptRevision', expect.objectContaining({
      filter: expect.objectContaining({
        criteria: [{ fieldName: 'scriptId', operator: 'EQUALS', values: ['1'] }],
        orderBys: [{ fieldName: 'sequenceNo', isAscending: false }],
      }),
    }))
    const current = container.querySelector('[data-qqq-id="script-revision-1"]') as HTMLElement
    expect(current).toHaveAttribute('aria-pressed', 'true')
    expect(current).toHaveTextContent('Version 1')
    expect(current).toHaveTextContent('CURRENT')
    expect(current).toHaveTextContent('Owned first revision')
    expect(container.querySelector('[data-qqq-id="script-revision-2"]')).not.toHaveTextContent('CURRENT')
    expect(screen.getByText('Script.js', { selector: 'figcaption' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Code', 'Logs', 'Docs'])
  })

  it('shows each revision\'s API name and version when it has one', async () => {
    mockScripts()
    const { container } = renderWidget()
    await waitFor(() => codeElement("return 'owned one';"))
    expect(container.querySelector('[data-qqq-id="script-version-api-2"]')).toHaveTextContent('API: Sample API version 2026.Q1')
    expect(container.querySelector('[data-qqq-id="script-version-api-1"]')).toBeNull()
  })

  it('switches to another revision', async () => {
    mockScripts()
    renderWidget()
    await userEvent.click(await screen.findByRole('button', { name: /Version 2/ }))
    await waitFor(() => codeElement("return 'owned two';"))
    expect(() => codeElement("return 'owned one';")).toThrow()
  })

  it('falls back to the newest revision when none is current', async () => {
    getRecordMock.mockImplementation(async (table: string) => (table === 'scriptType' ? singleFileType : { tableName: 'script', values: { id: 1, name: 'Owned script', scriptTypeId: 1 } }))
    queryRecordsMock.mockImplementation(async (table: string, request: QueryRecordsRequest) => {
      if (table === 'scriptRevision') return { records: revisions }
      return { records: files[request.filter.criteria?.[0]?.values[0] as number] ?? [] }
    })
    const { container } = renderWidget()
    await waitFor(() => codeElement("return 'owned two';"))
    expect(container.querySelector('[data-qqq-id="script-revision-2"]')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('CURRENT')).not.toBeInTheDocument()
  })

  it('offers a per-file select in the script type\'s schema order, coloring each file by its type', async () => {
    const user = userEvent.setup()
    const multiType: QRecord = { tableName: 'scriptType', values: { id: 1, name: 'Multi', fileMode: 2 } }
    mockScripts(multiType, {
      scriptTypeFileSchema: [
        { tableName: 'scriptTypeFileSchema', values: { id: 1, name: 'template.vm', fileType: 'velocity' } },
        { tableName: 'scriptTypeFileSchema', values: { id: 2, name: 'data.json', fileType: 'json' } },
      ],
      scriptRevisionFile: [
        { tableName: 'scriptRevisionFile', values: { id: 5, fileName: 'data.json', contents: '{"a": 1}' } },
        { tableName: 'scriptRevisionFile', values: { id: 6, fileName: 'template.vm', contents: '#if($a)yes#end' } },
      ],
    })
    renderWidget()

    const select = await screen.findByLabelText('File')
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual(['template.vm', 'data.json'])
    const template = await waitFor(() => codeElement('#if($a)yes#end'))
    expect(template).toHaveAttribute('data-language', 'velocity')
    expect(template.querySelector('.qqq-code-directive')).toHaveTextContent('#if')
    await user.selectOptions(select, 'data.json')
    const json = codeElement('{"a": 1}')
    expect(json).toHaveAttribute('data-language', 'json')
    expect(json.querySelector('.qqq-code-property')).toHaveTextContent('"a"')
  })

  it('shows the script type docs and the logs with a View All link to the script log table', async () => {
    const user = userEvent.setup()
    metaState.tables = { scriptLog: { name: 'scriptLog' } }
    mockScripts(singleFileType, {
      scriptLog: [{ tableName: 'scriptLog', values: { id: 7, scriptRevisionId: 1, startTimestamp: '2026-03-03T08:00:00Z', runTimeMillis: 42, hadError: false, input: '{}', output: 'ok' } }],
      scriptLogLine: [{ tableName: 'scriptLogLine', values: { id: 1, scriptLogId: 7, text: 'Owned line' } }],
    })
    const { container } = renderWidget()
    await waitFor(() => codeElement("return 'owned one';"))

    await user.click(screen.getByRole('tab', { name: 'Docs' }))
    expect(container.querySelector('[data-qqq-id="script-docs-help-scriptViewer"]')).toHaveTextContent('Owned help')
    expect(container.querySelector('[data-qqq-id="script-docs-example-scriptViewer"]')).toHaveTextContent("return 'sample';")

    await user.click(screen.getByRole('tab', { name: 'Logs' }))
    const viewAll = await screen.findByRole('link', { name: 'View All' })
    const href = new URL(viewAll.getAttribute('href')!, 'http://localhost')
    expect(href.pathname).toBe('/app/scriptLog')
    expect(JSON.parse(href.searchParams.get('filter')!)).toEqual({
      criteria: [{ fieldName: 'scriptRevisionId', operator: 'EQUALS', values: [1] }],
      booleanOperator: 'AND',
    })
    const row = await waitFor(() => {
      const element = container.querySelector('[data-qqq-id="script-log-7"]')
      if (!element) throw new Error('no log row')
      return element
    })
    expect(row).toHaveTextContent('Owned line')
    expect(queryRecordsMock).toHaveBeenCalledWith('scriptLogLine', expect.objectContaining({
      filter: expect.objectContaining({ criteria: [{ fieldName: 'scriptLogId', operator: 'IN', values: [7] }] }),
    }))
  })

  it('offers Edit only with the storeScriptRevision process, and Test only with testScript', async () => {
    metaState.processes = { storeScriptRevision: {}, testScript: {} }
    mockScripts()
    const { container } = renderWidget()
    await waitFor(() => codeElement("return 'owned one';"))
    expect(container.querySelector('[data-qqq-id="button-edit-script-scriptViewer"]')).toHaveTextContent('Edit')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Code', 'Logs', 'Test', 'Docs'])
  })

  it('shows the empty message when the script has no revisions', async () => {
    getRecordMock.mockImplementation(async (table: string) => (table === 'scriptType' ? singleFileType : script))
    queryRecordsMock.mockResolvedValue({ records: [] })
    renderWidget()
    expect(await screen.findByText('There are not any versions of this script.')).toBeInTheDocument()
  })

  it('treats a missing script as a contained not-found state', async () => {
    const error = new AxiosError('Not Found')
    error.response = { status: 404, statusText: 'Not Found', data: {}, headers: {}, config: {} as never }
    getRecordMock.mockRejectedValue(error)
    renderWidget()
    expect(await screen.findByRole('alert')).toHaveTextContent('Script could not be found.')
    expect(queryRecordsMock).not.toHaveBeenCalled()
  })
})
