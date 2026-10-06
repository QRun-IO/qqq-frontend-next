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

// Tests for ConnectedWidget: payload dropdowns, stored selections, export, reload, errors and permission

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api/widgets', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api/widgets')>()
  return { ...original, fetchWidgetData: vi.fn() }
})

import type { QWidgetMetaData, WidgetData } from '@/types'
import { fetchWidgetData, WidgetRequestError } from '@/lib/api/widgets'
import { ConnectedWidget, SeededWidget } from './ConnectedWidget'
import * as widgetUtils from './widget-utils'

const fetchMock = vi.mocked(fetchWidgetData)

const controls: QWidgetMetaData = {
  name: 'accControls', label: 'Owned Controls', type: 'html', hasPermission: true, storeDropdownSelections: true,
  showExportButton: true, showReloadButton: true, tooltip: 'Owned widget help',
  dropdowns: [{ name: 'c', label: 'Choice', possibleValueSourceName: 'accChoice' }, { name: 'accDate', label: 'Day', type: 'DATE_PICKER' }],
}

/** The payload the backend renderer returns for given params. */
function controlsPayload(params: Record<string, unknown> = {}): WidgetData {
  const needs = [params.accChoice ? null : 'Choice', params.accDate ? null : 'Day'].filter(Boolean)
  return {
    type: 'html',
    html: `choice=${params.accChoice ?? ''}; day=${params.accDate ?? ''}`,
    dropdownNameList: ['accChoice', 'accDate'],
    dropdownLabelList: ['Choice', 'Day'],
    dropdownDataList: [[{ id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' }], []],
    ...(needs.length ? { dropdownNeedsSelectedText: `Please select a ${needs.join(' and ')}` } : {}),
    csvData: [['Label', 'Value'], ['A,"B"', 7]],
  }
}

function renderWidget(meta: QWidgetMetaData = controls, params?: Record<string, string>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ConnectedWidget widgetMetaData={meta} params={params} />
    </QueryClientProvider>
  )
}

describe('ConnectedWidget', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (_name, params) => controlsPayload(params))
  })

  it('hydrates backend date and choice defaults without persisting caller defaults', async () => {
    fetchMock.mockImplementation(async (_name, params) => ({
      ...controlsPayload(params), dropdownDefaultValueList: ['alpha', '2026-01-15'],
    }))
    renderWidget({ ...controls, storeDropdownSelections: false })
    const day = await screen.findByLabelText('Select Day')
    await waitFor(() => expect(day).toHaveValue('2026-01-15'))
    expect(screen.getByLabelText('Select Choice')).toHaveValue('Alpha')
    const sent = new Date(2026, 0, 15).toLocaleDateString()
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accChoice: 'alpha', accDate: sent }))
    expect(await screen.findByText(`choice=alpha; day=${sent}`)).toBeInTheDocument()
    expect(localStorage.length).toBe(0)
  })

  it('uses the configured date wire normalization for a backend default', async () => {
    const normalize = vi.spyOn(widgetUtils, 'normalizeDropdownDate').mockImplementation((value) => value)
    try {
      fetchMock.mockImplementation(async (_name, params) => ({
        ...controlsPayload(params), dropdownDefaultValueList: ['alpha', '2026-01-15'],
      }))
      renderWidget({ ...controls, storeDropdownSelections: false })
      await waitFor(() => expect(screen.getByLabelText('Select Day')).toHaveValue('2026-01-15'))
      await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accChoice: 'alpha', accDate: '2026-01-15' }))
      expect(await screen.findByText('choice=alpha; day=2026-01-15')).toBeInTheDocument()
      expect(localStorage.length).toBe(0)
    } finally {
      normalize.mockRestore()
    }
  })

  it.each([undefined, null, '', 'not-a-date'])('leaves a missing or invalid date default blank (%s)', async (value) => {
    fetchMock.mockImplementation(async (_name, params) => ({
      ...controlsPayload(params), dropdownDefaultValueList: ['alpha', value],
    }))
    renderWidget({ ...controls, storeDropdownSelections: false })
    await waitFor(() => expect(screen.getByLabelText('Select Choice')).toHaveValue('Alpha'))
    expect(screen.getByLabelText('Select Day')).toHaveValue('')
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accChoice: 'alpha' }))
  })

  it('keeps a user date when a late reload supplies a different default', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (_name, params) => ({
      ...controlsPayload(params), dropdownDefaultValueList: ['alpha', '2026-01-15'],
    }))
    renderWidget({ ...controls, storeDropdownSelections: false })
    const day = await screen.findByLabelText('Select Day')
    await waitFor(() => expect(day).toHaveValue('2026-01-15'))
    fireEvent.change(day, { target: { value: '2026-01-20' } })
    const sent = new Date(2026, 0, 20).toLocaleDateString()
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accChoice: 'alpha', accDate: sent }))
    expect(await screen.findByText(`choice=alpha; day=${sent}`)).toBeInTheDocument()
    let finishReload!: (value: WidgetData) => void
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finishReload = resolve }))
    await user.click(screen.getByLabelText('Reload Owned Controls'))
    await waitFor(() => expect(finishReload).toBeDefined())
    finishReload({ ...controlsPayload({ accChoice: 'alpha', accDate: sent }), dropdownDefaultValueList: ['alpha', '2026-01-25'] })
    await waitFor(() => expect(screen.getByLabelText('Reload Owned Controls')).not.toBeDisabled())
    expect(day).toHaveValue('2026-01-20')
  })

  it('preserves an explicit clear when the backend still supplies a date default', async () => {
    fetchMock.mockImplementation(async (_name, params) => ({
      ...controlsPayload(params), dropdownDefaultValueList: ['alpha', '2026-01-15'],
    }))
    renderWidget({ ...controls, storeDropdownSelections: false })
    const day = await screen.findByLabelText('Select Day')
    await waitFor(() => expect(day).toHaveValue('2026-01-15'))
    fireEvent.change(day, { target: { value: '' } })
    await waitFor(() => expect(screen.getByText('Please select a Day')).toBeInTheDocument())
    expect(day).toHaveValue('')
    expect(localStorage.length).toBe(0)
  })

  it('preserves a stored date instead of replacing it with a server default', async () => {
    localStorage.setItem('qqq.widgets.dropdownData.accControls.accDate', JSON.stringify({ id: '2026-01-10' }))
    fetchMock.mockImplementation(async (_name, params) => ({
      ...controlsPayload(params), dropdownDefaultValueList: ['alpha', '2026-01-15'],
    }))
    renderWidget()
    await waitFor(() => expect(screen.getByLabelText('Select Choice')).toHaveValue('Alpha'))
    expect(screen.getByLabelText('Select Day')).toHaveValue('2026-01-10')
    expect(JSON.parse(localStorage.getItem('qqq.widgets.dropdownData.accControls.accDate')!)).toEqual({ id: '2026-01-10' })
    expect(localStorage.getItem('qqq.widgets.dropdownData.accControls.accChoice')).toBeNull()
  })

  it('does not carry one caller default into a fresh caller widget without saved dates', async () => {
    fetchMock.mockImplementation(async (_name, params) => ({
      ...controlsPayload(params), dropdownDefaultValueList: ['alpha', '2026-01-15'],
    }))
    const first = renderWidget({ ...controls, storeDropdownSelections: false })
    await waitFor(() => expect(screen.getByLabelText('Select Day')).toHaveValue('2026-01-15'))
    first.unmount()
    fetchMock.mockImplementation(async (_name, params) => controlsPayload(params))
    renderWidget({ ...controls, storeDropdownSelections: false })
    expect(await screen.findByText('Please select a Choice and Day')).toBeInTheDocument()
    expect(screen.getByLabelText('Select Day')).toHaveValue('')
    expect(localStorage.length).toBe(0)
  })

  it('renders payload dropdowns, sends selections under their parameter names and persists them', async () => {
    const user = userEvent.setup()
    renderWidget()
    expect(await screen.findByText('Please select a Choice and Day')).toBeInTheDocument()
    const choice = screen.getByRole('combobox', { name: 'Select Choice' })
    expect(choice).toHaveAttribute('placeholder', 'Select Choice')
    await user.click(choice)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Alpha', 'Beta'])
    await user.click(screen.getByRole('option', { name: 'Beta' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accChoice: 'beta' }))
    expect(choice).toHaveValue('Beta')
    expect(JSON.parse(localStorage.getItem('qqq.widgets.dropdownData.accControls.accChoice')!)).toEqual({ id: 'beta', label: 'Beta' })
    const day = screen.getByLabelText('Select Day')
    expect(day).toHaveAttribute('type', 'date')
    await user.type(day, '2026-09-24')
    // Material sends the day's toLocaleDateString()
    const sent = new Date(2026, 8, 24).toLocaleDateString()
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accChoice: 'beta', accDate: sent }))
    expect(await screen.findByText(`choice=beta; day=${sent}`)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('qqq.widgets.dropdownData.accControls.accDate')!)).toEqual({ id: sent, label: sent })
  })

  it('starts from stored selections and drops a stored option the payload no longer offers', async () => {
    localStorage.setItem('qqq.widgets.dropdownData.accControls.accDate', JSON.stringify({ id: '2026-01-15' }))
    localStorage.setItem('qqq.widgets.dropdownData.accControls.accChoice', JSON.stringify({ id: 'removed' }))
    renderWidget()
    const day = new Date(2026, 0, 15).toLocaleDateString()
    expect(fetchMock).toHaveBeenCalledWith('accControls', { accChoice: 'removed', accDate: day })
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accDate: day }))
    expect(screen.getByLabelText('Select Choice')).toHaveValue('')
    expect(screen.getByLabelText('Select Day')).toHaveValue('2026-01-15')
    expect(localStorage.getItem('qqq.widgets.dropdownData.accControls.accChoice')).toBeNull()
  })

  it('exports csvData, and reports when there is nothing to export', async () => {
    const user = userEvent.setup()
    const create = vi.fn(() => 'blob:owned')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fetchMock.mockImplementation(async () => ({ type: 'html', html: 'export ready', csvData: [['Label', 'Value'], ['A,"B"', 7]] }))
    renderWidget({ ...controls, dropdowns: [], storeDropdownSelections: false })
    await screen.findByText('export ready')
    await user.click(screen.getByRole('button', { name: 'Export Owned Controls' }))
    expect(click).toHaveBeenCalledTimes(1)
    const blob = (create.mock.calls[0] as unknown as [Blob])[0]
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(blob)
    })
    expect(text).toBe('"Label","Value"\n"A,""B""",7\n')
    fetchMock.mockImplementation(async () => ({ type: 'html', html: 'nothing' }))
    await user.click(screen.getByRole('button', { name: 'Reload Owned Controls' }))
    await screen.findByText('nothing')
    await user.click(screen.getByRole('button', { name: 'Export Owned Controls' }))
    expect(screen.getByRole('status')).toHaveTextContent('There is no data available to export.')
    expect(click).toHaveBeenCalledTimes(1)
    click.mockRestore()
  })

  it('exports a table without csvData from its columns and rows, without icon text (Material TableWidget)', async () => {
    const user = userEvent.setup()
    const create = vi.fn(() => 'blob:owned')
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fetchMock.mockImplementation(async () => ({
      type: 'table',
      columns: [{ type: 'html', header: 'Name', accessor: 'name' }, { type: 'default', header: 'Count', accessor: 'count' }],
      rows: [{ name: '<a href="/app/person/1">Darin<span class="material-icons-round MuiIcon-root">open_in_new</span></a>', count: 1234 }],
    }))
    renderWidget({ name: 'accTable', label: 'Owned Table', type: 'table', hasPermission: true, showExportButton: true })
    await screen.findByText('Darin')
    await user.click(screen.getByRole('button', { name: 'Export Owned Table' }))
    const blob = (create.mock.calls[0] as unknown as [Blob])[0]
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(blob)
    })
    expect(text).toBe('"Name","Count"\n"Darin","1234"\n')
    click.mockRestore()
  })

  it('leaves export to each table of a multi-table widget', async () => {
    fetchMock.mockImplementation(async () => ({
      type: 'multiTable',
      tableDataList: [{ label: 'First', columns: [{ header: 'Name', accessor: 'name' }], rows: [{ name: 'One' }] }],
    }))
    renderWidget({ name: 'accMulti', label: 'Owned Multi', type: 'multiTable', hasPermission: true, showExportButton: true })
    await screen.findByText('One')
    expect(screen.queryByRole('button', { name: 'Export Owned Multi' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Export First' })).toBeInTheDocument()
  })

  it.each(['connected', 'seeded'] as const)('keeps one working child-record export in the %s widget', async (mode) => {
    const user = userEvent.setup()
    const data: WidgetData = {
      type: 'childRecordList',
      childFrontendTableMetaData: {
        name: 'child', label: 'Child', primaryKeyField: 'id',
        fields: { id: { name: 'id', label: 'Id', type: 'INTEGER' }, name: { name: 'name', label: 'Name', type: 'STRING' } },
        sections: [{ name: 'identity', tier: 'T1', fieldNames: ['id', 'name'], isHidden: false }],
      },
      queryOutput: { records: [{ tableName: 'child', values: { id: 1, name: 'Child one' } }] },
    }
    const metadata: QWidgetMetaData = { name: 'children', label: 'Owned Children', type: 'childRecordList', hasPermission: true, showExportButton: true }
    const create = vi.fn(() => 'blob:owned')
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    try {
      if (mode === 'connected') {
        fetchMock.mockResolvedValue(data)
        renderWidget(metadata)
      } else {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={client}><SeededWidget widgetMetaData={metadata} data={data} /></QueryClientProvider>)
      }
      await screen.findByText('Child one')
      expect(screen.getAllByRole('button', { name: /^Export/ })).toHaveLength(1)
      const exportButton = screen.getByRole('button', { name: /^Export/ })
      expect(exportButton.closest('[data-qqq-id="widget-content-children"]')).toBeNull()
      await user.click(exportButton)
      expect(click).toHaveBeenCalledTimes(1)
      const blob = (create.mock.calls[0] as unknown as [Blob])[0]
      const csv = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsText(blob)
      })
      expect(csv).toBe('"Id","Name"\n"1","Child one"\n')
      expect(screen.queryByText('There is no data available to export.')).toBeNull()
    } finally {
      click.mockRestore()
    }
  })

  it('contains malformed child metadata and retries with corrected backend data', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const data: WidgetData = {
      type: 'childRecordList',
      childFrontendTableMetaData: { name: 'child', fields: {}, sections: [null] },
      queryOutput: { records: [{ values: { id: 1 } }] },
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    try {
      render(<QueryClientProvider client={client}>
        <p>Unaffected dashboard content</p>
        <SeededWidget widgetMetaData={{ name: 'brokenChild', label: 'Broken Child', type: 'childRecordList', hasPermission: true, showExportButton: true }} data={data} />
      </QueryClientProvider>)
      expect(screen.getByText('Unaffected dashboard content')).toBeInTheDocument()
      expect(screen.getAllByText('Widget failed to render')).toHaveLength(1)
      expect(screen.queryByRole('button', { name: /^Export/ })).toBeNull()
      fetchMock.mockResolvedValue({
        type: 'childRecordList',
        childFrontendTableMetaData: { name: 'child', fields: { name: { name: 'name', label: 'Name', type: 'STRING' } }, sections: [] },
        queryOutput: { records: [{ values: { name: 'Recovered child' } }] },
      })
      await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
      expect(await screen.findByText('Recovered child')).toBeInTheDocument()
      expect(screen.queryByText('Widget failed to render')).toBeNull()
      expect(screen.getAllByRole('button', { name: /^Export/ })).toHaveLength(1)
    } finally {
      error.mockRestore()
    }
  })

  it('shows the backend error message with a retry, without throwing', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValue(new WidgetRequestError('QException (Owned widget renderer failure)', 500))
    renderWidget({ name: 'accError', label: 'Failing Widget', type: 'html', hasPermission: true })
    expect(await screen.findByText('An error occurred loading widget content.')).toBeInTheDocument()
    expect(screen.getByText('QException (Owned widget renderer failure)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('explains the denial and requests nothing without permission', () => {
    renderWidget({ name: 'accDenied', label: 'Denied', type: 'html', hasPermission: false })
    expect(screen.getByRole('status')).toHaveTextContent('You do not have permission to view this data.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders hidden and empty alerts as nothing, and a divider without chrome', async () => {
    fetchMock.mockResolvedValueOnce({ type: 'alert', html: 'x', hideWidget: true })
    const hidden = renderWidget({ name: 'accAlertHidden', label: 'Hidden Alert', type: 'alert', hasPermission: true })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(hidden.container).toBeEmptyDOMElement())
    hidden.unmount()
    fetchMock.mockResolvedValueOnce({ type: 'divider' })
    const divider = renderWidget({ name: 'accDivider', label: 'Owned Divider', type: 'divider', hasPermission: true })
    await waitFor(() => expect(divider.container.querySelector('hr')).not.toBeNull())
    expect(screen.queryByText('Owned Divider')).toBeNull()
  })

  it('passes record context params to the request', async () => {
    fetchMock.mockResolvedValue({ type: 'html', html: 'Host record 1' })
    renderWidget({ name: 'accHostHtml', label: 'Html', type: 'html', hasPermission: true }, { tableName: 'accWidgetHost', id: '1' })
    expect(await screen.findByText('Host record 1')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('accHostHtml', { tableName: 'accWidgetHost', id: '1' })
  })
})
