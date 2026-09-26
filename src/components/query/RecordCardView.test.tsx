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

// Phone card list: loading, empty and populated states (QRun-IO/qqq#694, #649)

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import type { QRecord, QTableMetaData } from '@/types'

import { RecordCardView } from './RecordCardView'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const table = {
  name: 'person',
  label: 'Person',
  primaryKeyField: 'id',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    firstName: { name: 'firstName', label: 'First Name', type: 'STRING' },
  },
} as unknown as QTableMetaData

function renderCards(records: QRecord[], isLoading?: boolean) {
  return render(
    <RecordCardView
      tableName="person"
      tableMetaData={table}
      records={records}
      rowSelection={{}}
      onRowSelectionChange={vi.fn()}
      columnVisibility={{}}
      columnOrder={[]}
      isLoading={isLoading}
    />
  )
}

describe('RecordCardView', () => {
  it('shows a busy placeholder instead of "No records found" while the first page loads', () => {
    renderCards([], true)
    const status = screen.getByRole('status', { name: 'Loading Person records' })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('No records found')).not.toBeInTheDocument()
  })

  it('shows the empty state once loading finished with no records', () => {
    renderCards([], false)
    expect(screen.getByText('No records found')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps showing loaded cards during a refetch', () => {
    renderCards([{ values: { id: 1, firstName: 'Avery' }, displayValues: {}, recordLabel: 'Avery Sample' } as unknown as QRecord], true)
    expect(screen.getByRole('list', { name: 'Person records' })).toBeInTheDocument()
    expect(screen.getByText('Avery Sample')).toBeInTheDocument()
  })

  const records = [1, 2, 3].map((id) => ({ values: { id, firstName: `P${id}` }, displayValues: {}, recordLabel: `Person ${id}` })) as unknown as QRecord[]

  it('wraps each checkbox in a label (its touch target) and selecting does not open the record (#708)', () => {
    const onChange = vi.fn()
    render(<RecordCardView tableName="person" tableMetaData={table} records={records} rowSelection={{}}
      onRowSelectionChange={onChange} columnVisibility={{}} columnOrder={[]} />)
    const box = screen.getByRole('checkbox', { name: 'Select Person 2' })
    expect(box.closest('label')).not.toBeNull()
    fireEvent.click(box.closest('label')!)
    expect(onChange).toHaveBeenCalledWith({ 2: true })
  })

  it('shows cards covered by an all / first-N selection as checked; unchecking keeps the others (#708)', () => {
    const onChange = vi.fn()
    render(<RecordCardView tableName="person" tableMetaData={table} records={records} rowSelection={{}}
      onRowSelectionChange={onChange} columnVisibility={{}} columnOrder={[]} isRowSelectedByQuery={(i) => i < 2} />)
    expect(screen.getByRole('checkbox', { name: 'Select Person 1' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Person 2' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Person 3' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Person 1' }))
    expect(onChange).toHaveBeenCalledWith({ 2: true })
  })

  it('names each value by its field for layout-neutral lookups', () => {
    render(<RecordCardView tableName="person" tableMetaData={table} records={records} rowSelection={{}}
      onRowSelectionChange={vi.fn()} columnVisibility={{}} columnOrder={[]} />)
    expect(document.querySelectorAll('[data-qqq-id="card-field-firstName"] dd')).toHaveLength(3)
  })
})
