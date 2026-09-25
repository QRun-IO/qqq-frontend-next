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
import { DynamicFormWidget } from './DynamicFormWidget'
import type { DynamicFormPayload } from './DynamicFormWidget'

const meta = { name: 'accHostDynamicForm', label: 'Owned Dynamic Form', hasPermission: true } as QWidgetMetaData
/** The real payload served by `accHostDynamicForm?id=1`. */
const payload: DynamicFormPayload = {
  fieldList: [
    { name: 'owner', label: 'Owner', type: 'STRING' },
    { name: 'zero', label: 'Zero', type: 'INTEGER' },
  ],
  recordOfFieldValues: { values: { owner: 'Owned owner one', zero: 0 } },
  noFieldsMessage: 'No owned fields',
  type: 'dynamicForm',
}

describe('DynamicFormWidget', () => {
  it('renders each field label with its value, including zero', () => {
    const { container } = render(<DynamicFormWidget widgetMetaData={meta} data={payload} />)
    const field = (name: string) => container.querySelector(`[data-qqq-id="dynamic-form-field-accHostDynamicForm-${name}"]`)
    expect(field('owner')?.querySelector('dt')?.textContent).toBe('Owner')
    expect(field('owner')?.querySelector('dd')?.textContent).toBe('Owned owner one')
    expect(field('zero')?.querySelector('dd')?.textContent).toBe('0')
  })

  it('shows an em dash for missing values and Yes/No for booleans', () => {
    const data: DynamicFormPayload = {
      fieldList: [{ name: 'note', label: 'Note', type: 'STRING' }, { name: 'active', label: 'Active', type: 'BOOLEAN' }],
      recordOfFieldValues: { values: { note: null, active: false } },
    }
    const { container } = render(<DynamicFormWidget widgetMetaData={meta} data={data} />)
    const values = Array.from(container.querySelectorAll('dd')).map((dd) => dd.textContent)
    expect(values).toEqual(['—', 'No'])
  })

  it('reads merged values from the hosting record field', () => {
    const data: DynamicFormPayload = { fieldList: [{ name: 'region', label: 'Region' }], mergedDynamicFormValuesIntoFieldName: 'inputValues' }
    render(<DynamicFormWidget widgetMetaData={meta} data={data} recordContext={{ tableName: 'scheduledReport', record: { tableName: 'scheduledReport', values: { inputValues: '{"region":"North"}' } } }} />)
    expect(screen.getByText('North')).toBeInTheDocument()
  })

  it('shows the no-fields message', () => {
    render(<DynamicFormWidget widgetMetaData={meta} data={{ ...payload, fieldList: [] }} />)
    expect(screen.getByText('No owned fields')).toBeInTheDocument()
  })

  it('renders nothing when there are no fields and no message', () => {
    const { container } = render(<DynamicFormWidget widgetMetaData={meta} data={{ type: 'dynamicForm', fieldList: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a contained notice for a malformed field list', () => {
    render(<DynamicFormWidget widgetMetaData={meta} data={{ fieldList: { invalidShape: true } } as unknown as DynamicFormPayload} />)
    expect(screen.getByRole('alert')).toHaveTextContent('not in the expected format')
  })
})
