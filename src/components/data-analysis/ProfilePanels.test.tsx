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

import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/api/data-analysis'
import {
  capabilities,
  column,
  distinctPage,
  duplicatesResult,
  exactColumn,
  numericColumn,
  table,
} from '../../../tests/fixtures/data-analysis'
import ColumnProfilePanel from './ColumnProfilePanel'
import TableProfilePanel from './TableProfilePanel'

vi.mock('@/lib/api/data-analysis')
vi.mock('next/dynamic', () => ({ default: () => () => <div>Chart placeholder</div> }))

const props = {
  tableName: 'person',
  tableLabel: 'People',
  fieldName: 'status',
  fieldLabel: 'Status',
  filter: { criteria: [], booleanOperator: 'AND' as const },
  onClose: vi.fn(),
}
const clients: QueryClient[] = []
function mount(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

beforeEach(() => {
  // Radix and recharts observe sizes; jsdom has no ResizeObserver.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  vi.clearAllMocks()
  vi.mocked(api.columnProfile).mockResolvedValue(column)
  vi.mocked(api.tableProfile).mockResolvedValue(table)
  vi.mocked(api.distinctValues).mockImplementation(async (_, request) => ({
    ...distinctPage,
    page: request.page,
    hasMore: request.page === 0,
    values: request.page === 0 ? distinctPage.values : [column.topValues[1]],
  }))
  vi.mocked(api.duplicates).mockResolvedValue(duplicatesResult)
  vi.mocked(api.startRun).mockResolvedValue({ runId: 'run-1', status: 'RUNNING' })
  vi.mocked(api.getRun).mockResolvedValue({ runId: 'run-1', status: 'RUNNING' })
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.useRealTimers()
})

describe('column profile', () => {
  it('renders metrics, suppression, estimate, top-value drills and passes axe', async () => {
    mount(<ColumnProfilePanel {...props} />)
    expect(await screen.findByText('1,000')).toBeVisible()
    expect(screen.getByText('Estimate')).toBeVisible()
    expect(screen.getByText('Hidden')).not.toHaveAttribute('href')
    fireEvent.focus(screen.getByText('Hidden'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('fewer than 5 records')
    expect(screen.getByRole('link', { name: 'Active 800' })).toHaveAttribute(
      'href',
      expect.stringContaining('?filter=')
    )
    expect(screen.getByText('People · All records')).toBeVisible()
    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations()
  })
  it('never exposes a suppressed value or stale drill', async () => {
    vi.mocked(api.columnProfile).mockResolvedValue({
      ...column,
      counts: [
        {
          key: 'private',
          label: 'Private',
          value: 999999,
          formatted: 'Private secret',
          suppressed: true,
          drill: column.counts[0].drill,
        },
      ],
    })
    mount(<ColumnProfilePanel {...props} />)
    expect(await screen.findByText('Hidden')).toBeVisible()
    expect(screen.queryByText('Private secret')).not.toBeInTheDocument()
  })
  it('pages fifty values, searches from page zero, and offers previous', async () => {
    mount(<ColumnProfilePanel {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show all values' }))
    const list = screen.getByRole('region', { name: 'All distinct values' })
    await within(list).findByRole('link', { name: 'Active 800' })
    expect(api.distinctValues).toHaveBeenLastCalledWith(
      'person',
      expect.objectContaining({ page: 0, pageSize: 50, search: '' })
    )
    fireEvent.click(within(list).getByRole('button', { name: 'Next' }))
    await within(list).findByRole('link', { name: 'Inactive 198' })
    expect(within(list).getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.click(within(list).getByRole('button', { name: 'Previous' }))
    await within(list).findByText('Page 1')
    fireEvent.change(within(list).getByRole('searchbox'), { target: { value: 'act' } })
    await waitFor(() =>
      expect(api.distinctValues).toHaveBeenLastCalledWith(
        'person',
        expect.objectContaining({ page: 0, pageSize: 50, search: 'act' })
      )
    )
  })
  it('polls every 1.5 seconds, swaps in the exact result, and stops after COMPLETE', async () => {
    mount(<ColumnProfilePanel {...props} />)
    await screen.findByText('1,000')
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Run exact' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(api.startRun).toHaveBeenCalledWith({
      operation: 'COLUMN_PROFILE',
      tableName: 'person',
      request: { fieldName: 'status', filter: { criteria: [], booleanOperator: 'AND' } },
    })
    expect(screen.getByRole('button', { name: 'Run exact' })).toBeDisabled()
    const count = vi.mocked(api.getRun).mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400)
    })
    expect(api.getRun).toHaveBeenCalledTimes(count)
    vi.mocked(api.getRun).mockResolvedValue({ status: 'COMPLETE', columnProfile: exactColumn })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(110)
    })
    expect(screen.getByText('12,500')).toBeVisible()
    expect(screen.queryByText('Estimate')).not.toBeInTheDocument()
    const finished = vi.mocked(api.getRun).mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(api.getRun).toHaveBeenCalledTimes(finished)
  })
  it('stops on FAILED and on unmount', async () => {
    vi.mocked(api.getRun).mockResolvedValue({ status: 'FAILED', error: 'Analysis timed out' })
    const view = mount(<ColumnProfilePanel {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Run exact' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Analysis timed out')
    vi.useFakeTimers()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(api.getRun).toHaveBeenCalledTimes(1)
    view.unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(api.getRun).toHaveBeenCalledTimes(1)
  })
  it('renders numeric percentiles and empty, permission and loading states', async () => {
    vi.mocked(api.columnProfile).mockResolvedValue(numericColumn)
    const view = mount(<ColumnProfilePanel {...props} />)
    await screen.findByText('25th percentile')
    view.unmount()
    vi.mocked(api.columnProfile).mockResolvedValue(null)
    const empty = mount(<ColumnProfilePanel {...props} />)
    await screen.findByText('No profile data is available.')
    empty.unmount()
    vi.mocked(api.columnProfile).mockRejectedValue({ status: 403 })
    const denied = mount(<ColumnProfilePanel {...props} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You don't have permission to analyze this table"
    )
    denied.unmount()
    vi.mocked(api.columnProfile).mockReturnValue(new Promise(() => {}))
    mount(<ColumnProfilePanel {...props} />)
    expect(screen.getByRole('status', { name: 'Loading analysis' })).toBeVisible()
  })
  it('fails closed for unsupported scope and summarizes nested filters', async () => {
    mount(
      <ColumnProfilePanel
        {...props}
        unavailableReason="Analysis is not available for table variants in this API version."
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('table variants')
    expect(api.columnProfile).not.toHaveBeenCalled()
  })
})

it('renders table completeness, keys and selected duplicate drills, with no axe violations', async () => {
  mount(<TableProfilePanel {...props} fields={capabilities.fields} />)
  await screen.findByRole('table', { name: 'Field completeness' })
  expect(screen.getByText('Candidate key')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Find duplicates' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Status' }))
  fireEvent.click(screen.getByRole('button', { name: 'Find duplicates' }))
  await screen.findByRole('link', { name: 'Active 800' })
  expect(api.duplicates).toHaveBeenCalledWith('person', {
    filter: { criteria: [], booleanOperator: 'AND' },
    fields: ['status'],
    limit: 50,
  })
  expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations()
})
