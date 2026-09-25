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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api/widgets', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api/widgets')>()
  return { ...original, fetchWidgetData: vi.fn() }
})

import type { QWidgetMetaData, WidgetData } from '@/types'
import { fetchWidgetData, WidgetRequestError } from '@/lib/api/widgets'
import { ConnectedWidget } from './ConnectedWidget'

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

  it('renders payload dropdowns, sends selections under their parameter names and persists them', async () => {
    const user = userEvent.setup()
    renderWidget()
    expect(await screen.findByText('Please select a Choice and Day')).toBeInTheDocument()
    const choice = screen.getByLabelText('Select Choice')
    expect(Array.from((choice as HTMLSelectElement).options).map((option) => option.textContent)).toEqual(['Select Choice', 'Alpha', 'Beta'])
    await user.selectOptions(choice, 'beta')
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accChoice: 'beta' }))
    expect(JSON.parse(localStorage.getItem('qqq.widgets.dropdownData.accControls.accChoice')!)).toEqual({ id: 'beta', label: 'Beta' })
    const day = screen.getByLabelText('Select Day')
    expect(day).toHaveAttribute('type', 'date')
    await user.type(day, '2026-09-24')
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accChoice: 'beta', accDate: '2026-09-24' }))
    expect(await screen.findByText('choice=beta; day=2026-09-24')).toBeInTheDocument()
  })

  it('starts from stored selections and drops a stored option the payload no longer offers', async () => {
    localStorage.setItem('qqq.widgets.dropdownData.accControls.accDate', JSON.stringify({ id: '2026-01-15' }))
    localStorage.setItem('qqq.widgets.dropdownData.accControls.accChoice', JSON.stringify({ id: 'removed' }))
    renderWidget()
    expect(fetchMock).toHaveBeenCalledWith('accControls', { accChoice: 'removed', accDate: '2026-01-15' })
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('accControls', { accDate: '2026-01-15' }))
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
