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
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { QRecord, QTableMetaData } from '@/types'
import { DataGrid } from './DataGrid'

const cellRenders = vi.fn()
vi.mock('./DataCell', () => ({
  DataCell: ({ value }: { value: unknown }) => {
    cellRenders()
    return <span>{String(value ?? '')}</span>
  },
}))
const router = { push: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const field = (name: string, label: string, type: string) => ({ name, label, type, isEditable: true, isRequired: false, isHeavy: false, isHidden: false, adornments: [] })
const TABLE = {
  name: 'person', label: 'Person', primaryKeyField: 'id',
  fields: { id: field('id', 'Id', 'INTEGER'), name: field('name', 'Name', 'STRING') },
  sections: [], exposedJoins: [], capabilities: [],
} as unknown as QTableMetaData
const record = (id: number, name: string) => ({ tableName: 'person', values: { id, name }, displayValues: {} }) as unknown as QRecord
const RECORDS = [record(1, 'Ada'), record(2, 'Bo'), record(3, 'Cy')]

const handlers = { onSortChange: vi.fn(), onRowSelectionChange: vi.fn(), onColumnWidthChange: vi.fn(), onResetFilter: vi.fn() }
const sortOrder = [{ fieldName: 'id', isAscending: false }]
const empty = {}
const noOrder: string[] = []

/** Renders the grid with stable props, overriding some. */
function grid(overrides: Partial<React.ComponentProps<typeof DataGrid>> = {}) {
  return (
    <DataGrid
      tableName="person" tableMetaData={TABLE} records={RECORDS} totalCount={3} isLoading={false} isFetching={false}
      sortOrder={sortOrder} rowSelection={empty} columnVisibility={empty} columnOrder={noOrder} columnWidths={empty}
      density="standard" pageSize={25} {...handlers} {...overrides}
    />
  )
}

describe('DataGrid row rendering (QRun-IO/qqq#710)', () => {
  beforeEach(() => cellRenders.mockClear())

  it('does not re-render unchanged rows when only the fetching state changes', () => {
    const { rerender } = render(grid())
    expect(cellRenders).toHaveBeenCalledTimes(6)
    rerender(grid({ isFetching: true }))
    rerender(grid({ isFetching: false, totalCount: 3 }))
    expect(cellRenders).toHaveBeenCalledTimes(6)
  })

  it('re-renders only the rows whose selection changed', () => {
    const { rerender } = render(grid())
    cellRenders.mockClear()
    rerender(grid({ rowSelection: { 2: true } }))
    expect(cellRenders).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('checkbox', { name: 'Select record', checked: true })).toBeInTheDocument()
    expect(screen.getAllByRole('row')[2]).toHaveClass('bg-primary/5')
  })

  it('re-renders every row for new records and for column changes', () => {
    const { rerender } = render(grid())
    cellRenders.mockClear()
    rerender(grid({ records: [record(4, 'Di'), record(5, 'Ed')] }))
    expect(cellRenders).toHaveBeenCalledTimes(4)
    expect(screen.getByText('Di')).toBeInTheDocument()
    cellRenders.mockClear()
    rerender(grid({ records: [record(4, 'Di'), record(5, 'Ed')], columnVisibility: { name: false } }))
    expect(screen.queryByText('Di')).not.toBeInTheDocument()
    expect(cellRenders).toHaveBeenCalledTimes(2)
  })
})

// Grid selection checkboxes: a label around each box is its touch target (QRun-IO/qqq#708).
describe('DataGrid selection checkboxes', () => {
  const labelled = [1, 2].map((id) => ({ ...record(id, `P${id}`), recordLabel: `Person ${id}` })) as unknown as QRecord[]

  it('wraps the header and row checkboxes in labels', () => {
    render(grid({ records: labelled, totalCount: 2 }))
    expect(screen.getByRole('checkbox', { name: 'Select all rows on this page' }).closest('label')).not.toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select Person 1' }).closest('label')).not.toBeNull()
  })

  it('selects a row from its label without opening the record', () => {
    handlers.onRowSelectionChange.mockClear()
    router.push.mockClear()
    render(grid({ records: labelled, totalCount: 2 }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Person 2' }).closest('label')!)
    expect(handlers.onRowSelectionChange).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })
})
