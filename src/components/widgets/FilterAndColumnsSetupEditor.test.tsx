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

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: (name: string) => ({ data: name === 'audit' ? audit : table }), useMetaData: () => ({ data: undefined }) }))
vi.mock('@/lib/context/q-context', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/context/q-context')>()), useQContext: () => ({ userId: 'alice' }) }))
vi.mock('@/lib/hooks/use-saved-views', () => ({ useSavedViews: () => ({
  isAvailable: true, canStore: true, canDelete: true, isLoading: false, error: null,
  yourViews: [{ id: 1, label: 'People named Ada', tableName: 'person', view: {
    queryFilter: { criteria: [{ fieldName: 'firstName', operator: 'EQUALS', values: ['Ada'] }] },
    queryColumns: { columns: [{ name: 'firstName', isVisible: true, width: 220 }] },
  } }], sharedViews: [], quickViews: [], isOwner: () => true,
}) }))
vi.mock('@/lib/hooks/use-filter-setup', () => ({
  useApiTableMetaData: () => ({ data: undefined }),
  useFilterSetupPreview: () => ({ records: [{ tableName: 'person', values: { id: 1, firstName: 'Ada' } }], totalCount: 1, isLoading: false, error: null, refresh }),
}))

import { FilterAndColumnsSetupWidget } from './FilterAndColumnsSetupWidget'
import { removeUnknownCriteria } from './filter-and-columns-utils'

const table = {
  name: 'person', label: 'Person', primaryKeyField: 'id',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    firstName: { name: 'firstName', label: 'First Name', type: 'STRING' },
  },
} as unknown as QTableMetaData
const audit = { ...table, name: 'audit', label: 'Audit', fields: { id: table.fields.id, action: { ...table.fields.firstName, name: 'action', label: 'Action' } } } as QTableMetaData
const meta = { name: 'reportSetupWidget', label: 'Filters and Columns' } as QWidgetMetaData

/** Form harness applies only the values passed by the widget's OK action. */
function FormHarness({ onSetValues, hidePreview = true, hideColumns = false, switchTable = false }: { switchTable?: boolean; onSetValues: (next: Record<string, unknown>) => void; hidePreview?: boolean; hideColumns?: boolean }) {
  const [values, setValues] = useState<Record<string, unknown>>({ tableName: 'person', queryFilterJson: '{}', columnsJson: '' })
  const context: WidgetFormContext = {
    screen: 'recordEdit', values,
    setValues: (next) => { onSetValues(next); setValues((current) => ({ ...current, ...next })) },
    setAssociation: vi.fn(), registerValidator: vi.fn(), tableMetaData: table,
  }
  return <>{switchTable && <button onClick={() => setValues(current => ({ ...current, tableName: 'audit' }))}>Switch to Audit</button>}<FilterAndColumnsSetupWidget widgetMetaData={meta} data={{ type: 'filterAndColumnsSetup', hidePreview, hideColumns }} formContext={context} /></>
}

describe('FilterAndColumnsSetupWidget form editor', () => {
  it('removes incompatible nested criteria, comparison fields and sorts after a table change', () => {
    const groupDefaults = { booleanOperator: 'AND' as const, skip: 0, limit: 20 }
    const { filter, removed } = removeUnknownCriteria(audit, {
      ...groupDefaults,
      criteria: [{ fieldName: 'id', operator: 'EQUALS', otherFieldName: 'firstName', values: [] }],
      orderBys: [{ fieldName: 'firstName', isAscending: true }, { fieldName: 'id', isAscending: false }],
      subFilters: [
        { ...groupDefaults, criteria: [{ fieldName: 'firstName', operator: 'EQUALS', values: ['Ada'] }] },
        { ...groupDefaults, criteria: [{ fieldName: 'id', operator: 'GREATER_THAN', values: [1] }] },
      ],
    })
    expect(removed).toEqual(['firstName'])
    expect(filter).toEqual({
      ...groupDefaults,
      criteria: [], orderBys: [{ fieldName: 'id', isAscending: false }],
      subFilters: [{ ...groupDefaults, criteria: [{ fieldName: 'id', operator: 'GREATER_THAN', values: [1] }] }],
    })
  })

  it('saves only report data columns and removes incompatible selections when the table changes', async () => {
    const user = userEvent.setup()
    const onSetValues = vi.fn()
    render(<FormHarness onSetValues={onSetValues} switchTable />)
    await user.click(screen.getByRole('button', { name: 'Edit Filters and Columns' }))
    await user.click(screen.getByRole('button', { name: 'Add condition' }))
    await user.selectOptions(screen.getByLabelText('Filter field'), 'firstName')
    await user.type(screen.getByRole('textbox', { name: 'Filter value for First Name' }), 'Ada')
    await user.click(screen.getByRole('button', { name: 'OK' }))
    const saved = onSetValues.mock.lastCall![0] as Record<string, string>
    expect(JSON.parse(saved.columnsJson).columns.map((column: { name: string }) => column.name)).toEqual(['id', 'firstName'])
    await user.click(screen.getByRole('button', { name: 'Switch to Audit' }))
    const changed = onSetValues.mock.lastCall![0] as Record<string, string>
    expect(JSON.parse(changed.queryFilterJson).criteria).toEqual([])
    expect(JSON.parse(changed.columnsJson).columns.filter((column: { isVisible: boolean }) => column.isVisible).map((column: { name: string }) => column.name)).toEqual(['id'])
    expect(screen.queryByText('First Name')).not.toBeInTheDocument()
    expect(screen.queryByText('__check__')).not.toBeInTheDocument()
  })

  it('moves between report tabs with the keyboard and preserves the unsaved filter', async () => {
    const user = userEvent.setup()
    const onSetValues = vi.fn()
    render(<FormHarness onSetValues={onSetValues} />)
    await user.click(screen.getByRole('button', { name: 'Edit Filters and Columns' }))
    await user.click(screen.getByRole('button', { name: 'Add condition' }))
    await user.selectOptions(screen.getByLabelText('Filter field'), 'firstName')
    await user.type(screen.getByRole('textbox', { name: 'Filter value for First Name' }), 'Ada')
    const filters = screen.getByRole('tab', { name: 'Filters and sort' })
    const columns = screen.getByRole('tab', { name: 'Columns' })
    await user.click(filters)
    await user.keyboard('{ArrowRight}')
    expect(columns).toHaveFocus()
    expect(columns).toHaveAttribute('aria-selected', 'true')
    expect(filters).toHaveAttribute('tabindex', '-1')
    const panel = screen.getByRole('tabpanel', { name: 'Columns' })
    expect(columns).toHaveAttribute('aria-controls', panel.id)
    await user.keyboard('{Home}')
    expect(filters).toHaveFocus()
    expect(screen.getByDisplayValue('Ada')).toBeVisible()
    await user.keyboard('{End}')
    expect(columns).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(filters).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(columns).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('searchbox', { name: 'Search Fields' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onSetValues).not.toHaveBeenCalled()
  })

  it('keeps keyboard navigation within Filters when metadata hides Columns', async () => {
    const user = userEvent.setup()
    render(<FormHarness onSetValues={vi.fn()} hideColumns />)
    await user.click(screen.getByRole('button', { name: 'Edit Filters' }))
    const filters = screen.getByRole('tab', { name: 'Filters and sort' })
    await user.click(filters)
    await user.keyboard('{ArrowRight}{End}{ArrowLeft}{Home}')
    expect(filters).toHaveFocus()
    expect(filters).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Columns' })).not.toBeInTheDocument()
    expect(screen.getByRole('tabpanel', { name: 'Filters and sort' })).toBeVisible()
  })

  it('keeps column menu pins and visibility in the draft until OK', async () => {
    const user = userEvent.setup()
    const onSetValues = vi.fn()
    render(<FormHarness onSetValues={onSetValues} hidePreview={false} />)
    await user.click(screen.getByRole('button', { name: 'Edit Filters and Columns' }))
    await user.click(screen.getByRole('button', { name: 'First Name column menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Pin to right' }))
    await user.click(screen.getByRole('button', { name: 'Id column menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Hide column' }))
    expect(onSetValues).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'OK' }))
    const saved = onSetValues.mock.calls[0][0] as Record<string, string>
    const columns = JSON.parse(saved.columnsJson).columns
    expect(columns.find((column: { name: string }) => column.name === 'firstName').pinned).toBe('right')
    expect(columns.find((column: { name: string }) => column.name === 'id').isVisible).toBe(false)
  })

  it('refreshes preview data without changing the report draft', async () => {
    const user = userEvent.setup()
    const onSetValues = vi.fn()
    render(<FormHarness onSetValues={onSetValues} hidePreview={false} />)
    await user.click(screen.getByRole('button', { name: 'Edit Filters and Columns' }))
    await user.click(screen.getByRole('button', { name: 'Refresh preview' }))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onSetValues).not.toHaveBeenCalled()
  })

  it('imports a saved view into the draft, preserves Basic/Advanced filters and only applies on OK', async () => {
    const user = userEvent.setup()
    const onSetValues = vi.fn()
    render(<FormHarness onSetValues={onSetValues} />)
    await user.click(screen.getByRole('button', { name: 'Edit Filters and Columns' }))
    await user.click(screen.getByRole('button', { name: 'Saved views' }))
    expect(screen.queryByRole('menuitem', { name: 'Save As...' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'New View' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'People named Ada' }))
    await user.click(screen.getByRole('button', { name: 'Basic' }))
    expect(screen.getByRole('button', { name: 'First Name: Ada' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByDisplayValue('Ada')).toBeVisible()
    expect(onSetValues).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'OK' }))
    const saved = onSetValues.mock.calls[0][0] as Record<string, string>
    expect(JSON.parse(saved.queryFilterJson).criteria[0].values).toEqual(['Ada'])
    expect(JSON.parse(saved.columnsJson).columns.find((column: { name: string }) => column.name === 'firstName')).toMatchObject({ isVisible: true, width: 220 })
  })

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
