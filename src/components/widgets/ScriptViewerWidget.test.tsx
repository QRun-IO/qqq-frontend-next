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

import type { QRecord, QWidgetMetaData } from '@/types'
import type { QueryRecordsRequest } from '@/lib/api/tables'
import { getRecord, queryRecords } from '@/lib/api/tables'
import { ScriptViewerWidget } from './ScriptViewerWidget'

const getRecordMock = vi.mocked(getRecord)
const queryRecordsMock = vi.mocked(queryRecords)

const meta: QWidgetMetaData = { name: 'scriptViewer', label: 'Script Viewer', type: 'scriptViewer', hasPermission: true }
const payload = { type: 'scriptViewer', queryParams: { id: '1' } }

const script: QRecord = { tableName: 'script', values: { id: 1, name: 'Owned script', scriptTypeId: 1, currentScriptRevisionId: 1 } }
const revisions: QRecord[] = [
  { tableName: 'scriptRevision', values: { id: 2, scriptId: 1, sequenceNo: 2, commitMessage: 'Owned second revision', author: 'Owned author', createDate: '2026-09-25T01:27:36Z' } },
  { tableName: 'scriptRevision', values: { id: 1, scriptId: 1, sequenceNo: 1, commitMessage: 'Owned first revision', author: 'Owned author', createDate: '2026-09-24T01:27:36Z' } },
]
const files: Record<number, QRecord[]> = {
  1: [{ tableName: 'scriptRevisionFile', values: { id: 1, scriptRevisionId: 1, fileName: 'Script.js', contents: "return 'owned one';" } }],
  2: [{ tableName: 'scriptRevisionFile', values: { id: 2, scriptRevisionId: 2, fileName: 'Script.js', contents: "return 'owned two';" } }],
}

function renderWidget(data: unknown = payload) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ScriptViewerWidget widgetMetaData={meta} data={data as typeof payload} />
    </QueryClientProvider>,
  )
}

function mockQueries() {
  queryRecordsMock.mockImplementation(async (table: string, request: QueryRecordsRequest) => {
    if (table === 'scriptRevision') return { records: revisions }
    const revisionId = request.filter.criteria?.[0]?.values[0] as number
    return { records: files[revisionId] ?? [] }
  })
}

describe('ScriptViewerWidget', () => {
  beforeEach(() => {
    getRecordMock.mockReset()
    queryRecordsMock.mockReset()
  })

  it('selects the current revision by default and shows its files', async () => {
    getRecordMock.mockResolvedValue(script)
    mockQueries()
    const { container } = renderWidget()

    expect(await screen.findByText("return 'owned one';")).toBeInTheDocument()
    expect(getRecordMock).toHaveBeenCalledWith('script', '1')
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
    expect(screen.getByText('Script.js')).toBeInTheDocument()
  })

  it('switches to another revision', async () => {
    getRecordMock.mockResolvedValue(script)
    mockQueries()
    renderWidget()
    await userEvent.click(await screen.findByRole('button', { name: /Version 2/ }))
    expect(await screen.findByText("return 'owned two';")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("return 'owned one';")).not.toBeInTheDocument())
  })

  it('falls back to the newest revision when none is current', async () => {
    getRecordMock.mockResolvedValue({ tableName: 'script', values: { id: 1, name: 'Owned script' } })
    mockQueries()
    const { container } = renderWidget()
    expect(await screen.findByText("return 'owned two';")).toBeInTheDocument()
    expect(container.querySelector('[data-qqq-id="script-revision-2"]')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('CURRENT')).not.toBeInTheDocument()
  })

  it('shows the empty message when the script has no revisions', async () => {
    getRecordMock.mockResolvedValue(script)
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
