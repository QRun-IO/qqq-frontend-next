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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: vi.fn() }))

import type { QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { PivotTableSetupWidget } from './PivotTableSetupWidget'
import type { WidgetFormContext } from './widget-types'

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

const person = {
  name: 'person',
  label: 'Person',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    firstName: { name: 'firstName', label: 'First Name', type: 'STRING' },
    lastName: { name: 'lastName', label: 'Last Name', type: 'STRING' },
    isEmployed: { name: 'isEmployed', label: 'Is Employed', type: 'BOOLEAN' },
    annualSalary: { name: 'annualSalary', label: 'Annual Salary', type: 'DECIMAL' },
    email: { name: 'email', label: 'Email', type: 'STRING' },
  },
} as unknown as QTableMetaData
const columnsJson = JSON.stringify({
  columns: [
    { name: 'id', isVisible: true },
    { name: 'firstName', isVisible: true },
    { name: 'lastName', isVisible: true },
    { name: 'isEmployed', isVisible: true },
    { name: 'annualSalary', isVisible: true },
    { name: 'email', isVisible: false },
  ],
})
const savedPivotJson = JSON.stringify({
  rows: [{ fieldName: 'lastName' }],
  columns: [{ fieldName: 'isEmployed' }],
  values: [{ fieldName: 'id', function: 'COUNT' }, { fieldName: 'annualSalary', function: 'SUM' }],
})
const NO_TABLE = 'You must select a table before you can set up your pivot table'
const NO_COLUMNS = "You must set up your report's Columns before you can set up your Pivot Table"

/** Hosts the widget in a stand-in form that merges the values the widget writes. */
function FormHarness({ initial, disabled, onSetValues }: { initial: Record<string, unknown>; disabled?: boolean; onSetValues: (values: Record<string, unknown>) => void }) {
  const [values, setValues] = useState(initial)
  const formContext: WidgetFormContext = {
    screen: 'recordEdit',
    values,
    setValues: (next) => {
      onSetValues(next)
      setValues((current) => ({ ...current, ...next }))
    },
    setAssociation: vi.fn(),
    registerValidator: vi.fn(),
    disabled,
  }
  return <PivotTableSetupWidget widgetMetaData={meta} data={payload} formContext={formContext} />
}

/** Renders the widget in edit mode; returns the setValues spy, a data-qqq-id lookup and a user. */
function renderForm(initial: Record<string, unknown>, disabled?: boolean) {
  const onSetValues = vi.fn()
  const { container } = render(<FormHarness initial={initial} disabled={disabled} onSetValues={onSetValues} />)
  const byQqqId = (id: string) => container.querySelector(`[data-qqq-id="${id}"]`)
  return { onSetValues, byQqqId, user: userEvent.setup() }
}

const toggle = () => screen.getByRole('switch', { name: 'Use Pivot Table?' })
const editButton = () => screen.getByRole('button', { name: 'Edit Pivot Table' })
const chips = (key: string) => Array.from(document.querySelectorAll(`[data-qqq-id="pivot-${key}-pivotTableSetupWidget"] li`)).map((li) => li.textContent)

describe('PivotTableSetupWidget usePivotTable flag (view)', () => {
  beforeEach(() => {
    tableMetaData.mockReset()
    tableMetaData.mockReturnValue({ data: pet, isLoading: false, isError: false } as unknown as ReturnType<typeof useTableMetaData>)
  })

  it('shows the parts when the flag is on, even before any is defined', () => {
    const { container } = render(<PivotTableSetupWidget widgetMetaData={meta} data={payload}
      recordContext={{ tableName: 'savedReport', record: { tableName: 'savedReport', values: { id: 1, tableName: 'pet', usePivotTable: true, pivotTableJson: null } } }} />)
    expect(screen.queryByText('This report does not use a pivot table.')).not.toBeInTheDocument()
    for (const key of ['rows', 'columns', 'values']) expect(container.querySelector(`[data-qqq-id="pivot-${key}-pivotTableSetupWidget"]`)?.textContent).toBe('None')
  })

  it('says the report does not use a pivot table when the flag is off and nothing is defined', () => {
    render(<PivotTableSetupWidget widgetMetaData={meta} data={payload}
      recordContext={{ tableName: 'savedReport', record: { tableName: 'savedReport', values: { id: 1, tableName: 'pet', usePivotTable: false, pivotTableJson: '{"rows":[],"values":[]}' } } }} />)
    expect(screen.getByText('This report does not use a pivot table.')).toBeInTheDocument()
  })
})

describe('PivotTableSetupWidget (edit)', () => {
  beforeEach(() => {
    tableMetaData.mockReset()
    tableMetaData.mockImplementation((tableName) => ({ data: tableName === 'person' ? person : undefined, isLoading: false, isError: false }) as unknown as ReturnType<typeof useTableMetaData>)
  })

  it('turns the pivot table off with the "Use Pivot Table?" switch, clearing pivotTableJson, and back on', async () => {
    const { onSetValues, byQqqId, user } = renderForm({ tableName: 'person', columnsJson, pivotTableJson: savedPivotJson })
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(toggle()).toHaveAttribute('data-qqq-id', 'pivot-use-toggle-pivotTableSetupWidget')
    expect(editButton()).toHaveAttribute('data-qqq-id', 'pivot-edit-button-pivotTableSetupWidget')
    expect(chips('rows')).toEqual(['Last Name'])
    expect(chips('values')).toEqual(['Count of Id', 'Sum of Annual Salary'])

    await user.click(toggle())
    expect(onSetValues).toHaveBeenLastCalledWith({ usePivotTable: false, pivotTableJson: null })
    expect(toggle()).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('button', { name: 'Edit Pivot Table' })).not.toBeInTheDocument()
    expect(byQqqId('pivot-rows-pivotTableSetupWidget')).toBeNull()

    await user.click(toggle())
    expect(onSetValues).toHaveBeenLastCalledWith({ usePivotTable: true })
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(editButton()).toBeEnabled()
    // the definition was cleared: each part offers to add one
    expect(within(byQqqId('pivot-rows-pivotTableSetupWidget') as HTMLElement).getByRole('button', { name: 'Add new row' }))
      .toHaveAttribute('data-qqq-id', 'pivot-add-row-pivotTableSetupWidget')
    expect(screen.getByRole('button', { name: 'Add new column' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Add new value' })).toBeEnabled()
  })

  it('starts off without a definition, and on from the usePivotTable value', () => {
    const { unmount } = render(<FormHarness initial={{ tableName: 'person', columnsJson }} onSetValues={vi.fn()} />)
    expect(toggle()).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('button', { name: 'Edit Pivot Table' })).not.toBeInTheDocument()
    unmount()
    renderForm({ tableName: 'person', columnsJson, usePivotTable: true })
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(editButton()).toBeEnabled()
  })

  it('disables the switch until a table is chosen, with Material\'s reason', () => {
    const { byQqqId } = renderForm({ tableName: null, columnsJson })
    expect(toggle()).toBeDisabled()
    expect(byQqqId('pivot-use-toggle-pivotTableSetupWidget-tooltip')).toHaveTextContent(NO_TABLE)
  })

  it('disables editing until the report has columns, with Material\'s reason', async () => {
    const { onSetValues, byQqqId, user } = renderForm({ tableName: 'person', columnsJson: '{"columns":[{"name":"id","isVisible":false}]}', usePivotTable: true })
    expect(toggle()).toBeDisabled()
    expect(editButton()).toBeDisabled()
    expect(byQqqId('pivot-edit-button-pivotTableSetupWidget-tooltip')).toHaveTextContent(NO_COLUMNS)
    expect(screen.getByRole('button', { name: 'Add new row' })).toBeDisabled()
    expect(byQqqId('pivot-add-row-pivotTableSetupWidget-tooltip')).toHaveTextContent(NO_COLUMNS)
    await user.click(editButton())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onSetValues).not.toHaveBeenCalled()
  })

  it('edits in the modal; OK writes pivotTableJson in Material\'s shape and the flag into the form', async () => {
    const { onSetValues, user } = renderForm({ tableName: 'person', columnsJson, usePivotTable: true })
    await user.click(screen.getByRole('button', { name: 'Add new row' }))
    expect(screen.getByRole('dialog', { name: 'Edit Pivot Table' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add new row' }))
    // the field picker offers the report's visible columns only (Email is hidden)
    expect(within(screen.getByLabelText('Row 1 field')).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Select a field', 'Annual Salary', 'First Name', 'Id', 'Is Employed', 'Last Name'])
    await user.selectOptions(screen.getByLabelText('Row 1 field'), 'Last Name')
    await user.click(screen.getByRole('button', { name: 'Add new column' }))
    await user.selectOptions(screen.getByLabelText('Column 1 field'), 'Is Employed')
    await user.click(screen.getByRole('button', { name: 'Add new value' }))
    await user.selectOptions(screen.getByLabelText('Value 1 field'), 'Id')
    await user.selectOptions(screen.getByLabelText('Value 1 function'), 'Count')
    await user.click(screen.getByRole('button', { name: 'OK' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onSetValues).toHaveBeenCalledTimes(1)
    const written = onSetValues.mock.calls[0][0] as { pivotTableJson: string; usePivotTable: boolean }
    expect(written.usePivotTable).toBe(true)
    expect(JSON.parse(written.pivotTableJson)).toEqual({
      rows: [{ fieldName: 'lastName', key: expect.any(Number) }],
      columns: [{ fieldName: 'isEmployed', key: expect.any(Number) }],
      values: [{ fieldName: 'id', function: 'COUNT', key: expect.any(Number) }],
    })
    expect(chips('rows')).toEqual(['Last Name'])
    expect(chips('columns')).toEqual(['Is Employed'])
    expect(chips('values')).toEqual(['Count of Id'])
  })

  it('blocks OK while values are missing', async () => {
    const { onSetValues, user } = renderForm({ tableName: 'person', columnsJson, pivotTableJson: savedPivotJson })
    await user.click(editButton())
    await user.click(screen.getByRole('button', { name: 'Add new value' }))
    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Missing value in 2 fields.')
    expect(screen.getByRole('dialog', { name: 'Edit Pivot Table' })).toBeInTheDocument()
    expect(onSetValues).not.toHaveBeenCalled()
  })

  it('Cancel and Escape discard the modal\'s changes, and focus returns to Edit Pivot Table', async () => {
    const { onSetValues, user } = renderForm({ tableName: 'person', columnsJson, pivotTableJson: savedPivotJson })
    await user.click(editButton())
    expect(screen.getByLabelText('Row 1 field')).toHaveValue('lastName')
    await user.click(screen.getByRole('button', { name: 'Remove row 1' }))
    await user.click(screen.getByRole('button', { name: 'Move value 1 down' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editButton()).toHaveFocus()
    expect(onSetValues).not.toHaveBeenCalled()
    expect(chips('rows')).toEqual(['Last Name'])

    await user.click(editButton())
    expect(screen.getByLabelText('Row 1 field')).toHaveValue('lastName')
    expect(screen.getByLabelText('Value 1 field')).toHaveValue('id')
    await user.click(screen.getByRole('button', { name: 'Remove row 1' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editButton()).toHaveFocus()
    expect(onSetValues).not.toHaveBeenCalled()
  })

  it('shows but does not allow edits when the form is locked', async () => {
    const { byQqqId, user } = renderForm({ tableName: 'person', columnsJson, pivotTableJson: savedPivotJson }, true)
    expect(toggle()).toBeDisabled()
    expect(editButton()).toBeDisabled()
    expect(byQqqId('pivot-edit-button-pivotTableSetupWidget-tooltip')).toBeNull()
    expect(chips('values')).toEqual(['Count of Id', 'Sum of Annual Salary'])
    await user.click(editButton())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a contained notice for an invalid definition, which turning the switch off clears', async () => {
    const { onSetValues, user } = renderForm({ tableName: 'person', columnsJson, usePivotTable: true, pivotTableJson: '{bad' })
    expect(screen.getByRole('alert')).toHaveTextContent('not valid JSON')
    expect(screen.queryByRole('button', { name: 'Edit Pivot Table' })).not.toBeInTheDocument()
    await user.click(toggle())
    expect(onSetValues).toHaveBeenLastCalledWith({ usePivotTable: false, pivotTableJson: null })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
