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
  getOperatorsForFieldType,
  getDefaultOperatorForFieldType,
  isNumericType,
  isStringType,
  isDateTimeType,
  countActiveCriteria,
  isFilterEmpty,
  serializeFilter,
  deserializeFilter,
  buildQuickFilter,
  applyPagination,
  applySort,
  isFilterVariableExpression,
  isNowExpression,
  isNowWithOffsetExpression,
  isThisOrLastPeriodExpression,
  formatCriterionDisplay,
  OPERATOR_CONFIG,
} from './filter-utils'
import type { QQueryFilter, QFilterCriteria } from '@/types'

describe('emptyFilter', () => {
  it('returns default page size of 25', () => {
    const f = emptyFilter()
    expect(f.limit).toBe(25)
    expect(f.skip).toBe(0)
    expect(f.criteria).toEqual([])
    expect(f.orderBys).toEqual([])
    expect(f.booleanOperator).toBe('AND')
  })

  it('respects custom page size', () => {
    const f = emptyFilter(50)
    expect(f.limit).toBe(50)
  })
})

describe('getOperatorsForFieldType', () => {
  it('returns CONTAINS for STRING type', () => {
    const ops = getOperatorsForFieldType('STRING')
    expect(ops).toContain('CONTAINS')
    expect(ops).toContain('EQUALS')
    expect(ops).toContain('STARTS_WITH')
  })

  it('returns numeric operators for INTEGER', () => {
    const ops = getOperatorsForFieldType('INTEGER')
    expect(ops).toContain('LESS_THAN')
    expect(ops).toContain('GREATER_THAN')
    expect(ops).toContain('BETWEEN')
    expect(ops).not.toContain('CONTAINS')
  })

  it('returns blank operators for BOOLEAN', () => {
    const ops = getOperatorsForFieldType('BOOLEAN')
    expect(ops).toContain('IS_BLANK')
    expect(ops).toContain('IS_NOT_BLANK')
    expect(ops).toContain('EQUALS')
  })

  it('returns date operators for DATE type', () => {
    const ops = getOperatorsForFieldType('DATE')
    expect(ops).toContain('LESS_THAN')
    expect(ops).toContain('BETWEEN')
    expect(ops).not.toContain('CONTAINS')
  })

  it('returns HTML operators for HTML type', () => {
    const ops = getOperatorsForFieldType('HTML')
    expect(ops).toContain('CONTAINS')
    expect(ops).toContain('STARTS_WITH')
  })
})

describe('getDefaultOperatorForFieldType', () => {
  it('returns CONTAINS for string types', () => {
    expect(getDefaultOperatorForFieldType('STRING')).toBe('CONTAINS')
    expect(getDefaultOperatorForFieldType('TEXT')).toBe('CONTAINS')
    expect(getDefaultOperatorForFieldType('HTML')).toBe('CONTAINS')
  })

  it('returns EQUALS for numeric types', () => {
    expect(getDefaultOperatorForFieldType('INTEGER')).toBe('EQUALS')
    expect(getDefaultOperatorForFieldType('LONG')).toBe('EQUALS')
    expect(getDefaultOperatorForFieldType('DECIMAL')).toBe('EQUALS')
  })

  it('returns EQUALS for date/time types', () => {
    expect(getDefaultOperatorForFieldType('DATE')).toBe('EQUALS')
    expect(getDefaultOperatorForFieldType('DATE_TIME')).toBe('EQUALS')
    expect(getDefaultOperatorForFieldType('TIME')).toBe('EQUALS')
  })

  it('returns EQUALS for BOOLEAN', () => {
    expect(getDefaultOperatorForFieldType('BOOLEAN')).toBe('EQUALS')
  })

  it('returns EQUALS for unknown type', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getDefaultOperatorForFieldType('UNKNOWN' as any)).toBe('EQUALS')
  })
})

describe('type guards', () => {
  it('isNumericType returns true for numeric types', () => {
    expect(isNumericType('INTEGER')).toBe(true)
    expect(isNumericType('LONG')).toBe(true)
    expect(isNumericType('DECIMAL')).toBe(true)
    expect(isNumericType('STRING')).toBe(false)
    expect(isNumericType('BOOLEAN')).toBe(false)
  })

  it('isStringType returns true for string types', () => {
    expect(isStringType('STRING')).toBe(true)
    expect(isStringType('TEXT')).toBe(true)
    expect(isStringType('HTML')).toBe(true)
    expect(isStringType('INTEGER')).toBe(false)
  })

  it('isDateTimeType returns true for date/time types', () => {
    expect(isDateTimeType('DATE')).toBe(true)
    expect(isDateTimeType('TIME')).toBe(true)
    expect(isDateTimeType('DATE_TIME')).toBe(true)
    expect(isDateTimeType('STRING')).toBe(false)
  })
})

describe('countActiveCriteria', () => {
  it('returns 0 for empty filter', () => {
    expect(countActiveCriteria(emptyFilter())).toBe(0)
  })

  it('counts criteria with non-empty values', () => {
    const filter: QQueryFilter = {
      ...emptyFilter(),
      criteria: [
        { fieldName: 'name', operator: 'EQUALS', values: ['Alice'] },
        { fieldName: 'age', operator: 'GREATER_THAN', values: ['30'] },
      ],
    }
    expect(countActiveCriteria(filter)).toBe(2)
  })

  it('does not count criteria with empty values', () => {
    const filter: QQueryFilter = {
      ...emptyFilter(),
      criteria: [{ fieldName: 'name', operator: 'EQUALS', values: [''] }],
    }
    expect(countActiveCriteria(filter)).toBe(0)
  })

  it('counts IS_BLANK and IS_NOT_BLANK even without values', () => {
    const filter: QQueryFilter = {
      ...emptyFilter(),
      criteria: [
        { fieldName: 'name', operator: 'IS_BLANK', values: [] },
        { fieldName: 'age', operator: 'IS_NOT_BLANK', values: [] },
      ],
    }
    expect(countActiveCriteria(filter)).toBe(2)
  })

  it('counts nested subFilter criteria', () => {
    const filter: QQueryFilter = {
      ...emptyFilter(),
      criteria: [{ fieldName: 'name', operator: 'EQUALS', values: ['Alice'] }],
      subFilters: [
        {
          ...emptyFilter(),
          criteria: [{ fieldName: 'status', operator: 'EQUALS', values: ['active'] }],
        },
      ],
    }
    expect(countActiveCriteria(filter)).toBe(2)
  })
})

describe('isFilterEmpty', () => {
  it('returns true for empty filter', () => {
    expect(isFilterEmpty(emptyFilter())).toBe(true)
  })

  it('returns false when criteria are set', () => {
    const filter: QQueryFilter = {
      ...emptyFilter(),
      criteria: [{ fieldName: 'name', operator: 'EQUALS', values: ['Alice'] }],
    }
    expect(isFilterEmpty(filter)).toBe(false)
  })
})

describe('serializeFilter / deserializeFilter', () => {
  it('round-trips a filter', () => {
    const original: QQueryFilter = {
      criteria: [{ fieldName: 'name', operator: 'CONTAINS', values: ['test'] }],
      orderBys: [{ fieldName: 'name', isAscending: true }],
      subFilters: [],
      booleanOperator: 'OR',
      skip: 0,
      limit: 25,
    }

    const encoded = serializeFilter(original)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)

    const decoded = deserializeFilter(encoded)
    expect(decoded.criteria).toEqual(original.criteria)
    expect(decoded.orderBys).toEqual(original.orderBys)
    expect(decoded.booleanOperator).toBe('OR')
  })

  it('returns empty filter for invalid input', () => {
    const result = deserializeFilter('not-valid-base64!!!')
    expect(result.criteria).toEqual([])
  })

  it('deserializeFilter uses supplied pageSize', () => {
    const encoded = serializeFilter(emptyFilter())
    const result = deserializeFilter(encoded, 100)
    expect(result.limit).toBe(100)
  })
})

describe('buildQuickFilter', () => {
  it('returns empty filter for empty search term', () => {
    const result = buildQuickFilter('', ['name'], { name: 'STRING' })
    expect(isFilterEmpty(result)).toBe(true)
  })

  it('returns empty filter for whitespace-only search term', () => {
    const result = buildQuickFilter('   ', ['name'], { name: 'STRING' })
    expect(isFilterEmpty(result)).toBe(true)
  })

  it('builds OR filter across string fields', () => {
    const result = buildQuickFilter('Alice', ['firstName', 'lastName', 'age'], {
      firstName: 'STRING',
      lastName: 'STRING',
      age: 'INTEGER',
    })
    expect(result.booleanOperator).toBe('OR')
    // Only string fields get criteria
    expect(result.criteria).toHaveLength(2)
    expect(result.criteria[0].fieldName).toBe('firstName')
    expect(result.criteria[0].operator).toBe('CONTAINS')
    expect(result.criteria[0].values).toEqual(['Alice'])
  })

  it('ignores non-string field types', () => {
    const result = buildQuickFilter('123', ['id', 'name'], {
      id: 'INTEGER',
      name: 'STRING',
    })
    expect(result.criteria).toHaveLength(1)
    expect(result.criteria[0].fieldName).toBe('name')
  })
})

describe('applyPagination', () => {
  it('sets skip and limit correctly', () => {
    const base = emptyFilter()
    const result = applyPagination(base, 2, 25)
    expect(result.skip).toBe(25)
    expect(result.limit).toBe(25)
  })

  it('page 1 has skip 0', () => {
    const result = applyPagination(emptyFilter(), 1, 50)
    expect(result.skip).toBe(0)
    expect(result.limit).toBe(50)
  })

  it('page 3 with pageSize 10 = skip 20', () => {
    const result = applyPagination(emptyFilter(), 3, 10)
    expect(result.skip).toBe(20)
  })
})

describe('applySort', () => {
  it('sets orderBys on filter', () => {
    const base = emptyFilter()
    const orderBys = [{ fieldName: 'name', isAscending: true }]
    const result = applySort(base, orderBys)
    expect(result.orderBys).toEqual(orderBys)
  })
})

describe('expression type guards', () => {
  it('isFilterVariableExpression identifies FILTER_VARIABLE', () => {
    expect(isFilterVariableExpression({ type: 'FILTER_VARIABLE', variableName: 'x' })).toBe(true)
    expect(isFilterVariableExpression({ type: 'NOW' })).toBe(false)
    expect(isFilterVariableExpression(null)).toBe(false)
    expect(isFilterVariableExpression('string')).toBe(false)
  })

  it('isNowExpression identifies NOW', () => {
    expect(isNowExpression({ type: 'NOW' })).toBe(true)
    expect(isNowExpression({ type: 'OTHER' })).toBe(false)
  })

  it('isNowWithOffsetExpression identifies NOW_WITH_OFFSET', () => {
    expect(isNowWithOffsetExpression({ type: 'NOW_WITH_OFFSET' })).toBe(true)
    expect(isNowWithOffsetExpression(null)).toBe(false)
  })

  it('isThisOrLastPeriodExpression identifies THIS_OR_LAST_PERIOD', () => {
    expect(isThisOrLastPeriodExpression({ type: 'THIS_OR_LAST_PERIOD' })).toBe(true)
    expect(isThisOrLastPeriodExpression({ type: 'NOW' })).toBe(false)
  })
})

describe('formatCriterionDisplay', () => {
  it('formats simple equality criterion', () => {
    const criterion: QFilterCriteria = { fieldName: 'name', operator: 'EQUALS', values: ['Alice'] }
    const display = formatCriterionDisplay(criterion)
    expect(display).toContain('name')
    expect(display).toContain('Equals')
    expect(display).toContain('Alice')
  })

  it('formats no-value operators', () => {
    const criterion: QFilterCriteria = { fieldName: 'email', operator: 'IS_BLANK', values: [] }
    const display = formatCriterionDisplay(criterion)
    expect(display).toBe('email Is blank')
  })

  it('formats NOW expression', () => {
    const criterion: QFilterCriteria = {
      fieldName: 'date',
      operator: 'EQUALS',
      values: [{ type: 'NOW' }],
    }
    const display = formatCriterionDisplay(criterion)
    expect(display).toContain('now')
  })

  it('formats NOW_WITH_OFFSET expression', () => {
    const criterion: QFilterCriteria = {
      fieldName: 'date',
      operator: 'GREATER_THAN',
      values: [{ type: 'NOW_WITH_OFFSET', isNegativeOffset: true, offsetValue: 7, offsetUnit: 'DAY' }],
    }
    const display = formatCriterionDisplay(criterion)
    expect(display).toContain('now -7 day')
  })

  it('formats THIS_OR_LAST_PERIOD expression', () => {
    const criterion: QFilterCriteria = {
      fieldName: 'date',
      operator: 'EQUALS',
      values: [{ type: 'THIS_OR_LAST_PERIOD', isLast: false, period: 'MONTH' }],
    }
    const display = formatCriterionDisplay(criterion)
    expect(display).toContain('this month')
  })

  it('formats LAST period expression', () => {
    const criterion: QFilterCriteria = {
      fieldName: 'date',
      operator: 'EQUALS',
      values: [{ type: 'THIS_OR_LAST_PERIOD', isLast: true, period: 'WEEK' }],
    }
    const display = formatCriterionDisplay(criterion)
    expect(display).toContain('last week')
  })
})

describe('OPERATOR_CONFIG', () => {
  it('has all expected operators', () => {
    const operators = Object.keys(OPERATOR_CONFIG)
    expect(operators).toContain('EQUALS')
    expect(operators).toContain('CONTAINS')
    expect(operators).toContain('IS_BLANK')
    expect(operators).toContain('BETWEEN')
  })

  it('BETWEEN has range valueCount', () => {
    expect(OPERATOR_CONFIG.BETWEEN.valueCount).toBe('range')
  })

  it('IS_BLANK has none valueCount', () => {
    expect(OPERATOR_CONFIG.IS_BLANK.valueCount).toBe('none')
  })
})
