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

// Default grid column order follows Material: sections first, then unsectioned fields (QRun-IO/qqq#714)

import { describe, expect, it } from 'vitest'

import type { QTableMetaData } from '@/types'
import { fieldsInSectionOrder, getQueryColumns } from './query-columns'

const table = {
  name: 'thing',
  label: 'Thing',
  primaryKeyField: 'id',
  fields: {
    zeta: { name: 'zeta', label: 'Zeta', type: 'STRING' },
    notes: { name: 'notes', label: 'Notes', type: 'TEXT', isHeavy: true },
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    alpha: { name: 'alpha', label: 'Alpha', type: 'STRING' },
    secret: { name: 'secret', label: 'Secret', type: 'STRING', isHidden: true },
    loose: { name: 'loose', label: 'Loose', type: 'STRING' },
  },
  sections: [
    { name: 'identity', label: 'Identity', tier: 'T1', fieldNames: ['id', 'alpha'] },
    { name: 'more', label: 'More', tier: 'T2', fieldNames: ['zeta', 'alpha', 'ghost', 'notes', 'secret'] },
  ],
} as unknown as QTableMetaData

describe('fieldsInSectionOrder', () => {
  it('lists section fields in section order once, then the fields no section names', () => {
    expect(fieldsInSectionOrder(table).map((field) => field.name)).toEqual(['id', 'alpha', 'zeta', 'notes', 'secret', 'loose'])
  })

  it('keeps metadata order for a table without sections', () => {
    expect(fieldsInSectionOrder({ fields: table.fields }).map((field) => field.name)).toEqual(['zeta', 'notes', 'id', 'alpha', 'secret', 'loose'])
  })
})

describe('getQueryColumns', () => {
  it('uses the section order and drops hidden and heavy fields', () => {
    expect(getQueryColumns(table).map((column) => column.name)).toEqual(['id', 'alpha', 'zeta', 'loose'])
  })
})
