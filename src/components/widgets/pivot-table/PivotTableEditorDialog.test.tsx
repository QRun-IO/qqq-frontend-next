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
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { QFieldMetaData, QTableMetaData } from '@/types'
import { parsePivotDefinition } from './pivot-table-model'
import type { PivotDefinition } from './pivot-table-model'
import { PivotTableEditorDialog } from './PivotTableEditorDialog'

const field = (name: string, label: string, type: string, extra: Partial<QFieldMetaData> = {}) => ({ name, label, type, ...extra }) as QFieldMetaData
const state = { name: 'state', label: 'State', fields: { code: field('code', 'Code', 'STRING') } } as unknown as QTableMetaData
const person = {
  name: 'person',
  label: 'Person',
  fields: {
    id: field('id', 'Id', 'INTEGER'),
    firstName: field('firstName', 'First Name', 'STRING'),
    lastName: field('lastName', 'Last Name', 'STRING'),
    birthDate: field('birthDate', 'Birth Date', 'DATE'),
    annualSalary: field('annualSalary', 'Annual Salary', 'DECIMAL'),
    homeStateId: field('homeStateId', 'Home State', 'INTEGER', { possibleValueSourceName: 'state' }),
    email: field('email', 'Email', 'STRING'),
  },
} as unknown as QTableMetaData
const columns = ['id', 'firstName', 'lastName', 'birthDate', 'annualSalary', 'homeStateId']

/** Visible option texts of a select, without its placeholder. */
function optionTexts(select: HTMLElement): string[] {
  return within(select).getAllByRole('option').map((option) => option.textContent ?? '').filter((text) => text !== 'Select a field' && text !== 'Select a function')
}

/** Renders the open dialog; returns the save and cancel spies. */
function renderDialog(definition: PivotDefinition = { extra: {} }, options: { table?: QTableMetaData; available?: string[]; disabled?: boolean } = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(
    <PivotTableEditorDialog
      open
      widgetName="pivotTableSetupWidget"
      tableMetaData={options.table ?? person}
      availableFieldNames={options.available ?? columns}
      definition={definition}
      disabled={options.disabled}
      onCancel={onCancel}
      onSave={onSave}
    />
  )
  return { onSave, onCancel, user: userEvent.setup() }
}

/** The saved definition, as plain `fieldName`/`function` entries. */
function saved(onSave: ReturnType<typeof vi.fn>) {
  const definition = onSave.mock.calls.at(-1)![0] as PivotDefinition
  const plain = (items: PivotDefinition['rows']) => items?.map((item) => (item.function === undefined ? item.fieldName : `${item.function} ${item.fieldName}`))
  return { rows: plain(definition.rows), columns: plain(definition.columns), values: plain(definition.values) }
}

const list = (name: string) => within(screen.getByRole('list', { name }))

describe('PivotTableEditorDialog', () => {
  it('is a labelled modal with Rows, Columns and Values parts, Cancel and OK', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Edit Pivot Table' })
    expect(dialog).toHaveAttribute('data-qqq-id', 'pivot-editor-pivotTableSetupWidget')
    for (const part of ['Rows', 'Columns', 'Values']) expect(screen.getByRole('list', { name: part })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add new row' })).toHaveAttribute('data-qqq-id', 'pivot-editor-add-row')
    expect(screen.getByRole('button', { name: 'Add new column' })).toHaveAttribute('data-qqq-id', 'pivot-editor-add-column')
    expect(screen.getByRole('button', { name: 'Add new value' })).toHaveAttribute('data-qqq-id', 'pivot-editor-add-value')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('data-qqq-id', 'pivot-editor-cancel')
    expect(screen.getByRole('button', { name: 'OK' })).toHaveAttribute('data-qqq-id', 'pivot-editor-ok')
  })

  it('adds and removes group-bys and values, then OK saves them', async () => {
    const { onSave, user } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Add new row' }))
    expect(screen.getByLabelText('Row 1 field')).toHaveFocus()
    await user.selectOptions(screen.getByLabelText('Row 1 field'), 'Last Name')
    await user.click(screen.getByRole('button', { name: 'Add new row' }))
    await user.selectOptions(screen.getByLabelText('Row 2 field'), 'First Name')
    await user.click(screen.getByRole('button', { name: 'Add new column' }))
    await user.selectOptions(screen.getByLabelText('Column 1 field'), 'Birth Date')
    await user.click(screen.getByRole('button', { name: 'Add new value' }))
    await user.selectOptions(screen.getByLabelText('Value 1 field'), 'Id')
    await user.selectOptions(screen.getByLabelText('Value 1 function'), 'Count')
    await user.click(screen.getByRole('button', { name: 'Add new value' }))
    await user.selectOptions(screen.getByLabelText('Value 2 field'), 'Annual Salary')
    await user.selectOptions(screen.getByLabelText('Value 2 function'), 'Sum')

    await user.click(screen.getByRole('button', { name: 'Remove row 1' }))
    expect(screen.getByRole('button', { name: 'Add new row' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Remove value 1' }))
    expect(list('Rows').getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByLabelText('Row 1 field')).toHaveValue('firstName')

    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(saved(onSave)).toEqual({ rows: ['firstName'], columns: ['birthDate'], values: ['SUM annualSalary'] })
  })

  it('offers only the report\'s columns in the field pickers, and excludes fields already used', async () => {
    const { user } = renderDialog(parsePivotDefinition({
      rows: [{ fieldName: 'lastName' }],
      columns: [{ fieldName: 'birthDate' }],
      values: [{ fieldName: 'id', function: 'COUNT' }],
    }))
    // Email is not a report column; a group-by excludes the other group-bys and the value fields
    expect(optionTexts(screen.getByLabelText('Row 1 field'))).toEqual(['Annual Salary', 'First Name', 'Home State', 'Last Name'])
    expect(optionTexts(screen.getByLabelText('Column 1 field'))).toEqual(['Annual Salary', 'Birth Date', 'First Name', 'Home State'])
    // a value excludes the group-by fields, but may reuse another value's field
    await user.click(screen.getByRole('button', { name: 'Add new value' }))
    expect(optionTexts(screen.getByLabelText('Value 2 field'))).toEqual(['Annual Salary', 'First Name', 'Home State', 'Id'])
    await user.click(screen.getByRole('button', { name: 'Add new row' }))
    expect(optionTexts(screen.getByLabelText('Row 2 field'))).toEqual(['Annual Salary', 'First Name', 'Home State'])
  })

  it('says when no fields are left to choose, and groups fields by table when the table has joins', async () => {
    const table = { ...person, exposedJoins: [{ label: 'State', isMany: false, joinTable: state }] } as unknown as QTableMetaData
    const { user } = renderDialog(parsePivotDefinition({ rows: [{ fieldName: 'id' }] }), { table, available: ['id', 'state.code'] })
    await user.click(screen.getByRole('button', { name: 'Add new column' }))
    const select = screen.getByLabelText('Column 1 field')
    // Id is used by the row, so only the join's group has a field left
    expect(Array.from(select.querySelectorAll('optgroup')).map((group) => group.label)).toEqual(['State fields'])
    await user.selectOptions(select, 'Code')
    expect(select).toHaveValue('state.code')
    await user.click(screen.getByRole('button', { name: 'Add new row' }))
    expect(within(screen.getByLabelText('Row 2 field')).getAllByRole('option').map((option) => option.textContent)).toEqual(['There are no fields available.'])
  })

  it('offers the aggregate functions for the chosen field\'s type, and clears one the new field does not allow', async () => {
    const { user } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Add new value' }))
    const fieldSelect = screen.getByLabelText('Value 1 field')
    const functionSelect = screen.getByLabelText('Value 1 function')
    expect(optionTexts(functionSelect)).toEqual(['Sum', 'Count', 'Average', 'Max', 'Min', 'Product', 'StdDev', 'StdDevp', 'Var', 'Varp'])
    await user.selectOptions(fieldSelect, 'Annual Salary')
    await user.selectOptions(functionSelect, 'Average')
    await user.selectOptions(fieldSelect, 'Birth Date')
    expect(optionTexts(functionSelect)).toEqual(['Count', 'Average', 'Max', 'Min'])
    expect(functionSelect).toHaveValue('AVERAGE')
    await user.selectOptions(fieldSelect, 'Last Name')
    expect(optionTexts(functionSelect)).toEqual(['Count'])
    expect(functionSelect).toHaveValue('')
    await user.selectOptions(fieldSelect, 'Home State')
    expect(optionTexts(functionSelect)).toEqual(['Count'])
  })

  it('blocks OK with Material\'s "Missing value" message until every field is set', async () => {
    const { onSave, user } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Add new row' }))
    await user.click(screen.getByRole('button', { name: 'Add new value' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Row 1 field')).not.toHaveAttribute('aria-invalid')

    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Missing value in 3 fields.')
    expect(screen.getByRole('alert')).toHaveAttribute('data-qqq-id', 'pivot-editor-error')
    expect(screen.getByLabelText('Row 1 field')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Value 1 function')).toHaveAttribute('aria-invalid', 'true')

    await user.selectOptions(screen.getByLabelText('Value 1 field'), 'Id')
    await user.selectOptions(screen.getByLabelText('Value 1 function'), 'Max')
    expect(screen.getByRole('alert')).toHaveTextContent('Missing value in 1 field.')
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Missing value in 1 field.')

    await user.selectOptions(screen.getByLabelText('Row 1 field'), 'Last Name')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Row 1 field')).not.toHaveAttribute('aria-invalid')
    // back to a clean state: a new empty entry is not flagged until OK is tried again
    await user.click(screen.getByRole('button', { name: 'Add new column' }))
    expect(screen.getByLabelText('Column 1 field')).not.toHaveAttribute('aria-invalid')
    await user.click(screen.getByRole('button', { name: 'Remove column 1' }))
    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(saved(onSave)).toEqual({ rows: ['lastName'], columns: [], values: ['MAX id'] })
  })

  it('reorders with the move buttons, keeping focus on the moved entry', async () => {
    const { onSave, user } = renderDialog(parsePivotDefinition({ rows: [{ fieldName: 'lastName' }, { fieldName: 'firstName' }, { fieldName: 'birthDate' }] }))
    expect(screen.getByRole('button', { name: 'Move row 1 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move row 3 down' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move row 1 down' }))
    expect(screen.getByRole('button', { name: 'Move row 2 down' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Row Last Name moved to position 2 of 3.')
    await user.click(screen.getByRole('button', { name: 'Move row 2 down' }))
    // at the end its "down" button is disabled, so focus moves to its "up" button
    expect(screen.getByRole('button', { name: 'Move row 3 up' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(saved(onSave).rows).toEqual(['firstName', 'birthDate', 'lastName'])
  })

  it('reorders with the arrow keys on the drag handle', async () => {
    const { onSave, user } = renderDialog(parsePivotDefinition({ values: [{ fieldName: 'id', function: 'COUNT' }, { fieldName: 'annualSalary', function: 'SUM' }] }))
    screen.getByRole('button', { name: 'Drag to reorder value 2' }).focus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('button', { name: 'Drag to reorder value 1' })).toHaveFocus()
    expect(screen.getByLabelText('Value 1 field')).toHaveValue('annualSalary')
    await user.keyboard('{ArrowUp}')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByLabelText('Value 2 field')).toHaveValue('annualSalary')
    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(saved(onSave).values).toEqual(['COUNT id', 'SUM annualSalary'])
  })

  it('reorders by dragging within a part, and ignores a drop on another part', async () => {
    const { onSave, user } = renderDialog(parsePivotDefinition({
      rows: [{ fieldName: 'lastName' }, { fieldName: 'firstName' }],
      columns: [{ fieldName: 'birthDate' }, { fieldName: 'homeStateId' }],
    }))
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }
    const rows = list('Rows').getAllByRole('listitem')
    const columnItems = list('Columns').getAllByRole('listitem')
    expect(rows[0]).toHaveAttribute('draggable', 'true')

    fireEvent.dragStart(rows[0], { dataTransfer })
    fireEvent.dragOver(columnItems[1], { dataTransfer })
    fireEvent.drop(columnItems[1], { dataTransfer })
    fireEvent.dragEnd(rows[0], { dataTransfer })
    expect(screen.getByLabelText('Column 1 field')).toHaveValue('birthDate')

    fireEvent.dragStart(columnItems[1], { dataTransfer })
    fireEvent.dragOver(columnItems[0], { dataTransfer })
    fireEvent.drop(columnItems[0], { dataTransfer })
    fireEvent.dragEnd(columnItems[1], { dataTransfer })
    expect(screen.getByLabelText('Column 1 field')).toHaveValue('homeStateId')
    expect(screen.getByLabelText('Row 1 field')).toHaveValue('lastName')

    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(saved(onSave)).toEqual({ rows: ['lastName', 'firstName'], columns: ['homeStateId', 'birthDate'], values: undefined })
  })

  it('Cancel and Escape discard without saving', async () => {
    const { onSave, onCancel, user } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Add new row' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows a saved field that is no longer a report column, and a function the field type does not list', () => {
    renderDialog(parsePivotDefinition({ rows: [{ fieldName: 'email' }], values: [{ fieldName: 'id', function: 'COUNT_NUMS' }] }))
    expect(screen.getByLabelText('Row 1 field')).toHaveValue('email')
    expect(within(screen.getByLabelText('Row 1 field')).getByRole('option', { name: 'Email' })).toBeInTheDocument()
    expect(screen.getByLabelText('Value 1 function')).toHaveValue('COUNT_NUMS')
    expect(within(screen.getByLabelText('Value 1 function')).getByRole('option', { name: 'Count Numbers' })).toBeInTheDocument()
  })

  it('shows but does not allow edits when the form is locked', () => {
    renderDialog(parsePivotDefinition({ rows: [{ fieldName: 'lastName' }] }), { disabled: true })
    expect(screen.getByLabelText('Row 1 field')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove row 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add new row' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(list('Rows').getByRole('listitem')).toHaveAttribute('draggable', 'false')
  })
})
