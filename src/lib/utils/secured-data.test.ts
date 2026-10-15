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
import type { QFieldMetaData } from '@/types'
import { emptyFilter, getOperatorOptions } from './filter-utils'
import {
  allowedOperators,
  canSortField,
  sanitizeAccessFilter,
  writableValues,
} from './secured-data'

const field = (name: string, accessTier?: QFieldMetaData['accessTier']): QFieldMetaData => ({
  name,
  label: name,
  type: 'STRING',
  isEditable: true,
  isHidden: false,
  isHeavy: false,
  isRequired: false,
  adornments: [],
  accessTier,
})
const fields = {
  name: field('name'),
  email: field('email', 'REVEALABLE'),
  ssn: field('ssn', 'MASKED'),
}

describe('secured field rules', () => {
  it('offers only exact match for every restricted type and honors an empty allowlist', () => {
    for (const type of ['STRING', 'BOOLEAN', 'DATE', 'DATE_TIME', 'INTEGER'] as const)
      expect(
        getOperatorOptions({ ...fields.email, type }).map((option) => option.operator)
      ).toEqual(['EQUALS', 'IN'])
    expect(getOperatorOptions({ ...fields.email, allowedFilterOperators: [] })).toEqual([])
    expect(allowedOperators(fields.ssn)).toEqual([])
    expect(canSortField(fields.email)).toBe(false)
    expect(canSortField({ isSortable: false })).toBe(false)
    expect(getOperatorOptions(fields.name).map((option) => option.operator)).toContain('CONTAINS')
  })
  it('omits all restricted values regardless of editability, changes or defaults', () => {
    expect(writableValues({ name: 'Alice', email: 'j***@x.com', ssn: '***1234' }, fields)).toEqual({
      name: 'Alice',
    })
  })
  it('preserves criteria and sorts without access metadata, including unresolved fields', () => {
    const filter = {
      ...emptyFilter(),
      criteria: [{ fieldName: 'name', operator: 'STARTS_WITH' as const, values: ['B'] }],
      orderBys: [{ fieldName: 'name', isAscending: true }],
      subFilters: [{
        ...emptyFilter(),
        criteria: [{ fieldName: 'joined.name', operator: 'EQUALS' as const, values: [], otherFieldName: 'name' }],
      }],
    }
    expect(sanitizeAccessFilter(filter, () => undefined)).toEqual(filter)
    expect(sanitizeAccessFilter(filter, (name) => fields[name as keyof typeof fields])).toEqual(filter)
    expect(canSortField(undefined)).toBe(true)
    expect(canSortField(fields.name)).toBe(true)
    expect(canSortField(field('full', 'FULL'))).toBe(true)
  })
  it('drops nested disallowed, field comparison and oversized IN criteria and sort', () => {
    const filter = {
      ...emptyFilter(),
      criteria: [
        { fieldName: 'email', operator: 'EQUALS' as const, values: ['known@x.com'] },
        {
          fieldName: 'email',
          operator: 'IN' as const,
          values: Array.from({ length: 26 }, (_, i) => String(i)),
        },
        { fieldName: 'name', operator: 'EQUALS' as const, values: [], otherFieldName: 'email' },
        { fieldName: 'hidden', operator: 'EQUALS' as const, values: ['x'] },
      ],
      orderBys: [{ fieldName: 'ssn', isAscending: true }],
      subFilters: [
        {
          ...emptyFilter(),
          criteria: [{ fieldName: 'email', operator: 'CONTAINS' as const, values: ['x'] }],
        },
      ],
    }
    const safe = sanitizeAccessFilter(filter, (name) => fields[name as keyof typeof fields])
    expect(safe.criteria).toEqual([filter.criteria[0], filter.criteria[3]])
    expect(safe.orderBys).toEqual([])
    expect(safe.subFilters).toEqual([])
  })
})
