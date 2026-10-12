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

// Date-first filtering in the builder and the quick filters: DATE_TIME fields pick dates and write
// whole-day bounds, DATE fields keep plain dates, presets are relative, and "Include time" gives
// exact date-times.

import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QFieldMetaData, QFilterCriteria, QQueryFilter, QTableMetaData } from '@/types'
import { emptyFilter } from '@/lib/utils/filter-utils'
import { browserTimeZone, startOfDayWire, ymdAdd } from '@/lib/utils/date-range-utils'
import { FilterBuilder, buildRows } from './FilterBuilder'
import { QuickFilterBar } from './QuickFilterBar'
import { buildFilterFields } from './FilterBuilder'

const field = (name: string, label: string, type: QFieldMetaData['type']): QFieldMetaData => ({
  name, label, type, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [],
})

const table: QTableMetaData = {
  name: 'order', label: 'Order', isHidden: false, primaryKeyField: 'id', sections: [], capabilities: [], readPermission: true,
  insertPermission: true, editPermission: true, deletePermission: true, usesVariants: false, variantTableLabel: '',
  fields: { name: field('name', 'Name', 'STRING'), created: field('created', 'Created', 'DATE_TIME'), due: field('due', 'Due', 'DATE') },
  exposedJoins: [],
}

// Radix tooltips measure with ResizeObserver, which jsdom lacks
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

const zone = browserTimeZone()
const dayStart = (ymd: string) => startOfDayWire(ymd, zone)

let latest: QQueryFilter = emptyFilter()

function Harness({ initial }: { initial: QQueryFilter }) {
  const [filter, setFilter] = useState(initial)
  latest = filter
  return (
    <QueryClientProvider client={new QueryClient()}>
      <FilterBuilder tableMetaData={table} filter={filter} onChange={(f) => { latest = f; setFilter(f) }} />
    </QueryClientProvider>
  )
}

const filterOf = (...criteria: QFilterCriteria[]): QQueryFilter => ({ ...emptyFilter(), criteria })

describe('date-first conditions in the filter builder', () => {
  it('a DATE_TIME field starts on dates, with no time inputs and an unobtrusive Include time switch', () => {
    render(<Harness initial={filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] })} />)
    expect(screen.getByLabelText('Filter operator')).toHaveValue('on')
    expect(screen.getByLabelText('Filter value for Created')).toHaveAttribute('type', 'date')
    expect(screen.queryByDisplayValue(/T\d\d:\d\d/)).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Include time for Created' })).not.toBeChecked()
  })

  it('"is on" a date is that whole day, the next midnight excluded', async () => {
    render(<Harness initial={filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] })} />)
    await userEvent.type(screen.getByLabelText('Filter value for Created'), '2026-10-05')
    expect(latest.criteria).toEqual([
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [dayStart('2026-10-05')] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-06')] },
    ])
  })

  it('"is between" covers whole days, and shows the two criteria as one condition', async () => {
    render(<Harness initial={filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] })} />)
    await userEvent.selectOptions(screen.getByLabelText('Filter operator'), 'between')
    await userEvent.type(screen.getByLabelText('Filter value from for Created'), '2026-10-01')
    // not finished: one placeholder that is not yet part of the filter
    expect(latest.criteria).toEqual([{ fieldName: 'created', operator: 'BETWEEN', values: [] }])
    await userEvent.type(screen.getByLabelText('Filter value to for Created'), '2026-10-12')
    expect(latest.criteria).toEqual([
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [dayStart('2026-10-01')] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-13')] },
    ])
    expect(screen.getAllByLabelText('Filter operator')).toHaveLength(1)
    expect(screen.getAllByLabelText('Filter field')).toHaveLength(1)
    expect(screen.getByLabelText('Filter operator')).toHaveValue('between')
    expect(screen.getByLabelText('Filter value to for Created')).toHaveValue('2026-10-12')
  })

  it('opens a stored day range on its dates, and removing the row removes both bounds', async () => {
    render(<Harness initial={filterOf(
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [dayStart('2026-10-01')] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-13')] },
      { fieldName: 'name', operator: 'CONTAINS', values: ['x'] },
    )} />)
    expect(screen.getAllByLabelText('Filter operator')).toHaveLength(2)
    expect(screen.getByLabelText('Filter value from for Created')).toHaveValue('2026-10-01')
    expect(screen.getByLabelText('Filter value to for Created')).toHaveValue('2026-10-12')
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter condition 1' }))
    expect(latest.criteria).toEqual([{ fieldName: 'name', operator: 'CONTAINS', values: ['x'] }])
  })

  it('"is within" offers presets and writes relative bounds that stay relative', async () => {
    render(<Harness initial={filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] })} />)
    await userEvent.selectOptions(screen.getByLabelText('Filter operator'), 'within')
    expect(latest.criteria).toEqual([
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: -6 }] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: 1 }] },
    ])
    const range = screen.getByLabelText('Date range for Created')
    expect(range).toHaveValue('last7')
    await userEvent.selectOptions(range, 'lastMonth')
    expect(latest.criteria.map((c) => c.values[0])).toEqual([
      { type: 'StartOfPeriod', unit: 'MONTHS', offset: -1 },
      { type: 'StartOfPeriod', unit: 'MONTHS', offset: 0 },
    ])
    const options = within(range).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(expect.arrayContaining(['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'This week', 'Last week', 'This month', 'Last month', 'This quarter', 'This year', 'Last N...']))
  })

  it('"Last N..." builds a custom last-N range', async () => {
    render(<Harness initial={filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] })} />)
    await userEvent.selectOptions(screen.getByLabelText('Filter operator'), 'within')
    await userEvent.selectOptions(screen.getByLabelText('Date range for Created'), 'custom')
    const count = screen.getByLabelText('Number of days')
    await userEvent.clear(count)
    await userEvent.type(count, '10')
    await userEvent.selectOptions(screen.getByLabelText('Unit'), 'MONTHS')
    expect(latest.criteria.map((c) => c.values[0])).toEqual([
      { type: 'StartOfPeriod', unit: 'MONTHS', offset: -10 },
      { type: 'StartOfPeriod', unit: 'MONTHS', offset: 0 },
    ])
  })

  it('"Include time" switches to date-time inputs holding the same days, and back', async () => {
    render(<Harness initial={filterOf(
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [dayStart('2026-10-01')] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-13')] },
    )} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Include time for Created' }))
    expect(latest.criteria).toEqual([{ fieldName: 'created', operator: 'BETWEEN', values: ['2026-10-01T00:00', '2026-10-12T23:59:59.999'] }])
    expect(screen.getByLabelText('Filter value from for Created')).toHaveAttribute('type', 'datetime-local')
    expect(screen.getByLabelText('Filter value from for Created')).toHaveValue('2026-10-01T00:00')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Include time for Created' }))
    expect(screen.getByLabelText('Filter value from for Created')).toHaveAttribute('type', 'date')
    expect(latest.criteria).toEqual([
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [dayStart('2026-10-01')] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-13')] },
    ])
  })

  it('opens exact times (an older view) with Include time on, untouched', () => {
    render(<Harness initial={filterOf({ fieldName: 'created', operator: 'BETWEEN', values: ['2026-10-01T14:30:00Z', '2026-10-02T09:00:00Z'] })} />)
    expect(screen.getByRole('checkbox', { name: 'Include time for Created' })).toBeChecked()
    expect(screen.getByLabelText('Filter value from for Created')).toHaveAttribute('type', 'datetime-local')
    expect(latest.criteria[0].values).toEqual(['2026-10-01T14:30:00Z', '2026-10-02T09:00:00Z'])
  })

  it('does not let a typed time flip the row back to dates while Include time is on', async () => {
    render(<Harness initial={filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] })} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Include time for Created' }))
    await userEvent.selectOptions(screen.getByLabelText('Filter operator'), 'is at or after')
    await userEvent.type(screen.getByLabelText('Filter value for Created'), '2026-10-05T00:00')
    expect(screen.getByLabelText('Filter value for Created')).toHaveAttribute('type', 'datetime-local')
    expect(screen.getByRole('checkbox', { name: 'Include time for Created' })).toBeChecked()
  })

  it('a DATE field keeps plain dates and has no Include time switch', async () => {
    render(<Harness initial={filterOf({ fieldName: 'due', operator: 'EQUALS', values: [] })} />)
    expect(screen.queryByRole('checkbox', { name: /Include time/ })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Filter operator'), 'between')
    await userEvent.type(screen.getByLabelText('Filter value from for Due'), '2026-10-01')
    await userEvent.type(screen.getByLabelText('Filter value to for Due'), '2026-10-12')
    expect(latest.criteria).toEqual([{ fieldName: 'due', operator: 'BETWEEN', values: ['2026-10-01', '2026-10-12'] }])
  })

  it('keeps "is not on" for DATE fields, and the relative-to-today escape to the older expression editor', async () => {
    render(<Harness initial={filterOf({ fieldName: 'due', operator: 'EQUALS', values: [] })} />)
    const operator = screen.getByLabelText('Filter operator') as HTMLSelectElement
    const labels = [...operator.options].map((o) => o.textContent)
    expect(labels).toEqual(expect.arrayContaining(['is on', 'is between', 'is within', 'is before', 'is after', 'is not on', 'is not between', 'is empty', 'is not empty', 'is relative to today']))
    await userEvent.selectOptions(operator, 'is relative to today')
    expect(screen.getByRole('button', { name: 'Relative date for Due' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pick dates' }))
    expect(screen.getByLabelText('Filter operator')).toHaveValue('on')
  })

  it('offers the weekday conditions, which switch the row to the weekday input', async () => {
    render(<Harness initial={filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] })} />)
    await userEvent.selectOptions(screen.getByLabelText('Filter operator'), 'day is any of')
    expect(screen.getByRole('combobox', { name: 'Filter weekdays for Created' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Include time/ })).not.toBeInTheDocument()
  })

  it('in an OR group, whole-day ranges are not offered (two bounds mean "and")', () => {
    render(<Harness initial={{ ...filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] }, { fieldName: 'name', operator: 'CONTAINS', values: ['x'] }), booleanOperator: 'OR' }} />)
    const operator = screen.getAllByLabelText('Filter operator')[0] as HTMLSelectElement
    const labels = [...operator.options].map((o) => o.textContent)
    expect(labels).not.toContain('is between')
    expect(labels).not.toContain('is within')
    expect(labels).toContain('is before')
  })

  it('does not merge two bounds into one row in an OR group', () => {
    const context = { timeZone: zone, weekStart: 7 }
    const pair: QFilterCriteria[] = [
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [dayStart('2026-10-01')] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-13')] },
    ]
    const fields = buildFilterFields(table)
    expect(buildRows(pair, fields, true, context)).toEqual([{ start: 0, count: 2 }])
    expect(buildRows(pair, fields, false, context)).toEqual([{ start: 0, count: 1 }, { start: 1, count: 1 }])
    // two exact-time bounds are two rows, even when ANDed
    const exact: QFilterCriteria[] = [{ ...pair[0], values: ['2026-10-01T14:30:00Z'] }, pair[1]]
    expect(buildRows(exact, fields, true, context)).toHaveLength(2)
    expect(buildRows([{ ...pair[0], fieldName: 'name' }, { ...pair[1], fieldName: 'name' }], fields, true, context)).toHaveLength(2)
    // a day range then something else
    expect(buildRows([...pair, { fieldName: 'name', operator: 'CONTAINS', values: ['x'] }], fields, true, context)).toEqual([{ start: 0, count: 2 }, { start: 2, count: 1 }])
  })

  it('keeps exact values where a value may be a filter variable (a report setup)', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FilterBuilder tableMetaData={table} filter={filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] })} onChange={() => undefined} allowVariables />
      </QueryClientProvider>
    )
    expect(screen.getByLabelText('Filter value for Created')).toHaveAttribute('type', 'datetime-local')
    expect(screen.queryByRole('checkbox', { name: /Include time/ })).not.toBeInTheDocument()
  })

  it('the time zone is named in a tooltip', async () => {
    render(<Harness initial={filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] })} />)
    expect(screen.getByRole('button', { name: new RegExp(`Time zone: Days start and end at midnight in your time zone, ${zone.replace('/', '\\/')}`) })).toBeInTheDocument()
  })

  it('re-reads criteria that change from outside (a saved view loaded)', async () => {
    function Swapper() {
      const [filter, setFilter] = useState(filterOf({ fieldName: 'created', operator: 'EQUALS', values: [] }))
      latest = filter
      return (
        <QueryClientProvider client={new QueryClient()}>
          <button onClick={() => setFilter(filterOf({ fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [{ type: 'StartOfPeriod', unit: 'MONTHS', offset: -1 }] }, { fieldName: 'created', operator: 'LESS_THAN', values: [{ type: 'StartOfPeriod', unit: 'MONTHS', offset: 0 }] }))}>load view</button>
          <FilterBuilder tableMetaData={table} filter={filter} onChange={setFilter} />
        </QueryClientProvider>
      )
    }
    render(<Swapper />)
    expect(screen.getByLabelText('Filter operator')).toHaveValue('on')
    await userEvent.click(screen.getByRole('button', { name: 'load view' }))
    expect(screen.getByLabelText('Filter operator')).toHaveValue('within')
    expect(screen.getByLabelText('Date range for Created')).toHaveValue('lastMonth')
  })
})

describe('date quick filters', () => {
  function Bar({ initial }: { initial: QQueryFilter }) {
    const [filter, setFilter] = useState(initial)
    latest = filter
    const fields = buildFilterFields(table)
    return (
      <QueryClientProvider client={new QueryClient()}>
        <QuickFilterBar fields={fields.filter((f) => f.name !== 'name')} allFields={fields} defaultFieldNames={['created', 'due']} customFieldNames={[]}
          filter={filter} onChange={setFilter} onCustomFieldsChange={() => undefined} onOpenAdvanced={() => undefined} />
      </QueryClientProvider>
    )
  }

  it('says a range in plain language on the chip, and reopens on the same dates', async () => {
    render(<Bar initial={emptyFilter()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Created' }))
    expect(screen.getByLabelText('Filter operator')).toHaveValue('between')
    await userEvent.type(screen.getByLabelText('Filter value from for Created'), '2026-10-01')
    await userEvent.type(screen.getByLabelText('Filter value to for Created'), '2026-10-12')
    await userEvent.click(screen.getByRole('button', { name: 'Apply quick filter' }))
    expect(latest.criteria).toEqual([
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [dayStart('2026-10-01')] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-13')] },
    ])
    const chip = screen.getByRole('button', { name: /^Created:/ })
    expect(chip).toHaveTextContent('Created: Oct 1 \u2013 Oct 12, 2026')
    await userEvent.click(chip)
    expect(screen.getByLabelText('Filter value from for Created')).toHaveValue('2026-10-01')
    expect(screen.getByLabelText('Filter value to for Created')).toHaveValue('2026-10-12')
  })

  it('names a relative range on the chip', () => {
    render(<Bar initial={filterOf(
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: -6 }] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: 1 }] },
    )} />)
    expect(screen.getByRole('button', { name: /^Created:/ })).toHaveTextContent('Created: Last 7 days')
    expect(screen.queryByText('This condition needs Advanced mode.')).not.toBeInTheDocument()
  })

  it('names "before a date" and plain DATE conditions', () => {
    render(<Bar initial={filterOf(
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-05')] },
      { fieldName: 'due', operator: 'EQUALS', values: ['2026-10-05'] },
    )} />)
    expect(screen.getByRole('button', { name: /^Created:/ })).toHaveTextContent('Created: before Oct 5, 2026')
    expect(screen.getByRole('button', { name: /^Due:/ })).toHaveTextContent('Due: Oct 5, 2026')
  })

  it('keeps showing exact times as date-times', () => {
    render(<Bar initial={filterOf({ fieldName: 'created', operator: 'GREATER_THAN', values: ['2026-10-05T14:30:00Z'] })} />)
    expect(screen.getByRole('button', { name: /^Created:/ })).toHaveTextContent(/Created: is after 2026-10-05 \d\d:30:00 (AM|PM)/)
  })

  it('clearing a range removes both bounds', async () => {
    render(<Bar initial={filterOf(
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [dayStart('2026-10-01')] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-13')] },
    )} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear Created quick filter' }))
    expect(latest.criteria).toEqual([])
  })

  it('a range pair does not need Advanced mode, but a third condition on the field does', () => {
    const pair: QFilterCriteria[] = [
      { fieldName: 'created', operator: 'GREATER_THAN_OR_EQUALS', values: [dayStart('2026-10-01')] },
      { fieldName: 'created', operator: 'LESS_THAN', values: [dayStart('2026-10-13')] },
    ]
    const { unmount } = render(<Bar initial={filterOf(...pair, { fieldName: 'created', operator: 'IS_NOT_BLANK', values: [] })} />)
    expect(screen.getByRole('button', { name: /^Created/ })).toBeInTheDocument()
    unmount()
  })
})
