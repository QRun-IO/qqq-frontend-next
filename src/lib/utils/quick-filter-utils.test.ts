/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** @file Basic-mode metadata, representability, and criterion edit tests. */

import { describe, expect, it } from 'vitest'

import { qInstance } from '@/mocks/fixtures/q-instance'
import { emptyFilter } from './filter-utils'
import {
  canFilterWorkAsBasic, defaultQuickFilterOperator, getDefaultQuickFilterFieldNames,
  quickFilterCriterion, reconcileBasicMode, removeQuickFilterCriterion, setQuickFilterCriterion,
} from './quick-filter-utils'

const table = qInstance.tables.person

describe('quick-filter metadata', () => {
  it('uses configured field names and otherwise the T1 section order', () => {
    expect(getDefaultQuickFilterFieldNames(table)).toEqual(['firstName', 'lastName', 'email', 'phone', 'title'])
    expect(getDefaultQuickFilterFieldNames({ ...table, supplementalMetaData: {
      materialDashboard: { defaultQuickFilterFieldNames: ['lastName', 'firstName', 'lastName', 'missing'] },
    } })).toEqual(['lastName', 'firstName'])
  })

  it('chooses the Material initial operator by field kind', () => {
    expect(defaultQuickFilterOperator({ type: 'STRING' })?.operator).toBe('EQUALS')
    expect(defaultQuickFilterOperator({ type: 'STRING', possibleValueSourceName: 'people' })?.operator).toBe('IN')
    expect(defaultQuickFilterOperator({ type: 'DATE_TIME' })?.operator).toBe('GREATER_THAN')
    expect(defaultQuickFilterOperator({ type: 'BOOLEAN' })).toBeUndefined()
  })
})

describe('basic-mode protection', () => {
  it('rejects repeated fields, nested groups and OR between conditions with reasons', () => {
    const first = { fieldName: 'firstName', operator: 'EQUALS' as const, values: ['Avery'] }
    expect(canFilterWorkAsBasic(table, { ...emptyFilter(), criteria: [first] }).canWorkAsBasic).toBe(true)
    expect(canFilterWorkAsBasic(table, { ...emptyFilter(), criteria: [first, first] }).reasons).toContain('Filter contains more than 1 condition for the field: First Name')
    expect(canFilterWorkAsBasic(table, { ...emptyFilter(), criteria: [first], subFilters: [emptyFilter()] }).reasons).toContain('Filter contains sub-filters.')
    expect(canFilterWorkAsBasic(table, { ...emptyFilter(), criteria: [first, { ...first, fieldName: 'lastName' }], booleanOperator: 'OR' }).reasons).toContain("Filter uses the 'OR' operator.")
  })

  it('adds URL/view criteria as chips and switches complex filters to Advanced', () => {
    const criterion = { fieldName: 'id', operator: 'EQUALS' as const, values: [2] }
    const state = { mode: 'basic' as const, quickFilterFieldNames: [] }
    expect(reconcileBasicMode(table, { ...emptyFilter(), criteria: [criterion] }, state, ['firstName'])).toEqual({ mode: 'basic', quickFilterFieldNames: ['id'] })
    expect(reconcileBasicMode(table, { ...emptyFilter(), criteria: [criterion], subFilters: [emptyFilter()] }, state, ['firstName']).mode).toBe('advanced')
  })
})

describe('quick-filter edits', () => {
  it('replaces one field without losing another, and clearing removes only that field', () => {
    const initial = { ...emptyFilter(), booleanOperator: 'OR' as const, criteria: [{ fieldName: 'firstName', operator: 'EQUALS' as const, values: ['Avery'] }] }
    const withLastName = setQuickFilterCriterion(initial, { fieldName: 'lastName', operator: 'EQUALS', values: ['Smith'] })
    expect(withLastName.booleanOperator).toBe('AND')
    expect(withLastName.criteria).toHaveLength(2)
    expect(removeQuickFilterCriterion(withLastName, 'firstName').criteria).toEqual([{ fieldName: 'lastName', operator: 'EQUALS', values: ['Smith'] }])
    expect(initial.criteria).toHaveLength(1)
  })

  it('marks a backend-only operator as too complex for a quick editor', () => {
    const filter = { ...emptyFilter(), criteria: [{ fieldName: 'firstName', operator: 'LIKE' as const, values: ['A%'] }] }
    expect(quickFilterCriterion(filter, 'firstName', table.fields.firstName)).toEqual({ kind: 'tooComplex' })
  })
})
