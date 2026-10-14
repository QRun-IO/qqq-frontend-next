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

// Tests for RelatedRecordPickerDialog: SINGLE choose and quick-create, MULTI_CHILD with the
// review step, LINK link/unlink, search, keyboard, errors and accessibility.

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { axe } from 'jest-axe'

import type { QRecord, QRelatedRecordPicker, QTableMetaData } from '@/types'
import { RelatedRecordPickerDialog } from './RelatedRecordPickerDialog'

vi.mock('@/lib/api/related-record-picker', () => ({
  queryRelatedPicker: vi.fn(),
  prepareRelatedPicker: vi.fn(),
  addRelatedPicker: vi.fn(),
  removeRelatedPicker: vi.fn(),
}))
vi.mock('@/lib/api/tables', () => ({ insertRecord: vi.fn() }))
vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: vi.fn(), useMetaData: vi.fn(() => ({ data: undefined })) }))
vi.mock('@/lib/hooks/use-saved-views', () => ({ useSavedViews: vi.fn(() => ({ quickViews: [], yourViews: [], sharedViews: [] })) }))
vi.mock('@/lib/context/q-context', () => ({ useQContext: vi.fn(() => ({ userId: 'u1' })) }))
vi.mock('./DynamicFormField', () => ({
  // the form controls themselves are DynamicFormField's own tests; here a plain labelled input
  DynamicFormField: ({ field, register, idPrefix }: { field: { name: string; label: string }; register: (name: string) => object; idPrefix?: string }) => (
    <label htmlFor={`${idPrefix}-field-${field.name}`}>{field.label}<input id={`${idPrefix}-field-${field.name}`} {...register(field.name)} /></label>
  ),
}))
vi.mock('@/components/query/FilterBuilder', () => ({ FilterBuilder: () => <div data-testid="filter-builder" /> }))

import { addRelatedPicker, prepareRelatedPicker, queryRelatedPicker, removeRelatedPicker } from '@/lib/api/related-record-picker'
import { insertRecord } from '@/lib/api/tables'
import { useTableMetaData } from '@/lib/hooks/use-metadata'

const mockQuery = vi.mocked(queryRelatedPicker)
const mockPrepare = vi.mocked(prepareRelatedPicker)
const mockAdd = vi.mocked(addRelatedPicker)
const mockRemove = vi.mocked(removeRelatedPicker)
const mockInsert = vi.mocked(insertRecord)

const field = (name: string, label: string, type = 'STRING', extra: object = {}) =>
  ({ name, label, type, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra })

const CUSTOMER = {
  name: 'customer', label: 'Customer', primaryKeyField: 'id', insertPermission: true,
  fields: { id: field('id', 'ID', 'INTEGER', { isEditable: false }), name: field('name', 'Name', 'STRING', { isRequired: true }), email: field('email', 'Email'), region: field('region', 'Region') },
  sections: [{ name: 'identity', label: 'Identity', tier: 'T1', fieldNames: ['id', 'name', 'email'] }],
  quickCreateSectionName: 'identity',
} as unknown as QTableMetaData

const LINE = {
  name: 'sales_order_line', label: 'Sales Order Line', primaryKeyField: 'id',
  fields: { quantity: field('quantity', 'Quantity', 'INTEGER'), unitPrice: field('unitPrice', 'Unit Price', 'DECIMAL') },
  sections: [],
} as unknown as QTableMetaData

const customer = (id: number, name: string, region = 'West'): QRecord => ({ tableName: 'customer', recordLabel: name, values: { id, name, email: `${name.toLowerCase()}@x.example`, region } })

const SINGLE: QRelatedRecordPicker = { name: 'customer', label: 'Choose Customer', mode: 'SINGLE', fieldName: 'customerId', targetTableName: 'customer', columns: ['name', 'email', 'region'], previewFields: ['name', 'email'], canCreateTarget: true }
const MULTI: QRelatedRecordPicker = { name: 'addSkus', label: 'Add SKUs', mode: 'MULTI_CHILD', targetTableName: 'customer', childTableName: 'sales_order_line', childTargetFieldName: 'skuId', columns: ['name'], reviewFieldNames: ['quantity', 'unitPrice'], canAddChildren: true }
const LINK: QRelatedRecordPicker = { name: 'tags', label: 'Tags', mode: 'LINK', targetTableName: 'customer', childTableName: 'sales_order_tag', childTargetFieldName: 'tagId', columns: ['name'], canAddChildren: true, canRemoveChildren: true }

const options = () => within(screen.getByRole('listbox')).getAllByRole('option')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useTableMetaData).mockImplementation(((name: string | undefined) => ({ data: name === 'customer' ? CUSTOMER : name === 'sales_order_line' ? LINE : undefined })) as never)
  mockQuery.mockResolvedValue({ records: [customer(1, 'Acme'), customer(2, 'Bolt', 'East')], hasMore: false })
})

describe('RelatedRecordPickerDialog', () => {
  it('SINGLE: lists columns, previews, and selects with Enter', async () => {
    const onSelect = vi.fn()
    render(<RelatedRecordPickerDialog tableName="sales_order" picker={SINGLE} formValues={{ region: 'West' }} onSelect={onSelect} onClose={vi.fn()} />)
    await waitFor(() => expect(options()).toHaveLength(2))
    expect(mockQuery).toHaveBeenCalledWith('sales_order', 'customer', expect.objectContaining({ values: { region: 'West' }, skip: 0 }))
    expect(screen.getByRole('dialog', { name: 'Choose Customer' })).toBeInTheDocument()
    expect(options()[1]).toHaveTextContent('bolt@x.example')

    options()[1].focus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ recordLabel: 'Bolt' }), 2)
  })

  it('SINGLE: debounced search goes to the server', async () => {
    render(<RelatedRecordPickerDialog tableName="sales_order" picker={SINGLE} onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(options()).toHaveLength(2))
    await userEvent.type(screen.getByRole('searchbox'), 'bol')
    await waitFor(() => expect(mockQuery).toHaveBeenLastCalledWith('sales_order', 'customer', expect.objectContaining({ searchTerm: 'bol' })))
  })

  it('SINGLE: the resolved default filter starts the filter', async () => {
    mockQuery.mockResolvedValueOnce({ records: [], hasMore: false, resolvedDefaultFilter: { criteria: [{ fieldName: 'region', operator: 'EQUALS', values: ['West'] }] } })
    render(<RelatedRecordPickerDialog tableName="sales_order" picker={{ ...SINGLE, defaultFilter: { criteria: [] } }} onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(mockQuery).toHaveBeenLastCalledWith('sales_order', 'customer', expect.objectContaining({
      filter: expect.objectContaining({ criteria: [expect.objectContaining({ fieldName: 'region' })] }),
    })))
    expect(screen.getByRole('button', { name: /Filters \(1\)/ })).toBeInTheDocument()
  })

  it('SINGLE: quick-create shows the section fields, inserts, and selects the new record', async () => {
    const onSelect = vi.fn()
    mockInsert.mockResolvedValue(customer(9, 'Nova'))
    render(<RelatedRecordPickerDialog tableName="sales_order" picker={SINGLE} onSelect={onSelect} onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /New Customer/ }))
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByLabelText('Region')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /full create screen/ })).toHaveAttribute('href', '/app/customer/create')
    await userEvent.type(screen.getByLabelText('Name'), 'Nova')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalledWith('customer', { name: 'Nova' }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ recordLabel: 'Nova' }), 9)
  })

  it('SINGLE: quick-create inside a host form never submits the host form', async () => {
    const hostSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    mockInsert.mockResolvedValue(customer(9, 'Nova'))
    render(<form onSubmit={hostSubmit}><RelatedRecordPickerDialog tableName="sales_order" picker={SINGLE} onSelect={vi.fn()} onClose={vi.fn()} /></form>)
    await userEvent.click(await screen.findByRole('button', { name: /New Customer/ }))
    await userEvent.type(screen.getByLabelText('Name'), 'Nova')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(hostSubmit).not.toHaveBeenCalled()
  })

  it('SINGLE: a quick-create error stays in the form', async () => {
    mockInsert.mockRejectedValue(new Error('Missing value for Name'))
    render(<RelatedRecordPickerDialog tableName="sales_order" picker={SINGLE} onSelect={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /New Customer/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Missing value for Name')
  })

  it('MULTI_CHILD: picks several, reviews the rows, then adds them', async () => {
    const onDone = vi.fn()
    mockQuery.mockResolvedValue({ records: [customer(1, 'Acme'), customer(2, 'Bolt')], hasMore: false, linkedIds: ['2'] })
    mockPrepare.mockResolvedValue({
      records: [
        { tableName: 'sales_order_line', values: { salesOrderId: 7, skuId: 1, quantity: 1, unitPrice: 9.5 }, displayValues: { skuId: 'Acme' } },
        { tableName: 'sales_order_line', values: { salesOrderId: 7, skuId: 2, quantity: 1, unitPrice: 4 }, displayValues: { skuId: 'Bolt' } },
      ],
      reviewFieldNames: ['quantity', 'unitPrice'],
    })
    mockAdd.mockResolvedValue({ records: [{ tableName: 'sales_order_line', values: {} }, { tableName: 'sales_order_line', values: {} }] })
    render(<RelatedRecordPickerDialog tableName="sales_order" picker={MULTI} primaryKey={7} onDone={onDone} onClose={vi.fn()} />)
    await waitFor(() => expect(options()).toHaveLength(2))
    expect(within(options()[1]).getByText('Added')).toBeInTheDocument()

    await userEvent.click(options()[0])
    options()[1].focus()
    await userEvent.keyboard(' ')
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next (2)' }))
    expect(mockPrepare).toHaveBeenCalledWith('sales_order', 'addSkus', 7, ['1', '2'])

    const quantities = await screen.findAllByLabelText('Quantity')
    expect(quantities).toHaveLength(2)
    await userEvent.clear(quantities[0])
    await userEvent.type(quantities[0], '5')
    await userEvent.click(screen.getByRole('button', { name: 'Add 2' }))
    await waitFor(() => expect(mockAdd).toHaveBeenCalled())
    const rows = (mockAdd.mock.calls[0][3] as { records: Array<Record<string, unknown>> }).records
    expect(rows[0]).toMatchObject({ skuId: 1, quantity: '5' })
    expect(rows[1]).toMatchObject({ skuId: 2 })
    expect(onDone).toHaveBeenCalledWith({ added: 2, removed: 0 })
  })

  it('MULTI_CHILD: an add error keeps the review open', async () => {
    mockPrepare.mockResolvedValue({ records: [{ tableName: 'sales_order_line', values: { skuId: 1 }, displayValues: { skuId: 'Acme' } }], reviewFieldNames: ['quantity'] })
    mockAdd.mockRejectedValue(new Error('Row 1: Missing value for Quantity'))
    render(<RelatedRecordPickerDialog tableName="sales_order" picker={MULTI} primaryKey={7} onDone={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(options()).toHaveLength(2))
    await userEvent.click(options()[0])
    await userEvent.click(screen.getByRole('button', { name: 'Next (1)' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Add 1' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Row 1')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-step', 'review')
  })

  it('LINK: linked targets are checked; checking links and unchecking unlinks', async () => {
    const onDone = vi.fn()
    mockQuery.mockResolvedValue({ records: [customer(1, 'Acme'), customer(2, 'Bolt')], hasMore: false, linkedIds: ['1'] })
    mockAdd.mockResolvedValue({ records: [{ tableName: 'sales_order_tag', values: {} }] })
    mockRemove.mockResolvedValue(1)
    render(<RelatedRecordPickerDialog tableName="sales_order" picker={LINK} primaryKey={7} onDone={onDone} onClose={vi.fn()} />)
    await waitFor(() => expect(options()).toHaveLength(2))
    expect(options()[0]).toHaveAttribute('aria-selected', 'true')
    expect(options()[1]).toHaveAttribute('aria-selected', 'false')
    await userEvent.click(options()[0])
    await userEvent.click(options()[1])
    expect(screen.getByText('1 to link, 1 to unlink')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ added: 1, removed: 1 }))
    expect(mockAdd).toHaveBeenCalledWith('sales_order', 'tags', 7, { targetIds: ['2'] })
    expect(mockRemove).toHaveBeenCalledWith('sales_order', 'tags', 7, ['1'])
  })

  it('loads more and reports a failed load with a retry', async () => {
    mockQuery.mockResolvedValueOnce({ records: [customer(1, 'Acme')], hasMore: true }).mockResolvedValueOnce({ records: [customer(2, 'Bolt')], hasMore: false })
    render(<RelatedRecordPickerDialog tableName="sales_order" picker={SINGLE} onSelect={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(options()).toHaveLength(2))
    expect(mockQuery).toHaveBeenLastCalledWith('sales_order', 'customer', expect.objectContaining({ skip: 1 }))

    mockQuery.mockRejectedValueOnce(new Error('boom'))
    await userEvent.type(screen.getByRole('searchbox'), 'x')
    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { baseElement } = render(<RelatedRecordPickerDialog tableName="sales_order" picker={MULTI} primaryKey={7} onDone={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(options()).toHaveLength(2))
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
