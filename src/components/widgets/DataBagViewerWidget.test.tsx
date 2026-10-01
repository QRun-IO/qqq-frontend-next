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

const metaState = vi.hoisted(() => ({ processes: {} as Record<string, unknown> }))
vi.mock('@/lib/hooks/use-metadata', () => ({
  useMetaData: () => ({ data: { processes: metaState.processes, tables: {}, apps: {} } }),
}))

vi.mock('@/lib/api/developer', () => ({
  storeDataBagVersion: vi.fn(),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
}))

import { within } from '@testing-library/react'
import type { QRecord, QWidgetMetaData } from '@/types'
import { storeDataBagVersion } from '@/lib/api/developer'
import { getRecord, queryRecords } from '@/lib/api/tables'
import { toast } from '@/lib/hooks/use-toast'
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
    vi.mocked(storeDataBagVersion).mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
    metaState.processes = {}
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
    expect(screen.getByRole('heading', { name: 'Owned data bag — Version 2 (Current)' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Raw Data', 'Data Preview'])
    // without the storeDataBagVersion process the session is offered no editing
    expect(container.querySelector('[data-qqq-id="button-edit-data-bag-accDataBagViewer"]')).toBeNull()
  })

  it('shows the selected version as an expandable JSON tree on the Data Preview tab', async () => {
    const user = userEvent.setup()
    getRecordMock.mockResolvedValue(bag)
    queryRecordsMock.mockResolvedValue({ records: [{ ...versions[0], values: { ...versions[0].values, data: '{"owned":"second","nested":{"deep":[1,null]}}' } }] })
    const { container } = renderWidget()

    await screen.findByText('Owned second version')
    await user.click(screen.getByRole('tab', { name: 'Data Preview' }))
    expect(screen.getByRole('tab', { name: 'Data Preview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Data Preview (Version 2)' })).toBeInTheDocument()
    expect(container.querySelector('[data-qqq-id="json-preview-value-accDataBagViewer-owned"]')).toHaveTextContent('owned: second')
    const nested = screen.getByRole('button', { name: 'nested:' })
    expect(nested).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('[data-qqq-id="json-preview-toggle-accDataBagViewer-nested.deep"]')).toBeNull()
    nested.focus()
    await user.keyboard('{Enter}')
    expect(nested).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'deep:' }))
    expect(container.querySelector('[data-qqq-id="json-preview-value-accDataBagViewer-nested.deep.0"]')).toHaveTextContent('0: 1')
    expect(container.querySelector('[data-qqq-id="json-preview-value-accDataBagViewer-nested.deep.1"]')).toHaveTextContent('1: null')
    await user.click(nested)
    expect(container.querySelector('[data-qqq-id="json-preview-value-accDataBagViewer-nested.deep.0"]')).toBeNull()
  })

  it('edits the current version: invalid JSON is blocked, a valid edit is stored as a new version', async () => {
    const user = userEvent.setup()
    metaState.processes = { storeDataBagVersion: { name: 'storeDataBagVersion' } }
    getRecordMock.mockResolvedValue(bag)
    queryRecordsMock.mockResolvedValue({ records: versions })
    vi.mocked(storeDataBagVersion).mockResolvedValue({ dataBagVersionId: 3 })
    renderWidget()

    const edit = await screen.findByRole('button', { name: 'Edit' })
    expect(edit).toHaveAttribute('title', 'If you make any changes to this data bag, a new version will be created when you hit Save.')
    await user.click(edit)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Editing Contents of Data Bag: Owned data bag' })).toBeInTheDocument()
    const editor = within(dialog).getByLabelText('Data bag contents')
    expect(editor).toHaveValue('{"owned":"second","count":2}')

    await user.clear(editor)
    await user.type(editor, '{{"broken"')
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }))
    expect(within(dialog).getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByText(/^Error parsing JSON:/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByText(/^Cannot save Data Bag Contents\. Invalid json: /)).toHaveAttribute('role', 'alert')
    expect(storeDataBagVersion).not.toHaveBeenCalled()

    await user.clear(editor)
    await user.type(editor, '{{"owned":"third"}')
    expect(within(dialog).getByText('third')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Commit Message'), 'Third version')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(storeDataBagVersion).toHaveBeenCalledWith({ dataBagId: '1', data: '{"owned":"third"}', commitMessage: 'Third version' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith('Saved New Data Bag Version')
  })

  it('keeps the editor open with the error when storing fails, and never closes on Escape', async () => {
    const user = userEvent.setup()
    metaState.processes = { storeDataBagVersion: { name: 'storeDataBagVersion' } }
    getRecordMock.mockResolvedValue(bag)
    queryRecordsMock.mockResolvedValue({ records: versions })
    vi.mocked(storeDataBagVersion).mockRejectedValue(new Error('You do not have permission to run this process.'))
    renderWidget()

    await user.click(await screen.findByRole('button', { name: /Version 1/ }))
    const edit = screen.getByRole('button', { name: 'Edit and Activate' })
    await user.click(edit)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Data bag contents')).toHaveValue('{"owned":"first"}')
    await user.keyboard('{Escape}')
    expect(dialog).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('You do not have permission to run this process.')
    expect(toast.error).toHaveBeenCalledWith('You do not have permission to run this process.')
    expect(storeDataBagVersion).toHaveBeenCalledWith({ dataBagId: '1', data: '{"owned":"first"}', commitMessage: '' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
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
    expect(screen.queryByRole('button', { name: 'Create New Version' })).not.toBeInTheDocument()
  })

  it('initializes the contents of a data bag without versions with Create New Version', async () => {
    const user = userEvent.setup()
    metaState.processes = { storeDataBagVersion: { name: 'storeDataBagVersion' } }
    getRecordMock.mockResolvedValue({ tableName: 'dataBag', values: { id: 2, name: 'Owned empty data bag' } })
    queryRecordsMock.mockResolvedValue({ records: [] })
    vi.mocked(storeDataBagVersion).mockResolvedValue({})
    renderWidget({ type: 'dataBagViewer', queryParams: { id: '2' } })

    await user.click(await screen.findByRole('button', { name: 'Create New Version' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Initializing Contents of Data Bag: Owned empty data bag' })).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Data bag contents'), '[[1]')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(storeDataBagVersion).toHaveBeenCalledWith({ dataBagId: '2', data: '[1]', commitMessage: '' })
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
