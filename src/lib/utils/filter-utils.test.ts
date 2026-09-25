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

// Tests for filter utility functions

import { describe, it, expect } from 'vitest'
import {
  emptyFilter,
  getOperatorOptions,
  getOperatorsForFieldType,
  getDefaultOperatorForFieldType,
  selectedOperatorOption,
  newCriterionForField,
  isNumericType,
  isStringType,
  isDateTimeType,
  isCriterionComplete,
  countActiveCriteria,
  isFilterEmpty,
  serializeFilter,
  deserializeFilter,
  buildQuickFilter,
  combineWithQuickFilter,
  applyPagination,
  applySort,
  prepFilterForBackend,
  referencedFieldNames,
  resolveField,
  localDateTimeToUtc,
  isFilterVariableExpression,
  isNowExpression,
  isNowWithOffsetExpression,
  isThisOrLastPeriodExpression,
  describeExpression,
  formatCriterionDisplay,
  OPERATOR_CONFIG,
} from './filter-utils'
import type { QQueryFilter, QFilterCriteria, QTableMetaData, QFieldMetaData, QCriteriaOperator } from '@/types'

const field = (name: string, type: QFieldMetaData['type'], extra: Partial<QFieldMetaData> = {}): QFieldMetaData => ({
  name, label: name, type, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...extra,
})

describe('emptyFilter', () => {
  it('returns default page size of 25', () => {
    const f = emptyFilter()
    expect(f).toEqual({ criteria: [], orderBys: [], subFilters: [], booleanOperator: 'AND', skip: 0, limit: 25 })
  })
})

describe('operator options (Material parity)', () => {
  it('offers the Material string operators in order', () => {
    expect(getOperatorOptions({ type: 'STRING' }).map((o) => `${o.operator}:${o.label}`)).toEqual([
      'EQUALS:equals', 'NOT_EQUALS_OR_IS_NULL:does not equal', 'CONTAINS:contains', 'NOT_CONTAINS:does not contain',
      'STARTS_WITH:starts with', 'NOT_STARTS_WITH:does not start with', 'ENDS_WITH:ends with', 'NOT_ENDS_WITH:does not end with',
      'IS_BLANK:is empty', 'IS_NOT_BLANK:is not empty', 'IN:is any of', 'NOT_IN:is none of',
    ])
  })

  it('offers numeric comparison, range and list operators', () => {
    const ops = getOperatorsForFieldType('INTEGER')
    expect(ops).toEqual(['EQUALS', 'NOT_EQUALS_OR_IS_NULL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUALS', 'LESS_THAN', 'LESS_THAN_OR_EQUALS', 'IS_BLANK', 'IS_NOT_BLANK', 'BETWEEN', 'NOT_BETWEEN', 'IN', 'NOT_IN'])
    expect(ops).not.toContain('CONTAINS')
  })

  it('uses date wording and has no list operators for dates', () => {
    const labels = getOperatorOptions({ type: 'DATE' }).map((o) => o.label)
    expect(labels).toContain('is on or after')
    expect(getOperatorOptions({ type: 'DATE_TIME' }).map((o) => o.label)).toContain('is at or before')
    expect(getOperatorsForFieldType('DATE')).not.toContain('IN')
  })

  it('models boolean yes/no as EQUALS with implicit values', () => {
    const options = getOperatorOptions({ type: 'BOOLEAN' })
    expect(options.map((o) => o.label)).toEqual(['equals yes', 'equals no', 'is empty', 'is not empty'])
    expect(options[1].implicitValues).toEqual([false])
    expect(selectedOperatorOption(options, { fieldName: 'b', operator: 'EQUALS', values: [false] }).label).toBe('equals no')
  })

  it('offers only emptiness for BLOB and the possible-value set for PVS fields', () => {
    expect(getOperatorsForFieldType('BLOB')).toEqual(['IS_BLANK', 'IS_NOT_BLANK'])
    expect(getOperatorOptions({ type: 'INTEGER', possibleValueSourceName: 'person' }).map((o) => o.label))
      .toEqual(['equals', 'does not equal', 'is empty', 'is not empty', 'is any of', 'is none of'])
  })

  it('synthesizes an option for backend-only operators so saved filters still render', () => {
    const options = getOperatorOptions({ type: 'STRING' })
    for (const operator of ['LIKE', 'NOT_LIKE', 'IS_NULL_OR_IN', 'TRUE', 'FALSE', 'NOT_EQUALS'] as QCriteriaOperator[]) {
      const selected = selectedOperatorOption(options, { fieldName: 'name', operator, values: [] })
      expect(selected.operator).toBe(operator)
      expect(selected.label).toBe(OPERATOR_CONFIG[operator].label)
    }
  })

  it('starts new criteria with the first option and its implicit values', () => {
    expect(getDefaultOperatorForFieldType('STRING')).toBe('EQUALS')
    expect(newCriterionForField('isActive', { type: 'BOOLEAN' })).toEqual({ fieldName: 'isActive', operator: 'EQUALS', values: [true] })
  })

  it('covers every backend operator in OPERATOR_CONFIG', () => {
    expect(Object.keys(OPERATOR_CONFIG)).toHaveLength(24)
    expect(OPERATOR_CONFIG.BETWEEN.valueCount).toBe('range')
    expect(OPERATOR_CONFIG.TRUE.valueCount).toBe('none')
  })
})

describe('type helpers', () => {
  it('classifies field types', () => {
    expect(isNumericType('DECIMAL')).toBe(true)
    expect(isStringType('TEXT')).toBe(true)
    expect(isDateTimeType('TIME')).toBe(true)
    expect(isNumericType('STRING')).toBe(false)
  })
})

describe('criterion completeness and counting', () => {
  it('requires values per operator shape (Material validateCriteria)', () => {
    expect(isCriterionComplete({ fieldName: 'a', operator: 'IS_BLANK', values: [] })).toBe(true)
    expect(isCriterionComplete({ fieldName: 'a', operator: 'EQUALS', values: [''] })).toBe(false)
    expect(isCriterionComplete({ fieldName: 'a', operator: 'EQUALS', values: [0] })).toBe(true)
    expect(isCriterionComplete({ fieldName: 'a', operator: 'BETWEEN', values: ['1'] })).toBe(false)
    expect(isCriterionComplete({ fieldName: 'a', operator: 'BETWEEN', values: ['1', '2'] })).toBe(true)
    expect(isCriterionComplete({ fieldName: 'a', operator: 'IN', values: [] })).toBe(false)
    expect(isCriterionComplete({ fieldName: 'a', operator: 'GREATER_THAN', values: [{ type: 'Now' }] })).toBe(true)
  })

  it('counts complete criteria including sub-filters', () => {
    const filter: QQueryFilter = {
      ...emptyFilter(),
      criteria: [{ fieldName: 'a', operator: 'EQUALS', values: ['x'] }, { fieldName: 'b', operator: 'EQUALS', values: [] }],
      subFilters: [{ ...emptyFilter(), criteria: [{ fieldName: 'c', operator: 'IS_NOT_BLANK', values: [] }] }],
    }
    expect(countActiveCriteria(filter)).toBe(2)
    expect(isFilterEmpty(emptyFilter())).toBe(true)
  })
})

describe('serialization', () => {
  const filter: QQueryFilter = {
    criteria: [{ fieldName: 'firstName', operator: 'CONTAINS', values: ['Ávery'] }],
    orderBys: [{ fieldName: 'id', isAscending: false }],
    subFilters: [],
    booleanOperator: 'OR',
    skip: 50,
    limit: 25,
  }

  it('round-trips base64 filters without paging', () => {
    const restored = deserializeFilter(serializeFilter(filter), 10)
    expect(restored.criteria).toEqual(filter.criteria)
    expect(restored.orderBys).toEqual(filter.orderBys)
    expect(restored.booleanOperator).toBe('OR')
    expect(restored.skip).toBe(0)
    expect(restored.limit).toBe(10)
  })

  it('accepts plain JSON filters (Material and backend links)', () => {
    const restored = deserializeFilter(JSON.stringify({ criteria: [{ fieldName: 'personId', operator: 'EQUALS', values: [1] }] }))
    expect(restored.criteria).toEqual([{ fieldName: 'personId', operator: 'EQUALS', values: [1] }])
    expect(restored.booleanOperator).toBe('AND')
  })

  it('falls back to an empty filter for garbage', () => {
    expect(deserializeFilter('not-base64!!!').criteria).toEqual([])
  })
})

describe('quick search', () => {
  it('ORs CONTAINS across visible string fields and ignores blank terms', () => {
    expect(buildQuickFilter('   ', ['a'], { a: 'STRING' }).criteria).toEqual([])
    const quick = buildQuickFilter(' Av ', ['firstName', 'age'], { firstName: 'STRING', age: 'INTEGER' })
    expect(quick.booleanOperator).toBe('OR')
    expect(quick.criteria).toEqual([{ fieldName: 'firstName', operator: 'CONTAINS', values: ['Av'] }])
  })

  it('ANDs the quick search with the advanced filter instead of replacing it', () => {
    const user: QQueryFilter = { ...emptyFilter(), booleanOperator: 'OR', criteria: [{ fieldName: 'a', operator: 'EQUALS', values: ['1'] }], orderBys: [{ fieldName: 'id', isAscending: true }] }
    const quick = buildQuickFilter('x', ['b'], { b: 'STRING' })
    const combined = combineWithQuickFilter(user, quick)
    expect(combined.booleanOperator).toBe('AND')
    expect(combined.criteria).toEqual([])
    expect(combined.subFilters?.[0].criteria).toEqual(user.criteria)
    expect(combined.subFilters?.[0].booleanOperator).toBe('OR')
    expect(combined.subFilters?.[1].criteria).toEqual(quick.criteria)
    expect(combined.orderBys).toEqual(user.orderBys)
    expect(combineWithQuickFilter(user, null)).toBe(user)
  })
})

describe('paging and sort', () => {
  it('sets skip/limit and replaces order', () => {
    expect(applyPagination(emptyFilter(), 3, 10)).toMatchObject({ skip: 20, limit: 10 })
    expect(applySort(emptyFilter(), [{ fieldName: 'x', isAscending: true }]).orderBys).toEqual([{ fieldName: 'x', isAscending: true }])
  })
})

describe('prepFilterForBackend', () => {
  const fields: Record<string, QFieldMetaData> = {
    quantity: field('quantity', 'INTEGER'),
    isActive: field('isActive', 'BOOLEAN'),
    checkedAt: field('checkedAt', 'DATE_TIME'),
    name: field('name', 'STRING'),
  }
  const fieldFor = (name: string) => fields[name]

  it('drops incomplete criteria, clears value-less operators and coerces types', () => {
    const prepared = prepFilterForBackend({
      ...emptyFilter(),
      criteria: [
        { fieldName: 'quantity', operator: 'IN', values: ['1', ' 2 ', ''] },
        { fieldName: 'name', operator: 'EQUALS', values: [''] },
        { fieldName: 'name', operator: 'IS_BLANK', values: ['stale'] },
        { fieldName: 'isActive', operator: 'EQUALS', values: ['false'] },
        { fieldName: 'checkedAt', operator: 'GREATER_THAN', values: [{ type: 'NowWithOffset', operator: 'MINUS', amount: 3, timeUnit: 'DAYS' }] },
      ],
      subFilters: [{ ...emptyFilter(), criteria: [{ fieldName: 'name', operator: 'CONTAINS', values: [] }] }],
    }, fieldFor)
    expect(prepared.criteria).toEqual([
      { fieldName: 'quantity', operator: 'IN', values: [1, 2] },
      { fieldName: 'name', operator: 'IS_BLANK', values: [] },
      { fieldName: 'isActive', operator: 'EQUALS', values: [false] },
      { fieldName: 'checkedAt', operator: 'GREATER_THAN', values: [{ type: 'NowWithOffset', operator: 'MINUS', amount: 3, timeUnit: 'DAYS' }] },
    ])
    expect(prepared.subFilters).toEqual([])
  })

  it('converts local date-times to UTC instants', () => {
    const local = '2026-03-04T05:06'
    expect(localDateTimeToUtc(local)).toBe(new Date(local).toISOString())
    expect(localDateTimeToUtc('2026-03-04T05:06:00Z')).toBe('2026-03-04T05:06:00Z')
  })
})

describe('field resolution', () => {
  const table: QTableMetaData = {
    name: 'pet', label: 'Pet', isHidden: false, primaryKeyField: 'id', sections: [], capabilities: [],
    readPermission: true, insertPermission: true, editPermission: true, deletePermission: true, usesVariants: false, variantTableLabel: '',
    fields: { id: field('id', 'INTEGER'), name: { ...field('name', 'STRING'), label: 'Name' } },
    exposedJoins: [{ label: 'Owner', isMany: false, joinTable: { name: 'person', label: 'Person', fields: { firstName: { ...field('firstName', 'STRING'), label: 'First Name' } } } as unknown as QTableMetaData }],
  }

  it('resolves base and exposed-join fields with Material labels', () => {
    expect(resolveField(table, 'name')?.label).toBe('Name')
    expect(resolveField(table, 'person.firstName')).toMatchObject({ isJoin: true, tableName: 'person', label: 'Owner: First Name' })
    expect(resolveField(table, 'person.missing')).toBeUndefined()
  })

  it('lists referenced fields from criteria, sort and sub-filters', () => {
    expect(referencedFieldNames({
      criteria: [{ fieldName: 'person.firstName', operator: 'EQUALS', values: ['x'] }],
      orderBys: [{ fieldName: 'name', isAscending: true }],
      subFilters: [{ ...emptyFilter(), criteria: [{ fieldName: 'id', operator: 'IS_BLANK', values: [] }] }],
    }).sort()).toEqual(['id', 'name', 'person.firstName'])
  })
})

describe('expressions', () => {
  it('recognizes the backend expression classes', () => {
    expect(isNowExpression({ type: 'Now' })).toBe(true)
    expect(isNowWithOffsetExpression({ type: 'NowWithOffset', operator: 'MINUS', amount: 1, timeUnit: 'DAYS' })).toBe(true)
    expect(isThisOrLastPeriodExpression({ type: 'ThisOrLastPeriod', operator: 'THIS', timeUnit: 'MONTHS' })).toBe(true)
    expect(isFilterVariableExpression({ type: 'FilterVariableExpression', variableName: 'x' })).toBe(true)
    expect(isNowExpression({ type: 'NOW' })).toBe(false)
  })

  it('describes expressions in words', () => {
    expect(describeExpression({ type: 'Now' }, 'DATE')).toBe('today')
    expect(describeExpression({ type: 'Now' }, 'DATE_TIME')).toBe('now')
    expect(describeExpression({ type: 'NowWithOffset', operator: 'MINUS', amount: 3, timeUnit: 'DAYS' })).toBe('3 days ago')
    expect(describeExpression({ type: 'NowWithOffset', operator: 'PLUS', amount: 1, timeUnit: 'WEEKS' })).toBe('1 week from now')
    expect(describeExpression({ type: 'ThisOrLastPeriod', operator: 'LAST', timeUnit: 'MONTHS' })).toBe('start of last month')
  })

  it('formats criteria for display', () => {
    const criterion: QFilterCriteria = { fieldName: 'name', operator: 'CONTAINS', values: ['Widget'] }
    expect(formatCriterionDisplay(criterion, () => 'Name')).toBe('Name contains Widget')
    expect(formatCriterionDisplay({ fieldName: 'name', operator: 'IS_BLANK', values: [] })).toBe('name is empty')
  })
})
