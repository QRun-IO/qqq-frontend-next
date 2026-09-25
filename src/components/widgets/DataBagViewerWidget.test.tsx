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

// Tests for DataBagViewerWidget

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
import { getRecord, queryRecords } from '@/lib/api/tables'
import { DataBagViewerWidget } from './DataBagViewerWidget'

const getRecordMock = vi.mocked(getRecord)
const queryRecordsMock = vi.mocked(queryRecords)

const meta: QWidgetMetaData = { name: 'accDataBagViewer', label: 'Data Bag Contents', type: 'dataBagViewer', hasPermission: true }
const payload = { type: 'dataBagViewer', queryParams: { id: '1', tableName: 'dataBag' } }

const bag: QRecord = { tableName: 'dataBag', recordLabel: 'Owned data bag', values: { id: 1, name: 'Owned data bag' } }
const versions: QRecord[] = [
  { tableName: 'dataBagVersion', values: { id: 2, dataBagId: 1, sequenceNo: 2, commitMessage: 'Owned second version', author: 'Owned author', data: '{"owned":"second","count":2}', createDate: '2026-02-03T04:05:06Z' } },
  { tableName: 'dataBagVersion', values: { id: 1, dataBagId: 1, sequenceNo: 1, commitMessage: 'Owned first version', author: 'Owned author', data: '{"owned":"first"}', createDate: '2026-01-02T03:04:05Z' } },
]

function renderWidget(data: unknown = payload) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DataBagViewerWidget widgetMetaData={meta} data={data as typeof payload} />
    </QueryClientProvider>,
  )
}

function notFound(): AxiosError {
  const error = new AxiosError('Not Found')
  error.response = { status: 404, statusText: 'Not Found', data: {}, headers: {}, config: {} as never }
  return error
}

describe('DataBagViewerWidget', () => {
  beforeEach(() => {
    getRecordMock.mockReset()
    queryRecordsMock.mockReset()
  })

  it('lists versions newest first, marks the newest current, and shows its pretty-printed contents', async () => {
    getRecordMock.mockResolvedValue(bag)
    queryRecordsMock.mockResolvedValue({ records: versions })
    const { container } = renderWidget()

    expect(await screen.findByText('Owned second version')).toBeInTheDocument()
    expect(getRecordMock).toHaveBeenCalledWith('dataBag', '1')
    expect(queryRecordsMock).toHaveBeenCalledWith('dataBagVersion', {
      filter: {
        criteria: [{ fieldName: 'dataBagId', operator: 'EQUALS', values: ['1'] }],
        orderBys: [{ fieldName: 'sequenceNo', isAscending: false }],
        booleanOperator: 'AND',
        skip: 0,
        limit: 25,
      },
    })
    const newest = container.querySelector('[data-qqq-id="data-bag-version-2"]') as HTMLElement
    expect(newest).toHaveAttribute('aria-pressed', 'true')
    expect(newest).toHaveTextContent('Version 2')
    expect(newest).toHaveTextContent('CURRENT')
    expect(container.querySelector('[data-qqq-id="data-bag-version-1"]')).not.toHaveTextContent('CURRENT')
    expect(container.querySelector('[data-qqq-id="data-bag-contents-accDataBagViewer"]')?.textContent)
      .toBe(JSON.stringify({ owned: 'second', count: 2 }, null, 2))
    expect(screen.getByRole('heading', { name: 'Owned data bag — Version 2' })).toBeInTheDocument()
  })

  it('selects an older version with the keyboard', async () => {
    getRecordMock.mockResolvedValue(bag)
    queryRecordsMock.mockResolvedValue({ records: versions })
    const { container } = renderWidget()
    const older = await screen.findByRole('button', { name: /Version 1/ })
    older.focus()
    await userEvent.keyboard('{Enter}')
    expect(older).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('[data-qqq-id="data-bag-contents-accDataBagViewer"]')?.textContent)
      .toBe(JSON.stringify({ owned: 'first' }, null, 2))
  })

  it('reads the full version when the query omitted heavy contents', async () => {
    getRecordMock.mockImplementation(async (table) => table === 'dataBag' ? bag : { tableName: 'dataBagVersion', values: { id: 2, data: '{"heavy":true}' } })
    queryRecordsMock.mockResolvedValue({ records: [{ tableName: 'dataBagVersion', values: { id: 2, sequenceNo: 2, commitMessage: 'Heavy' } }] })
    const { container } = renderWidget()
    await waitFor(() => expect(container.querySelector('[data-qqq-id="data-bag-contents-accDataBagViewer"]')?.textContent)
      .toBe(JSON.stringify({ heavy: true }, null, 2)))
    expect(getRecordMock).toHaveBeenCalledWith('dataBagVersion', 2)
  })

  it('shows the no-versions message', async () => {
    getRecordMock.mockResolvedValue({ tableName: 'dataBag', values: { id: 2, name: 'Owned empty data bag' } })
    queryRecordsMock.mockResolvedValue({ records: [] })
    renderWidget({ type: 'dataBagViewer', queryParams: { id: '2' } })
    expect(await screen.findByText('There are not any versions of this data bag.')).toBeInTheDocument()
  })

  it('treats a missing data bag as a contained not-found state without querying versions', async () => {
    getRecordMock.mockRejectedValue(notFound())
    renderWidget({ type: 'dataBagViewer', queryParams: { id: '99' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Data bag data could not be found.')
    expect(queryRecordsMock).not.toHaveBeenCalled()
  })

  it('shows a contained error for other failures', async () => {
    getRecordMock.mockResolvedValue(bag)
    queryRecordsMock.mockRejectedValue(new Error('boom'))
    renderWidget()
    expect(await screen.findByRole('alert')).toHaveTextContent('Error loading data bag data.')
  })

  it('explains when no data bag id was given', () => {
    renderWidget({ type: 'dataBagViewer' })
    expect(screen.getByText('No data bag was specified.')).toBeInTheDocument()
    expect(getRecordMock).not.toHaveBeenCalled()
  })
})
