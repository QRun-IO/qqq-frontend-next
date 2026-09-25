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
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { QWidgetMetaData } from '@/types'
import { RowBuilderWidget } from './RowBuilderWidget'
import type { RowBuilderPayload } from './RowBuilderWidget'

const meta = {
  name: 'accHostRows',
  label: 'Owned Rows',
  hasPermission: true,
  defaultValues: {
    fields: [
      { name: 'name', label: 'Row Name', type: 'STRING' },
      { name: 'quantity', label: 'Row Quantity', type: 'INTEGER' },
    ],
  },
} as QWidgetMetaData
/** The real payload served by `accHostRows?id=1`. */
const payload: RowBuilderPayload = {
  records: [{ values: { name: 'Owned row one', quantity: 3 } }, { values: { name: 'Owned row two', quantity: 0 } }],
  type: 'rowBuilder',
}

describe('RowBuilderWidget', () => {
  it('renders declared field labels as headers and each row, including zero', () => {
    const { container } = render(<RowBuilderWidget widgetMetaData={meta} data={payload} />)
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Row Name', 'Row Quantity'])
    const row = (index: number) => Array.from(container.querySelectorAll(`[data-qqq-id="row-builder-row-accHostRows-${index}"] td`)).map((td) => td.textContent)
    expect(row(0)).toEqual(['Owned row one', '3'])
    expect(row(1)).toEqual(['Owned row two', '0'])
  })

  it('derives columns from the rows when no fields are declared', () => {
    render(<RowBuilderWidget widgetMetaData={{ ...meta, defaultValues: {} }} data={payload} />)
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['name', 'quantity'])
  })

  it('shows No rows when there are none', () => {
    render(<RowBuilderWidget widgetMetaData={meta} data={{ type: 'rowBuilder' }} />)
    expect(screen.getByText('No rows')).toBeInTheDocument()
  })

  it('shows a contained notice for malformed records', () => {
    render(<RowBuilderWidget widgetMetaData={meta} data={{ records: { invalidShape: true } } as unknown as RowBuilderPayload} />)
    expect(screen.getByRole('alert')).toHaveTextContent('not in the expected format')
  })
})
