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
import { analysisFilter, drillHref, metricText } from './data-analysis'
import { deserializeFilter } from './filter-utils'
import { activeDrill } from '../../../tests/fixtures/data-analysis'

describe('analysis drills and filters', () => {
  it('builds the standard escaped app route and round-trips Unicode and reserved values', () => {
    const filter = {
      criteria: [{ fieldName: 'city', operator: 'EQUALS' as const, values: ['München & + /'] }],
      booleanOperator: 'OR' as const,
    }
    const href = drillHref({ tableName: 'sales/people.v2', filter })!
    expect(href).toMatch(/^\/app\/sales%2Fpeople.v2\/\?filter=/)
    const restored = deserializeFilter(
      new URL(href, 'https://example.test').searchParams.get('filter')!
    )
    expect(restored.criteria).toEqual(filter.criteria)
    expect(restored.booleanOperator).toBe('OR')
  })
  it('does not invent links for missing or suppressed drills', () => {
    expect(drillHref(null)).toBeNull()
    expect(drillHref({ tableName: 'person', filter: null })).toBeNull()
    expect(
      metricText({ value: 123, formatted: 'secret', suppressed: true, drill: activeDrill })
    ).toBe('Hidden')
  })
  it('preserves nested predicates and normalizes literal operands without paging', () => {
    expect(
      analysisFilter({
        criteria: [{ fieldName: 'id', operator: 'EQUALS', values: [42] }],
        skip: 50,
        limit: 25,
      })
    ).toEqual({
      criteria: [{ fieldName: 'id', operator: 'EQUALS', values: ['42'] }],
      booleanOperator: 'AND',
    })
    const nested = {
      criteria: [],
      booleanOperator: 'AND' as const,
      subFilters: [
        {
          criteria: [{ fieldName: 'id', operator: 'EQUALS' as const, values: [1] }],
          booleanOperator: 'OR' as const,
          skip: 0,
          limit: 0,
        },
      ],
    }
    expect(analysisFilter(nested).subFilters).toEqual([
      { criteria: [{ fieldName: 'id', operator: 'EQUALS', values: ['1'] }], booleanOperator: 'OR' },
    ])
  })
  it('rejects expressions the published schema cannot represent', () => {
    expect(() =>
      analysisFilter({
        criteria: [{ fieldName: 'id', operator: 'EQUALS', values: [], otherFieldName: 'other' }],
      })
    ).toThrow('does not yet support')
  })
  it('formats semantic values', () => {
    expect(metricText({ value: 0.988, valueType: 'PERCENT', formatted: '98.8%' })).toBe('98.8%')
    expect(metricText({ value: 12498, valueType: 'COUNT', formatted: '12,498' })).toBe('12,498')
    expect(metricText({ value: 81753.32, formatted: '$81,753.32' })).toBe('$81,753.32')
    expect(metricText({ value: 123456789 })).toBe('—')
    expect(metricText({ value: 'raw date' })).toBe('—')
    expect(metricText(null)).toBe('—')
  })
})
