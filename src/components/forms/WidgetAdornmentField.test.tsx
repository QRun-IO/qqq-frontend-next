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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QContextProvider } from '@/lib/context/q-context'
import { useForm, useWatch } from 'react-hook-form'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { QFieldMetaData, QTableMetaData, QWidgetMetaData } from '@/types'

vi.mock('@/lib/hooks/use-metadata', () => ({
  useMetaData: () => ({ data: { widgets: { fieldFilter: widget } } }),
  useTableMetaData: () => ({ data: table }),
}))
vi.mock('@/lib/hooks/use-widget', () => ({ useWidget: vi.fn(() => ({ data: {
  type: 'filterAndColumnsSetup', tableName: 'person', hideColumns: true, hidePreview: true,
} })) }))
vi.mock('@/lib/hooks/use-filter-setup', () => ({
  useApiTableMetaData: () => ({ data: undefined }),
  useFilterSetupPreview: () => ({ records: [], totalCount: 0, isLoading: false, error: null }),
}))

import { useWidget } from '@/lib/hooks/use-widget'
import { DynamicFormField } from './DynamicFormField'

const widget = { name: 'fieldFilter', label: 'Field filter', type: 'filterAndColumnsSetup', hasPermission: true } as QWidgetMetaData
const table = { name: 'person', label: 'Person', primaryKeyField: 'id', fields: {
  id: { name: 'id', label: 'Id', type: 'INTEGER' },
  firstName: { name: 'firstName', label: 'First Name', type: 'STRING' },
} } as unknown as QTableMetaData
const field = {
  name: 'queryFilterJson_2', label: 'Report filter', type: 'STRING', isRequired: false,
  isEditable: true, isHeavy: false, isHidden: false,
  adornments: [{ type: 'WIDGET', values: { widgetName: 'fieldFilter' } }],
} as QFieldMetaData

function HostForm() {
  const form = useForm<Record<string, unknown>>({ defaultValues: {
    tableName: 'person', queryFilterJson_2: '{}', columnsJson: '',
  } })
  const values = useWatch({ control: form.control })
  return <>
    <DynamicFormField field={field} register={form.register} control={form.control} errors={form.formState.errors} />
    <output data-testid="values">{JSON.stringify(values)}</output>
  </>
}

describe('WIDGET field adornment', () => {
  it('requests the field-specific widget and writes only its indexed field back to the host', async () => {
    const user = userEvent.setup()
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><QContextProvider><HostForm /></QContextProvider></QueryClientProvider>)
    expect(vi.mocked(useWidget)).toHaveBeenCalledWith('fieldFilter', expect.objectContaining({
      tableName: 'person', __formFieldAsWidget_FieldName: 'queryFilterJson_2',
    }), expect.anything())

    await user.click(screen.getByRole('button', { name: 'Edit Filters' }))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'firstName')
    await user.click(screen.getByRole('button', { name: 'OK' }))

    const values = JSON.parse(screen.getByTestId('values').textContent ?? '{}') as Record<string, string>
    expect(JSON.parse(values.queryFilterJson_2).orderBys).toEqual([{ fieldName: 'firstName', isAscending: true }])
    expect(values.columnsJson).toBe('')
  })
})
