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

import { describe, expect, it } from 'vitest'

import type { QRelatedRecordPicker, QTableMetaData } from '@/types'
import { childPickersFor, quickCreateFields, recordText, relatedPickerColumns, relatedPickerPreviewFields, singlePickerFor } from './related-record-picker'

const field = (name: string, extra: object = {}) => ({ name, label: name, type: 'STRING', isEditable: true, isHidden: false, isRequired: false, ...extra })

const TABLE = {
  name: 'customer', primaryKeyField: 'id',
  fields: { id: field('id', { isEditable: false }), name: field('name', { isRequired: true }), email: field('email'), region: field('region', { isRequired: true }), secret: field('secret', { isRequired: true, isHidden: true }) },
  sections: [{ name: 'identity', tier: 'T1', fieldNames: ['id', 'name', 'email'] }, { name: 'more', tier: 'T2', fieldNames: ['region'] }],
} as unknown as QTableMetaData

const picker = (extra: Partial<QRelatedRecordPicker>): QRelatedRecordPicker => ({ name: 'p', label: 'P', mode: 'SINGLE', targetTableName: 'customer', ...extra })

describe('related-record-picker utils', () => {
  it('finds the SINGLE picker of a field and the usable child pickers of a list', () => {
    const order = { relatedRecordPickers: [
      picker({ name: 'customer', fieldName: 'customerId' }),
      picker({ name: 'lines', mode: 'MULTI_CHILD', childTableName: 'line', canAddChildren: true }),
      picker({ name: 'denied', mode: 'LINK', childTableName: 'line', canAddChildren: false, canRemoveChildren: false }),
    ] } as unknown as QTableMetaData
    expect(singlePickerFor(order, 'customerId')?.name).toBe('customer')
    expect(singlePickerFor(order, 'other')).toBeUndefined()
    expect(childPickersFor(order, 'line').map((p) => p.name)).toEqual(['lines'])
  })

  it('uses declared columns and preview fields, else the T1 fields, and drops unknown fields', () => {
    expect(relatedPickerColumns(picker({ columns: ['name', 'gone'] }), TABLE)).toEqual(['name'])
    expect(relatedPickerColumns(picker({}), TABLE)).toEqual(['id', 'name', 'email'])
    expect(relatedPickerPreviewFields(picker({ previewFields: ['region'] }), TABLE)).toEqual(['region'])
  })

  it('quick-create shows the section editable fields, else the required editable ones', () => {
    expect(quickCreateFields({ ...TABLE, quickCreateSectionName: 'identity' }).map((f) => f.name)).toEqual(['name', 'email'])
    expect(quickCreateFields(TABLE).map((f) => f.name)).toEqual(['name', 'region'])
  })

  it('reads display values first, then raw values', () => {
    expect(recordText({ tableName: 't', values: { a: 1, b: null }, displayValues: { a: 'One' } }, 'a')).toBe('One')
    expect(recordText({ tableName: 't', values: { a: 1, b: null } }, 'b')).toBe('')
  })
})
