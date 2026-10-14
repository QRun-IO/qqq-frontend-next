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

/** @file Quick-create uses the same real dependent fields as full record forms. */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { QFieldMetaData, QTableMetaData } from '@/types'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { insertRecord } from '@/lib/api/tables'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { RelatedRecordPickerDialog } from './RelatedRecordPickerDialog'

vi.mock('@/lib/api/related-record-picker', () => ({ queryRelatedPicker: vi.fn().mockResolvedValue({ records: [], hasMore: false }), prepareRelatedPicker: vi.fn(), addRelatedPicker: vi.fn(), removeRelatedPicker: vi.fn() }))
vi.mock('@/lib/api/tables', () => ({ insertRecord: vi.fn() }))
vi.mock('@/lib/api/possible-values', () => ({ fetchTablePossibleValues: vi.fn(), fetchProcessPossibleValues: vi.fn(), fetchPossibleValues: vi.fn() }))
vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: vi.fn(), useMetaData: vi.fn(() => ({ data: undefined })) }))
vi.mock('@/lib/hooks/use-saved-views', () => ({ useSavedViews: vi.fn(() => ({ quickViews: [], yourViews: [], sharedViews: [] })) }))
vi.mock('@/lib/context/q-context', () => ({ useQContext: vi.fn(() => ({ userId: 'u1' })), useHelpHelpActive: vi.fn(() => false) }))
vi.mock('@/components/query/FilterBuilder', () => ({ FilterBuilder: () => null }))
vi.mock('./RelatedPickerActions', () => ({ RelatedPickerActions: () => null }))

const field = (name: string, label: string): QFieldMetaData => ({ name, label, type: 'INTEGER', possibleValueSourceName: name, isEditable: true, isRequired: false, isHidden: false, isHeavy: false, adornments: [] })
const table = { name: 'address', label: 'Address', primaryKeyField: 'id', insertPermission: true,
  fields: { country: field('country', 'Country'), state: { ...field('state', 'State'), possibleValueSourceDependsOn: ['country'] } },
  sections: [{ name: 'quick', label: 'Quick', fieldNames: ['country', 'state'], isHidden: false }], quickCreateSectionName: 'quick',
} as unknown as QTableMetaData

describe('related picker contingent quick-create', () => {
  it('uses sibling labels and current quick-create values, clears an invalid B, then submits both fields', async () => {
    vi.mocked(useTableMetaData).mockImplementation(((name: string) => ({ data: name === 'address' ? table : undefined })) as never)
    vi.mocked(fetchTablePossibleValues).mockImplementation(async (_table, field, request) => field === 'country'
      ? [{ id: 1, label: 'USA' }, { id: 2, label: 'Canada' }]
      : request?.ids ? [] : request?.formValues?.country === 1 ? [{ id: 10, label: 'Illinois' }] : [{ id: 20, label: 'Ontario' }])
    vi.mocked(insertRecord).mockResolvedValue({ tableName: 'address', values: { id: 7, country: 2, state: 20 } })
    render(<RelatedRecordPickerDialog tableName="host" picker={{ name: 'address', label: 'Choose Address', mode: 'SINGLE', fieldName: 'addressId', targetTableName: 'address', columns: [], canCreateTarget: true }} onSelect={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: 'New Address' }))
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveAccessibleDescription('Choose Country first')
    await userEvent.click(screen.getByRole('combobox', { name: 'Country' }))
    await userEvent.click(await screen.findByRole('option', { name: 'USA' }))
    await userEvent.click(screen.getByRole('combobox', { name: 'State' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Illinois' }))
    expect(fetchTablePossibleValues).toHaveBeenCalledWith('address', 'state', expect.objectContaining({ formValues: expect.objectContaining({ country: 1 }) }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Country' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Canada' }))
    expect(await screen.findByText("State was cleared because it doesn't match the selected Country")).toBeVisible()
    await userEvent.click(screen.getByRole('combobox', { name: 'State' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Ontario' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(insertRecord).toHaveBeenCalledWith('address', { country: 2, state: 20 }))
  })
})
