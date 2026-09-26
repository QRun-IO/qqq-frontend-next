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

import type { QTableMetaData } from '@/types'
import { gotoFieldNames, gotoFilter, gotoOptions, hasGotoFieldNames } from './goto-utils'

const field = (name: string, label: string) => ({ name, label, type: 'STRING' })
const table = (extra: Partial<QTableMetaData> = {}): QTableMetaData => ({
  name: 'bin', label: 'Bin', primaryKeyField: 'id',
  fields: { id: field('id', 'Id'), code: field('code', 'Code'), aisle: field('aisle', 'Aisle'), shelf: field('shelf', 'Shelf') },
  ...extra,
} as unknown as QTableMetaData)

describe('goto-utils', () => {
  it('reads gotoFieldNames from the v1 key and the legacy key', () => {
    const keys = [['code'], ['aisle', 'shelf']]
    expect(gotoFieldNames(table({ supplementalMetaData: { materialDashboard: { gotoFieldNames: keys } } }))).toEqual(keys)
    expect(gotoFieldNames(table({ supplementalTableMetaData: { materialDashboard: { gotoFieldNames: keys } } }))).toEqual(keys)
    expect(hasGotoFieldNames(table({ supplementalMetaData: { materialDashboard: { gotoFieldNames: [] } } }))).toBe(true)
  })

  it('offers no Go To without the setting', () => {
    expect(hasGotoFieldNames(table())).toBe(false)
    expect(hasGotoFieldNames(table({ supplementalMetaData: { materialDashboard: { gotoFieldNames: null } } }))).toBe(false)
    expect(hasGotoFieldNames(table({ supplementalMetaData: { other: { gotoFieldNames: [['code']] } } }))).toBe(false)
    expect(hasGotoFieldNames(undefined)).toBe(false)
  })

  it('builds options: the primary key first, then each key, dropping unknown fields', () => {
    const options = gotoOptions(table({ supplementalMetaData: { materialDashboard: { gotoFieldNames: [['code'], ['aisle', 'missing', 'shelf'], ['missing']] } } }))
    expect(options.map((option) => option.map((f) => f.label))).toEqual([['Id'], ['Code'], ['Aisle', 'Shelf']])
    // a key that already is the primary key is not repeated
    const withPk = gotoOptions(table({ supplementalMetaData: { materialDashboard: { gotoFieldNames: [['code'], ['id']] } } }))
    expect(withPk.map((option) => option.map((f) => f.name))).toEqual([['code'], ['id']])
  })

  it('filters with EQUALS on the fields that have values, or not at all', () => {
    const [, , aisleShelf] = gotoOptions(table({ supplementalMetaData: { materialDashboard: { gotoFieldNames: [['code'], ['aisle', 'shelf']] } } }))
    expect(gotoFilter(aisleShelf, { aisle: ' A ', shelf: '2' })).toEqual({
      criteria: [{ fieldName: 'aisle', operator: 'EQUALS', values: ['A'] }, { fieldName: 'shelf', operator: 'EQUALS', values: ['2'] }],
      booleanOperator: 'AND', skip: 0, limit: 2,
    })
    expect(gotoFilter(aisleShelf, { aisle: 'A', shelf: ' ' })?.criteria).toEqual([{ fieldName: 'aisle', operator: 'EQUALS', values: ['A'] }])
    expect(gotoFilter(aisleShelf, {})).toBeNull()
  })
})
