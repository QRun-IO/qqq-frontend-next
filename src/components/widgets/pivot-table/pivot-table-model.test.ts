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

import { describe, it, expect } from 'vitest'

import type { QFieldMetaData, QTableMetaData } from '@/types'
import {
  clonePivotDefinition,
  countMissingValues,
  findPivotField,
  functionsForField,
  hasPivotEntries,
  missingValueMessage,
  moveItem,
  nextPivotKey,
  parsePivotDefinition,
  PIVOT_EDIT_FUNCTIONS,
  pivotFieldOptions,
  reportColumnFieldNames,
  serializePivotDefinition,
} from './pivot-table-model'

const field = (name: string, label: string, type: string, extra: Partial<QFieldMetaData> = {}) => ({ name, label, type, ...extra }) as QFieldMetaData
const state = { name: 'state', label: 'State', fields: { name: field('name', 'Name', 'STRING'), code: field('code', 'Code', 'STRING') } } as unknown as QTableMetaData
const person = {
  name: 'person',
  label: 'Person',
  fields: {
    lastName: field('lastName', 'Last Name', 'STRING'),
    id: field('id', 'Id', 'INTEGER'),
    annualSalary: field('annualSalary', 'Annual Salary', 'DECIMAL'),
    email: field('email', 'Email', 'STRING'),
  },
  exposedJoins: [{ label: 'State', isMany: false, joinTable: state }],
} as unknown as QTableMetaData

describe('pivot table model', () => {
  it('parses a saved definition, keeping keys and other properties, and giving keys to entries without', () => {
    const definition = parsePivotDefinition({
      rows: [{ fieldName: 'lastName', showTotals: true }],
      columns: [{ fieldName: 'id', key: 7, function: 'SUM' }],
      values: [{ fieldName: 'id', function: 'COUNT' }, { fieldName: null }],
      other: 'kept',
    })!
    expect(definition.extra).toEqual({ other: 'kept' })
    expect(definition.rows).toEqual([{ key: expect.any(Number), fieldName: 'lastName', extra: { showTotals: true } }])
    expect(definition.columns).toEqual([{ key: 7, fieldName: 'id', extra: { function: 'SUM' } }])
    expect(definition.values).toEqual([
      { key: expect.any(Number), fieldName: 'id', function: 'COUNT', extra: {} },
      { key: expect.any(Number), fieldName: null, function: null, extra: {} },
    ])
    expect(definition.values![0].key).not.toBe(definition.values![1].key)
  })

  it('treats no definition as empty and rejects shapes that are not definitions', () => {
    expect(parsePivotDefinition(undefined)).toEqual({ extra: {} })
    expect(parsePivotDefinition(null)).toEqual({ extra: {} })
    expect(parsePivotDefinition({ rows: null })).toEqual({ extra: {} })
    expect(parsePivotDefinition([])).toBeUndefined()
    expect(parsePivotDefinition({ rows: { invalidShape: true } })).toBeUndefined()
    expect(parsePivotDefinition({ values: ['id'] })).toBeUndefined()
    expect(parsePivotDefinition({ columns: [{ fieldName: 3 }] })).toBeUndefined()
  })

  it('serializes in the shape Material writes: parts it has, each entry with its key', () => {
    const definition = parsePivotDefinition({ rows: [{ fieldName: 'lastName', key: 1, showTotals: false }], values: [{ fieldName: 'id', function: 'SUM', key: 2 }], other: 1 })!
    expect(JSON.parse(serializePivotDefinition(definition))).toEqual({
      other: 1,
      rows: [{ fieldName: 'lastName', showTotals: false, key: 1 }],
      values: [{ fieldName: 'id', function: 'SUM', key: 2 }],
    })
    expect(serializePivotDefinition({ extra: {}, columns: [] })).toBe('{"columns":[]}')
  })

  it('copies a definition so changes to the copy leave the original alone', () => {
    const original = parsePivotDefinition({ rows: [{ fieldName: 'lastName', key: 1 }] })!
    const copy = clonePivotDefinition(original)
    copy.rows![0].fieldName = 'id'
    copy.rows!.push({ key: 2, fieldName: null, extra: {} })
    expect(original.rows).toEqual([{ key: 1, fieldName: 'lastName', extra: {} }])
    expect(clonePivotDefinition({ extra: {} })).toEqual({ extra: {} })
  })

  it('knows whether a definition has entries', () => {
    expect(hasPivotEntries({ extra: {} })).toBe(false)
    expect(hasPivotEntries({ extra: {}, rows: [], columns: [], values: [] })).toBe(false)
    expect(hasPivotEntries({ extra: {}, values: [{ key: 1, fieldName: null, function: null, extra: {} }] })).toBe(true)
  })

  it('offers the aggregate functions Material allows for each field type', () => {
    expect(functionsForField(field('a', 'A', 'STRING'))).toEqual(['COUNT'])
    for (const type of ['BOOLEAN', 'BLOB', 'HTML', 'PASSWORD', 'TEXT', 'TIME']) expect(functionsForField(field('a', 'A', type))).toEqual(['COUNT'])
    expect(functionsForField(field('a', 'A', 'DATE'))).toEqual(['COUNT', 'AVERAGE', 'MAX', 'MIN'])
    expect(functionsForField(field('a', 'A', 'DATE_TIME'))).toEqual(['COUNT', 'AVERAGE', 'MAX', 'MIN'])
    expect(functionsForField(field('a', 'A', 'DECIMAL'))).toEqual(PIVOT_EDIT_FUNCTIONS)
    expect(functionsForField(field('a', 'A', 'INTEGER'))).toEqual(['SUM', 'COUNT', 'AVERAGE', 'MAX', 'MIN', 'PRODUCT', 'STD_DEV', 'STD_DEVP', 'VAR', 'VARP'])
    // a field with a possible-value source counts as a string; unlisted types and no field get every function
    expect(functionsForField(field('a', 'A', 'INTEGER', { possibleValueSourceName: 'state' }))).toEqual(['COUNT'])
    expect(functionsForField(field('a', 'A', 'LONG'))).toEqual(PIVOT_EDIT_FUNCTIONS)
    expect(functionsForField(undefined)).toEqual(PIVOT_EDIT_FUNCTIONS)
  })

  it('finds fields of the table and of its exposed joins', () => {
    expect(findPivotField(person, 'id')?.label).toBe('Id')
    expect(findPivotField(person, 'state.code')?.label).toBe('Code')
    expect(findPivotField(person, 'state.missing')).toBeUndefined()
    expect(findPivotField(person, 'missing')).toBeUndefined()
    expect(findPivotField(person, null)).toBeUndefined()
    expect(findPivotField(undefined, 'id')).toBeUndefined()
  })

  it('reads the visible report columns as the backend does', () => {
    expect(reportColumnFieldNames({ columns: [{ name: 'id', isVisible: true }, { name: 'email', isVisible: false }, { name: 'lastName' }, { name: '__checked__' }, { name: 'id' }] }))
      .toEqual(['id', 'lastName'])
    expect(reportColumnFieldNames(['id', 'state.code'])).toEqual(['id', 'state.code'])
    expect(reportColumnFieldNames(undefined)).toEqual([])
    expect(reportColumnFieldNames({ columns: 'bad' })).toEqual([])
    expect(reportColumnFieldNames({ columns: [{ isVisible: true }, 4] })).toEqual([])
  })

  it('offers only the report columns, sorted by label per table, with join fields prefixed and grouped', () => {
    const options = pivotFieldOptions(person, ['id', 'lastName', 'annualSalary', 'state.name', 'state.code'])
    expect(options.map((option) => [option.fieldName, option.label, option.group])).toEqual([
      ['annualSalary', 'Annual Salary', 'Person fields'],
      ['id', 'Id', 'Person fields'],
      ['lastName', 'Last Name', 'Person fields'],
      ['state.code', 'Code', 'State fields'],
      ['state.name', 'Name', 'State fields'],
    ])
    expect(pivotFieldOptions(person, [])).toHaveLength(6)
  })

  it('counts missing fields and functions, with Material\'s message', () => {
    expect(countMissingValues({
      extra: {},
      rows: [{ key: 1, fieldName: null, extra: {} }, { key: 2, fieldName: 'id', extra: {} }],
      columns: [{ key: 3, fieldName: null, extra: {} }],
      values: [{ key: 4, fieldName: null, function: null, extra: {} }, { key: 5, fieldName: 'id', function: 'SUM', extra: {} }],
    })).toBe(4)
    expect(countMissingValues({ extra: {} })).toBe(0)
    expect(missingValueMessage(1)).toBe('Missing value in 1 field.')
    expect(missingValueMessage(3)).toBe('Missing value in 3 fields.')
  })

  it('moves list entries and hands out increasing keys', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    const first = nextPivotKey()
    expect(nextPivotKey()).toBe(first + 1)
  })
})
