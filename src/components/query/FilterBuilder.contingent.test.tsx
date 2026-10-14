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

/** @file Filter-context PV requests, including dependent constraints and selected labels. */
import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QFieldMetaData, QQueryFilter, QTableMetaData } from '@/types'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { emptyFilter } from '@/lib/utils/filter-utils'
import { FilterBuilder } from './FilterBuilder'

vi.mock('@/lib/api/possible-values', () => ({ fetchTablePossibleValues: vi.fn() }))
const api = vi.mocked(fetchTablePossibleValues)
const field = (name: string, label: string): QFieldMetaData => ({ name, label, type: 'INTEGER', isRequired: false, isEditable: true, isHidden: false, isHeavy: false, adornments: [] })
const table: QTableMetaData = { name: 'address', label: 'Address', fields: {
  state: field('state', 'State'), city: { ...field('city', 'City'), possibleValueSourceName: 'cities', possibleValueSourceDependsOn: ['state'] },
}, primaryKeyField: 'id', exposedJoins: [], isHidden: false, sections: [], capabilities: [], readPermission: true, insertPermission: true, editPermission: true, deletePermission: true, usesVariants: false, variantTableLabel: '' }

/** Owns a filter so editing State updates the City's input context. */
function Harness({ initial, metadata = table }: { initial: QQueryFilter; metadata?: QTableMetaData }) {
  const [filter, setFilter] = useState(initial)
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={client}><FilterBuilder tableMetaData={metadata} filter={filter} onChange={setFilter} /></QueryClientProvider>
}
beforeEach(() => { vi.clearAllMocks(); api.mockResolvedValue([{ id: 1, label: 'City one' }]) })

describe('contingent filter values', () => {
  it('uses filter context without a dependency criterion, returning all options', async () => {
    render(<Harness initial={{ ...emptyFilter(), criteria: [{ fieldName: 'city', operator: 'EQUALS', values: [] }] }} />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter value for City' }))
    expect(await screen.findByRole('option', { name: 'City one' })).toBeVisible()
    expect(api).toHaveBeenCalledWith('address', 'city', { searchTerm: undefined, useCase: 'filter', formValues: {} })
  })
  it('supplies dependency inputs for both options and selected-label lookups', async () => {
    render(<Harness initial={{ ...emptyFilter(), criteria: [
      { fieldName: 'state', operator: 'EQUALS', values: [2] }, { fieldName: 'city', operator: 'EQUALS', values: [1] },
    ] }} />)
    await waitFor(() => expect(api).toHaveBeenCalledWith('address', 'city', { ids: '1', useCase: 'filter', formValues: { state: 2 } }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter value for City' }))
    await waitFor(() => expect(api).toHaveBeenCalledWith('address', 'city', { searchTerm: undefined, useCase: 'filter', formValues: { state: 2 } }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Filter value for State' }), { target: { value: '3' } })
    await waitFor(() => expect(api).toHaveBeenCalledWith('address', 'city', { ids: '1', useCase: 'filter', formValues: { state: '3' } }))
  })
  it('carries the full filter into nested multi-select inputs', async () => {
    render(<Harness initial={{ ...emptyFilter(), criteria: [{ fieldName: 'state', operator: 'IN', values: [2, 3] }],
      subFilters: [{ ...emptyFilter(), criteria: [{ fieldName: 'city', operator: 'IN', values: [1] }] }],
    }} />)
    await waitFor(() => expect(api).toHaveBeenCalledWith('address', 'city', { ids: '1', useCase: 'filter', formValues: { state: [2, 3] } }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter values for City' }))
    await waitFor(() => expect(api).toHaveBeenCalledWith('address', 'city', { searchTerm: undefined, useCase: 'filter', formValues: { state: [2, 3] } }))
  })
  it('uses only the owning joined table dependency, not a same-named base field', async () => {
    const metadata = { ...table, exposedJoins: [{ label: 'Other', isMany: false, joinTable: { ...table, name: 'other' } }] }
    render(<Harness metadata={metadata} initial={{ ...emptyFilter(), criteria: [
      { fieldName: 'state', operator: 'EQUALS', values: [2] },
      { fieldName: 'other.state', operator: 'EQUALS', values: [3] },
      { fieldName: 'other.city', operator: 'EQUALS', values: [1] },
    ] }} />)
    await waitFor(() => expect(api).toHaveBeenCalledWith('other', 'city', { ids: '1', useCase: 'filter', formValues: { state: 3 } }))
  })
})
