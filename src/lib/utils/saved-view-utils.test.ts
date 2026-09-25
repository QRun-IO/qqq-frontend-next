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

// Tests for saved view (Material RecordQueryView) conversion and query columns

import { describe, it, expect } from 'vitest'

import type { QFieldMetaData, QTableMetaData } from '@/types'
import { emptyFilter } from './filter-utils'
import { getQueryColumns, orderColumns, hasCapability } from './query-columns'
import { buildViewJson, diffViews, isColumnVisible, parseViewJson, viewToState, type ViewState } from './saved-view-utils'

const field = (name: string, label: string, extra: Partial<QFieldMetaData> = {}): QFieldMetaData => ({
  name, label, type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra,
})

const table: QTableMetaData = {
  name: 'pet', label: 'Pet', isHidden: false, primaryKeyField: 'id', sections: [], capabilities: ['TABLE_QUERY'], readPermission: true,
  insertPermission: true, editPermission: true, deletePermission: true, usesVariants: false, variantTableLabel: '',
  fields: { id: field('id', 'Id', { type: 'INTEGER' }), name: field('name', 'Name'), secret: field('secret', 'Secret', { isHidden: true }), doc: field('doc', 'Doc', { isHeavy: true, type: 'TEXT' }) },
  exposedJoins: [{ label: 'Owner', isMany: false, joinTable: { name: 'person', label: 'Person', readPermission: true, fields: { firstName: field('firstName', 'First Name') } } as unknown as QTableMetaData }],
}

const state = (overrides: Partial<ViewState> = {}): ViewState => ({
  userFilter: { ...emptyFilter(), criteria: [{ fieldName: 'name', operator: 'CONTAINS', values: ['Co'] }, { fieldName: 'id', operator: 'EQUALS', values: [] }] },
  sortOrder: [{ fieldName: 'name', isAscending: true }],
  columnVisibility: { 'person.firstName': true, name: false },
  columnOrder: ['person.firstName', 'id'],
  columnWidths: { id: 90 },
  pageSize: 50,
  filterMode: 'advanced',
  ...overrides,
})

describe('query columns', () => {
  it('lists visible base fields and readable join fields with Material labels', () => {
    expect(getQueryColumns(table).map((c) => `${c.name}|${c.label}`)).toEqual(['id|Id', 'name|Name', 'person.firstName|Owner: First Name'])
  })

  it('orders columns by a saved order, keeping unknown ones after', () => {
    expect(orderColumns(getQueryColumns(table), ['person.firstName']).map((c) => c.name)).toEqual(['person.firstName', 'id', 'name'])
  })

  it('hides join columns by default', () => {
    expect(isColumnVisible('name', {})).toBe(true)
    expect(isColumnVisible('person.firstName', {})).toBe(false)
    expect(isColumnVisible('person.firstName', { 'person.firstName': true })).toBe(true)
  })

  it('reads capabilities (tables without a list are fully capable)', () => {
    expect(hasCapability(table, 'TABLE_QUERY')).toBe(true)
    expect(hasCapability(table, 'TABLE_EXPORT')).toBe(false)
    expect(hasCapability({ ...table, capabilities: undefined as unknown as QTableMetaData['capabilities'] }, 'TABLE_EXPORT')).toBe(true)
  })
})

describe('saved view JSON', () => {
  it('builds Material RecordQueryView documents without incomplete criteria', () => {
    const view = buildViewJson(table, state(), { queryFilter: {}, quickFilterFieldNames: ['name'] })
    expect(view.queryFilter).toEqual({
      criteria: [{ fieldName: 'name', operator: 'CONTAINS', values: ['Co'] }],
      subFilters: [],
      booleanOperator: 'AND',
      orderBys: [{ fieldName: 'name', isAscending: true }],
    })
    expect(view.queryColumns?.columns).toEqual([
      { name: '__check__', isVisible: true, width: 100, pinned: 'left' },
      { name: 'person.firstName', isVisible: true, width: 150 },
      { name: 'id', isVisible: true, width: 90, pinned: 'left' },
      { name: 'name', isVisible: false, width: 150 },
    ])
    expect(view.rowsPerPage).toBe(50)
    expect(view.mode).toBe('advanced')
    expect(view.quickFilterFieldNames).toEqual(['name'])
  })

  it('round-trips through the screen state and ignores unknown columns', () => {
    const parsed = parseViewJson(JSON.stringify({
      ...buildViewJson(table, state()),
      queryColumns: { columns: [...buildViewJson(table, state()).queryColumns!.columns, { name: 'gone', isVisible: true, width: 10 }] },
    }))
    const restored = viewToState(table, parsed, 25, [10, 25, 50])
    expect(restored.userFilter.criteria).toEqual([{ fieldName: 'name', operator: 'CONTAINS', values: ['Co'] }])
    expect(restored.sortOrder).toEqual([{ fieldName: 'name', isAscending: true }])
    expect(restored.columnOrder).toEqual(['person.firstName', 'id', 'name'])
    expect(restored.columnVisibility).toEqual({ 'person.firstName': true, id: true, name: false })
    expect(restored.pageSize).toBe(50)
    expect(restored.filterMode).toBe('advanced')
  })

  it('tolerates partial or broken documents (a Material view with only a filter)', () => {
    const restored = viewToState(table, parseViewJson('{"queryFilter":{"criteria":[{"fieldName":"name","operator":"EQUALS","values":["Coco"]}]},"rowsPerPage":33}'), 25, [10, 25, 50])
    expect(restored.userFilter.criteria).toHaveLength(1)
    expect(restored.pageSize).toBe(25)
    expect(restored.columnOrder).toEqual([])
    expect(parseViewJson('not json').queryFilter).toEqual({})
  })

  it('reports unsaved changes against the stored view', () => {
    const stored = buildViewJson(table, state())
    expect(diffViews(table, stored, buildViewJson(table, state()))).toEqual([])
    expect(diffViews(table, stored, buildViewJson(table, state({ sortOrder: [] })))).toEqual(['Changed the sort'])
    expect(diffViews(table, stored, buildViewJson(table, state({ columnVisibility: {} })))).toEqual(['Changed the columns'])
    expect(diffViews(table, stored, buildViewJson(table, state({ userFilter: emptyFilter() })))).toEqual(['Changed the filter'])
  })
})
