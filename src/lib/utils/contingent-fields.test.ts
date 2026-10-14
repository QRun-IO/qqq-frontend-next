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

/** @file Dependency metadata, empty values and query constraint tests. */
import { describe, expect, it } from 'vitest'

import type { QFieldMetaData, QQueryFilter } from '@/types'
import { dependencyBehavior, dependencyValues, filterDependencyValues, getDependencies, missingDependencies } from './contingent-fields'

const dependent = { possibleValueSourceDependsOn: ['countryId', 'stateId'] }
const state = { name: 'stateId', label: 'State / province' } as QFieldMetaData
const country = { name: 'countryId', label: 'Country' } as QFieldMetaData
const fields = { countryId: country, stateId: state }
const filter = (criteria: QQueryFilter['criteria'], subFilters: QQueryFilter[] = [], booleanOperator: 'AND' | 'OR' = 'AND'): QQueryFilter => ({ criteria, subFilters, booleanOperator, orderBys: [], skip: 0, limit: 25 })

describe('contingent field helpers', () => {
  it('uses explicit dependencies, removing duplicates', () => {
    expect(getDependencies({ possibleValueSourceDependsOn: ['a', 'a', 'b'] })).toEqual(['a', 'b'])
    expect(getDependencies({})).toEqual([])
  })
  it('derives legacy inputs recursively, ignoring processValues and non-values text', () => {
    const legacy = filter([{ fieldName: '${input.notAValue}', operator: 'EQUALS', values: ['${input.countryId}', '${processValues.ignored}', 'prefix ${input.stateId}'] }], [
      filter([], [filter([{ fieldName: 'cityId', operator: 'IN', values: ['${input.countryId}', '${input.cityId}'] }])]),
    ])
    expect(getDependencies({ possibleValueSourceFilter: legacy })).toEqual(['countryId', 'stateId', 'cityId'])
    expect(getDependencies({ possibleValueSourceDependsOn: [], possibleValueSourceFilter: legacy })).toEqual([])
  })
  it('supports structured legacy criterion values', () => {
    expect(getDependencies({ possibleValueSourceFilter: { criteria: [{ fieldName: 'a', values: [{ value: '${input.parent}' }] }] } } as unknown as QFieldMetaData)).toEqual(['parent'])
  })
  it('defaults absent and unknown behavior to disable', () => {
    expect(dependencyBehavior({})).toBe('DISABLE_UNTIL_SET')
    expect(dependencyBehavior({ possibleValueSourceDependencyBehavior: 'FUTURE' } as unknown as QFieldMetaData)).toBe('DISABLE_UNTIL_SET')
    expect(dependencyBehavior({ possibleValueSourceDependencyBehavior: 'SHOW_ALL_UNTIL_SET' })).toBe('SHOW_ALL_UNTIL_SET')
  })
  it.each([{ value: '' }, { value: null }, { value: undefined }, { value: [] }])('treats $value as missing and resolves labels', ({ value }) => {
    expect(missingDependencies(dependent, { countryId: 0, stateId: value }, fields)).toEqual([{ name: 'stateId', label: 'State / province' }])
  })
  it.each([{ value: 0 }, { value: false }, { value: '0' }, { value: [1] }])('accepts $value as set', ({ value }) => {
    expect(missingDependencies(dependent, { countryId: value, stateId: value }, fields)).toEqual([])
  })
  it('provides a name fallback and preserves only dependency values', () => {
    expect(missingDependencies(dependent, {})).toEqual([{ name: 'countryId', label: 'countryId' }, { name: 'stateId', label: 'stateId' }])
    expect(dependencyValues(dependent, { countryId: 1, label: 'Ignored', stateId: [2, 3] })).toEqual({ countryId: 1, stateId: [2, 3] })
    expect(dependencyValues({}, { countryId: 1 })).toEqual({})
  })
  it('extracts EQUALS and IN from nested AND groups', () => {
    expect(filterDependencyValues(dependent, filter([{ fieldName: 'countryId', operator: 'EQUALS', values: [1] }], [filter([{ fieldName: 'stateId', operator: 'IN', values: [2, 3] }])]))).toEqual({ countryId: 1, stateId: [2, 3] })
  })
  it('does not narrow for missing criteria, non-equality operators or expressions', () => {
    expect(filterDependencyValues(dependent, undefined)).toEqual({})
    expect(filterDependencyValues(dependent, filter([
      { fieldName: 'countryId', operator: 'EQUALS', values: [] },
      { fieldName: 'stateId', operator: 'NOT_EQUALS', values: [3] },
      { fieldName: 'stateId', operator: 'EQUALS', values: [{ type: 'Now' }] },
      { fieldName: 'countryId', operator: 'EQUALS', values: [1, 2] },
    ]))).toEqual({})
  })
  it('ignores ambiguous OR branches but retains outer AND constraints', () => {
    expect(filterDependencyValues(dependent, filter([{ fieldName: 'countryId', operator: 'EQUALS', values: [1] }], [filter([{ fieldName: 'stateId', operator: 'EQUALS', values: [2] }], [], 'OR')]))).toEqual({ countryId: 1 })
  })
  it('intersects repeated AND criteria without overwriting constraints', () => {
    expect(filterDependencyValues(dependent, filter([
      { fieldName: 'stateId', operator: 'IN', values: [2, 3] },
      { fieldName: 'stateId', operator: 'IN', values: [3, 4] },
    ]))).toEqual({ stateId: [3] })
  })
})
