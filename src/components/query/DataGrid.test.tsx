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

// Grid selection checkboxes: a label around each box is its touch target (QRun-IO/qqq#708).

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import type { QRecord, QTableMetaData } from '@/types'

import { DataGrid } from './DataGrid'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const table = {
  name: 'person',
  label: 'Person',
  primaryKeyField: 'id',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    firstName: { name: 'firstName', label: 'First Name', type: 'STRING' },
  },
} as unknown as QTableMetaData

const records = [1, 2].map((id) => ({ values: { id, firstName: `P${id}` }, displayValues: {}, recordLabel: `Person ${id}` })) as unknown as QRecord[]

function renderGrid(onRowSelectionChange = vi.fn()) {
  render(
    <DataGrid tableName="person" tableMetaData={table} records={records} totalCount={2} isLoading={false} isFetching={false}
      sortOrder={[]} onSortChange={vi.fn()} rowSelection={{}} onRowSelectionChange={onRowSelectionChange}
      columnVisibility={{}} columnOrder={[]} columnWidths={{}} onColumnWidthChange={vi.fn()} density="standard"
      pageSize={25} onResetFilter={vi.fn()} />
  )
  return onRowSelectionChange
}

describe('DataGrid selection checkboxes', () => {
  it('wraps the header and row checkboxes in labels', () => {
    renderGrid()
    expect(screen.getByRole('checkbox', { name: 'Select all rows on this page' }).closest('label')).not.toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Select Person 1' }).closest('label')).not.toBeNull()
  })

  it('selects a row from its label without opening the record', () => {
    const onChange = renderGrid()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Person 2' }).closest('label')!)
    expect(onChange).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})
