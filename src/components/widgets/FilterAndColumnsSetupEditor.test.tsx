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

import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { QTableMetaData, QWidgetMetaData } from '@/types'
import type { WidgetFormContext } from './widget-types'

vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: () => ({ data: table }) }))
vi.mock('@/lib/hooks/use-filter-setup', () => ({
  useApiTableMetaData: () => ({ data: undefined }),
  useFilterSetupPreview: () => ({ records: [], totalCount: 0, isLoading: false, error: null }),
}))

import { FilterAndColumnsSetupWidget } from './FilterAndColumnsSetupWidget'

const table = {
  name: 'person', label: 'Person', primaryKeyField: 'id',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    firstName: { name: 'firstName', label: 'First Name', type: 'STRING' },
  },
} as unknown as QTableMetaData
const meta = { name: 'reportSetupWidget', label: 'Filters and Columns' } as QWidgetMetaData

/** Form harness applies only the values passed by the widget's OK action. */
function FormHarness({ onSetValues }: { onSetValues: (next: Record<string, unknown>) => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({ tableName: 'person', queryFilterJson: '{}', columnsJson: '' })
  const context: WidgetFormContext = {
    screen: 'recordEdit', values,
    setValues: (next) => { onSetValues(next); setValues((current) => ({ ...current, ...next })) },
    setAssociation: vi.fn(), registerValidator: vi.fn(), tableMetaData: table,
  }
  return <FilterAndColumnsSetupWidget widgetMetaData={meta} data={{ type: 'filterAndColumnsSetup', hidePreview: true }} formContext={context} />
}

describe('FilterAndColumnsSetupWidget form editor', () => {
  it('opens separate Add Filters and Add Columns controls on the matching editor tab', async () => {
    const user = userEvent.setup()
    render(<FormHarness onSetValues={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '+ Add Columns' }))
    expect(screen.getByRole('tab', { name: 'Columns' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: '+ Add Filters' }))
    expect(screen.getByRole('tab', { name: 'Filters and sort' })).toHaveAttribute('aria-selected', 'true')
  })

  it('discards Cancel and writes backend-compatible filter and columns JSON on OK', async () => {
    const user = userEvent.setup()
    const onSetValues = vi.fn()
    render(<FormHarness onSetValues={onSetValues} />)

    await user.click(screen.getByRole('button', { name: 'Edit Filters and Columns' }))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'firstName')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onSetValues).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Edit Filters and Columns' }))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'firstName')
    await user.click(screen.getByRole('button', { name: '+ Add sort' }))
    await user.click(screen.getAllByRole('checkbox', { name: 'Ascending' })[1])
    await user.click(screen.getByRole('button', { name: 'OK' }))

    expect(onSetValues).toHaveBeenCalledTimes(1)
    const saved = onSetValues.mock.calls[0][0] as Record<string, string>
    expect(JSON.parse(saved.queryFilterJson).orderBys).toEqual([
      { fieldName: 'firstName', isAscending: true }, { fieldName: 'id', isAscending: false },
    ])
    expect(JSON.parse(saved.columnsJson).columns.some((column: { name: string }) => column.name === 'firstName')).toBe(true)
    expect(screen.getByText(/Sorted by/)).toHaveTextContent('First Name ascending')
  })
})
