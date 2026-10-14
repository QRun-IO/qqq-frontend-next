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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pivot } from '@/lib/api/data-analysis'
import { encodePivot } from '@/lib/utils/data-analysis-pivot'
import { pivotCapabilities, pivotRequest, pivotResult } from '../../../tests/fixtures/data-analysis'
import PivotExplorer from './PivotExplorer'
import PivotResult from './PivotResult'
import { AnalysisDrillContext } from './ProfileParts'

vi.mock('@/lib/api/data-analysis', () => ({ pivot: vi.fn() }))
vi.mock('next/dynamic', () => ({
  default:
    () =>
    ({ kind }: { kind: string }) => <div data-testid="pivot-chart">{kind}</div>,
}))
const clients: QueryClient[] = []
const props = {
  tableName: 'person',
  tableLabel: 'People',
  fields: pivotCapabilities.fields,
  filter: { criteria: [], booleanOperator: 'AND' as const },
  encoded: null,
  onRun: vi.fn(),
  onBack: vi.fn(),
}
function mount(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(pivot).mockResolvedValue(pivotResult)
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((c) => c.clear())
  vi.unstubAllGlobals()
})

it('builds status by month with Count and Average, with accessible controls', async () => {
  const { container } = mount(<PivotExplorer {...props} />)
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Rows 1 field'), { target: { value: 'status' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add column' }))
  fireEvent.change(screen.getByLabelText('Columns 1 field'), { target: { value: 'createdAt' } })
  fireEvent.change(screen.getByLabelText('Columns 1 bucket'), { target: { value: 'MONTH' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add value' }))
  fireEvent.change(screen.getByLabelText('Value 2 operator'), { target: { value: 'AVG' } })
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Value 2 field'), { target: { value: 'amount' } })
  fireEvent.click(screen.getByRole('button', { name: 'Run' }))
  expect(props.onRun).toHaveBeenCalledWith(pivotRequest)
  expect((await axe(container)).violations).toEqual([])
  fireEvent.click(screen.getByLabelText('Remove value 2'))
  fireEvent.click(screen.getByLabelText('Remove value 1'))
  expect(screen.getByText('Choose at least 1 value.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
})

it('restores a URL, renders headers, totals, Other, Hidden, sparse cells, warnings and drills', async () => {
  const apply = vi.fn(() => true)
  const { container } = mount(
    <AnalysisDrillContext.Provider value={apply}>
      <PivotExplorer {...props} encoded={encodePivot(pivotRequest)} />
    </AnalysisDrillContext.Provider>
  )
  const table = await screen.findByRole('table', { name: 'Pivot results' })
  expect(pivot).toHaveBeenCalledWith('person', { ...pivotRequest, filter: props.filter })
  for (const text of [
    'Status',
    'January 2026',
    'February 2026',
    'Other (3 groups)',
    'Count',
    'Average Amount',
    'Total',
  ])
    expect(within(table).getAllByText(text).length).toBeGreaterThan(0)
  expect(within(table).getAllByText('Hidden').length).toBeGreaterThan(0)
  expect(within(table).getAllByText('Fewer than 5 records').length).toBeGreaterThan(0)
  expect(within(table).getAllByText('—')).toHaveLength(2)
  expect(screen.getByRole('note')).toHaveTextContent('Small groups')
  fireEvent.click(within(table).getByRole('link', { name: '6' }))
  expect(apply).toHaveBeenCalledWith(pivotResult.cells[0].values[0].drill)
  fireEvent.click(screen.getByRole('button', { name: 'Chart' }))
  expect(screen.getByTestId('pivot-chart')).toHaveTextContent('BAR')
  expect((await axe(container)).violations).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Back to records' }))
  expect(props.onBack).toHaveBeenCalled()
})

it('renders nested column headers and explains unsupported charts', async () => {
  vi.mocked(pivot).mockResolvedValue({
    ...pivotResult,
    columnHeaders: [
      [{ label: '2026' }, { label: 'January' }],
      [{ label: '2026' }, { label: 'February' }],
    ],
  })
  mount(
    <PivotExplorer
      {...props}
      encoded={encodePivot({
        ...pivotRequest,
        columns: [
          { field: 'createdAt', dateBucket: 'YEAR' },
          { field: 'createdAt', dateBucket: 'MONTH' },
        ],
      })}
    />
  )
  const header = await screen.findByRole('columnheader', { name: '2026' })
  expect(header).toHaveAttribute('colspan', '4')
  fireEvent.click(screen.getByRole('button', { name: 'Chart' }))
  expect(screen.getByText('Chart not available for this layout')).toBeInTheDocument()
})

it('offers numeric bins, date buckets and joined fields only from capabilities', () => {
  mount(
    <PivotExplorer
      {...props}
      fields={[...props.fields, { name: 'company.name', label: 'Company name', kind: 'TEXT' }]}
    />
  )
  expect(
    within(screen.getByLabelText('Rows 1 field')).getByRole('option', { name: 'Company name' })
  ).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Rows 1 field'), { target: { value: 'amount' } })
  fireEvent.change(screen.getByLabelText('Rows 1 bins'), { target: { value: '10' } })
  fireEvent.change(screen.getByLabelText('Value 1 operator'), { target: { value: 'PERCENTILE' } })
  fireEvent.change(screen.getByLabelText('Value 1 field'), { target: { value: 'amount' } })
  fireEvent.change(screen.getByLabelText('Value 1 p'), { target: { value: '0.9' } })
  fireEvent.click(screen.getByRole('button', { name: 'Run' }))
  expect(props.onRun).toHaveBeenCalledWith({
    rows: [{ field: 'amount', numericBins: { count: 10 } }],
    columns: [],
    values: [{ operator: 'PERCENTILE', field: 'amount', percentile: 0.9 }],
    showTotals: true,
  })
})

it('uses row cards on phones including totals and safe metrics', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  )
  const { container } = render(
    <PivotResult result={pivotResult} rowLabels={['Status']} columnCount={1} showTotals />
  )
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Active' })).toHaveTextContent('January 2026 · Count')
  expect(screen.getByRole('region', { name: 'Totals' })).toHaveTextContent('Grand total')
  expect((await axe(container)).violations).toEqual([])
})

it.each([403, 500])('shows request failures (%s)', async (status) => {
  vi.mocked(pivot).mockRejectedValue({ status })
  mount(<PivotExplorer {...props} encoded={encodePivot(pivotRequest)} />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    status === 403 ? "You don't have permission to analyze this table" : 'Could not load analysis.'
  )
})

it('shows loading, empty and invalid URL states without broadening an invalid filter', async () => {
  vi.mocked(pivot).mockReturnValue(new Promise(() => {}))
  const first = mount(<PivotExplorer {...props} encoded={encodePivot(pivotRequest)} />)
  expect(screen.getByRole('status', { name: 'Loading analysis' })).toBeInTheDocument()
  first.unmount()
  vi.mocked(pivot).mockResolvedValue({ rowHeaders: [] })
  const second = mount(<PivotExplorer {...props} encoded={encodePivot(pivotRequest)} />)
  expect(await screen.findByText('No matching pivot groups.')).toBeInTheDocument()
  second.unmount()
  vi.mocked(pivot).mockClear()
  mount(<PivotExplorer {...props} encoded="invalid!" />)
  expect(screen.getByRole('alert')).toHaveTextContent('pivot URL is invalid')
  expect(pivot).not.toHaveBeenCalled()
})

it('blocks a removed capability field and unsupported filters', async () => {
  const first = mount(
    <PivotExplorer
      {...props}
      encoded={encodePivot({ ...pivotRequest, rows: [{ field: 'secret' }] })}
    />
  )
  expect(screen.getByRole('alert')).toHaveTextContent('no longer available')
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  expect(pivot).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Rows 1 field'), { target: { value: 'status' } })
  expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Run' }))
  expect(props.onRun).toHaveBeenCalledWith(pivotRequest)
  first.unmount()
  mount(
    <PivotExplorer
      {...props}
      filter={{
        criteria: [
          { fieldName: 'status', operator: 'EQUALS', values: ['active'], otherFieldName: 'secret' },
        ],
      }}
      encoded={encodePivot(pivotRequest)}
    />
  )
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('does not yet support'))
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  fireEvent.submit(screen.getByRole('button', { name: 'Run' }).closest('form')!)
  expect(pivot).not.toHaveBeenCalled()
})

it('keeps totals absent when disabled and never links a suppressed payload', () => {
  render(
    <PivotResult
      result={{
        ...pivotResult,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            values: [
              {
                value: 999,
                formatted: '999',
                suppressed: true,
                suppressedReason: 'Private',
                drill: pivotResult.cells[0].values[0].drill,
              },
            ],
          },
        ],
      }}
      rowLabels={['Status']}
      columnCount={1}
      showTotals={false}
    />
  )
  expect(screen.queryByText('Total')).not.toBeInTheDocument()
  expect(screen.queryByText('999')).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByText('Private')).toBeInTheDocument()
})

it('toggles date rows to a time series and can hide it again', async () => {
  mount(
    <PivotExplorer
      {...props}
      encoded={encodePivot({
        ...pivotRequest,
        rows: [{ field: 'createdAt', dateBucket: 'DAY' }],
        columns: [],
      })}
    />
  )
  const toggle = await screen.findByRole('button', { name: 'Chart' })
  fireEvent.click(toggle)
  expect(screen.getByTestId('pivot-chart')).toHaveTextContent('TIME_SERIES')
  fireEvent.click(toggle)
  expect(screen.queryByTestId('pivot-chart')).not.toBeInTheDocument()
})
