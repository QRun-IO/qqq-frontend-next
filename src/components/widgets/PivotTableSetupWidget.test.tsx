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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: vi.fn() }))

import type { QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { PivotTableSetupWidget } from './PivotTableSetupWidget'

const tableMetaData = vi.mocked(useTableMetaData)
const pet = {
  name: 'pet',
  label: 'Pet',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    personId: { name: 'personId', label: 'Owner', type: 'INTEGER' },
    speciesId: { name: 'speciesId', label: 'Species', type: 'INTEGER' },
  },
} as unknown as QTableMetaData
const meta = { name: 'pivotTableSetupWidget', label: 'Pivot Table', hasPermission: true } as QWidgetMetaData
/** The real payload served by `pivotTableSetupWidget`. */
const payload = { type: 'pivotTableSetup', queryParams: { id: '1' } }

function record(pivotTableJson: unknown): QRecord {
  return { tableName: 'savedReport', values: { id: 1, tableName: 'pet', pivotTableJson } }
}

describe('PivotTableSetupWidget', () => {
  beforeEach(() => {
    tableMetaData.mockReset()
    tableMetaData.mockReturnValue({ data: pet, isLoading: false, isError: false } as unknown as ReturnType<typeof useTableMetaData>)
  })

  it('lists rows, columns and values with field labels and function names', () => {
    const json = JSON.stringify({
      rows: [{ fieldName: 'personId', showTotals: false }],
      columns: [{ fieldName: 'speciesId' }],
      values: [{ fieldName: 'id', function: 'COUNT' }, { fieldName: 'speciesId', function: 'MAX' }],
    })
    const { container } = render(<PivotTableSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: record(json) }} />)
    expect(tableMetaData).toHaveBeenCalledWith('pet')
    const items = (key: string) => Array.from(container.querySelectorAll(`[data-qqq-id="pivot-${key}-pivotTableSetupWidget"] li`)).map((li) => li.textContent)
    expect(items('rows')).toEqual(['Owner'])
    expect(items('columns')).toEqual(['Species'])
    expect(items('values')).toEqual(['Count of Id', 'Max of Species'])
  })

  it('shows None for an empty part', () => {
    const json = JSON.stringify({ rows: [{ fieldName: 'personId' }], values: [{ fieldName: 'id', function: 'SUM' }] })
    const { container } = render(<PivotTableSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: record(json) }} />)
    expect(container.querySelector('[data-qqq-id="pivot-columns-pivotTableSetupWidget"]')?.textContent).toBe('None')
    expect(screen.getByText('Sum of Id')).toBeInTheDocument()
  })

  it('says the report does not use a pivot table when there is no definition', () => {
    render(<PivotTableSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: record(null) }} />)
    expect(screen.getByText('This report does not use a pivot table.')).toBeInTheDocument()
  })

  it('shows a contained notice for an invalid definition', () => {
    const { rerender } = render(<PivotTableSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: record('{bad') }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('not valid JSON')
    rerender(<PivotTableSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: record('{"rows":{"invalidShape":true}}') }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('unexpected shape')
  })
})
