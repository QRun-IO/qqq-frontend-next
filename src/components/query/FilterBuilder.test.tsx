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

// Regression tests for the FilterBuilder (#649)

import React, { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { QFieldMetaData, QQueryFilter, QTableMetaData } from '@/types'
import { emptyFilter } from '@/lib/utils/filter-utils'
import { FilterBuilder, buildFilterFields } from './FilterBuilder'

const field = (name: string, label: string, type: QFieldMetaData['type']): QFieldMetaData => ({
  name, label, type, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [],
})

const table: QTableMetaData = {
  name: 'item', label: 'Item', isHidden: false, primaryKeyField: 'id', sections: [], capabilities: [], readPermission: true,
  insertPermission: true, editPermission: true, deletePermission: true, usesVariants: false, variantTableLabel: '',
  fields: { name: field('name', 'Name', 'STRING'), active: field('active', 'Active', 'BOOLEAN'), when: field('when', 'When', 'DATE') },
  exposedJoins: [{ label: 'Owner', isMany: false, joinTable: { name: 'person', label: 'Person', readPermission: true, fields: { firstName: field('firstName', 'First Name', 'STRING') } } as unknown as QTableMetaData }],
}

let latest: QQueryFilter = emptyFilter()

function Harness({ initial }: { initial: QQueryFilter }) {
  const [filter, setFilter] = useState(initial)
  latest = filter
  return (
    <QueryClientProvider client={new QueryClient()}>
      <FilterBuilder tableMetaData={table} filter={filter} onChange={(f) => { latest = f; setFilter(f) }} />
    </QueryClientProvider>
  )
}

describe('FilterBuilder', () => {
  it('offers base and exposed-join fields, sorted by label within their table', () => {
    expect(buildFilterFields(table).map((f) => `${f.name}:${f.label}`)).toEqual([
      'active:Active', 'name:Name', 'when:When', 'person.firstName:Owner: First Name',
    ])
  })

  it('keeps focus in a value input while typing (rows are not remounted per keystroke)', async () => {
    render(<Harness initial={{ ...emptyFilter(), criteria: [{ fieldName: 'name', operator: 'CONTAINS', values: [] }] }} />)
    const input = screen.getByLabelText('Filter value for Name')
    await userEvent.click(input)
    await userEvent.keyboard('Widget')
    expect(screen.getByLabelText('Filter value for Name')).toHaveFocus()
    expect(latest.criteria[0].values).toEqual(['Widget'])
  })

  it('keeps the implied value of boolean yes/no options when re-selected', async () => {
    render(<Harness initial={{ ...emptyFilter(), criteria: [{ fieldName: 'active', operator: 'EQUALS', values: [true] }] }} />)
    await userEvent.selectOptions(screen.getByLabelText('Filter operator'), 'equals no')
    expect(latest.criteria[0]).toEqual({ fieldName: 'active', operator: 'EQUALS', values: [false] })
    await userEvent.selectOptions(screen.getByLabelText('Filter operator'), 'equals yes')
    expect(latest.criteria[0].values).toEqual([true])
    expect(screen.queryByLabelText(/^Filter value/)).not.toBeInTheDocument()
  })

  it('stores relative date expressions in the backend class format', async () => {
    render(<Harness initial={{ ...emptyFilter(), criteria: [{ fieldName: 'when', operator: 'GREATER_THAN', values: [] }] }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Relative date for When' }))
    await userEvent.clear(screen.getByLabelText('Amount'))
    await userEvent.type(screen.getByLabelText('Amount'), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(latest.criteria[0].values).toEqual([{ type: 'NowWithOffset', operator: 'MINUS', amount: 7, timeUnit: 'DAYS' }])
    expect(screen.getByText('7 days ago')).toBeVisible()
  })

  it('renders a backend-only operator from a link without crashing', () => {
    render(<Harness initial={{ ...emptyFilter(), criteria: [{ fieldName: 'name', operator: 'LIKE', values: ['A%'] }] }} />)
    expect((screen.getByLabelText('Filter operator') as HTMLSelectElement).selectedOptions[0].textContent).toBe('is like')
    expect(screen.getByLabelText('Filter value for Name')).toHaveValue('A%')
  })
})
