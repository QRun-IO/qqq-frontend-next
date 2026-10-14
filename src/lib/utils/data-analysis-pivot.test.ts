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
import { decodePivot, encodePivot, pivotChartKind, validatePivot } from './data-analysis-pivot'
import { pivotCapabilities, pivotRequest } from '../../../tests/fixtures/data-analysis'

describe('pivot URL layout', () => {
  it('round-trips Unicode and removes the independently owned filter', () => {
    const request = { ...pivotRequest, rows: [{ field: 'company.café' }], filter: { criteria: [] } }
    const params = new URLSearchParams({ view: 'pivot', pivot: encodePivot(request) })
    expect(decodePivot(params.get('pivot')!)).toEqual({ ...pivotRequest, rows: request.rows })
    expect(
      JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(params.get('pivot')!), (c) => c.charCodeAt(0))
        )
      ).filter
    ).toBeUndefined()
  })
  it.each(['!', btoa('{}'), btoa('null'), btoa('{"rows":[null],"values":[]}')])(
    'rejects malformed URL %s',
    (value) => {
      expect(() => decodePivot(value)).toThrow('pivot URL is invalid')
    }
  )
  it('requires rows and measures, bounded dimensions, bins and percentiles', () => {
    expect(validatePivot({ rows: [], values: [] })).toContain('at least 1 row')
    expect(validatePivot({ rows: [{ field: 'status' }], values: [] })).toContain('at least 1 value')
    expect(validatePivot({ ...pivotRequest, values: [{ operator: 'AVG' }] })).toContain(
      'value field'
    )
    for (const percentile of [-1, 1.1, undefined])
      expect(
        validatePivot({
          ...pivotRequest,
          values: [{ operator: 'PERCENTILE', field: 'amount', percentile }],
        })
      ).not.toBeNull()
    expect(
      validatePivot({ ...pivotRequest, rows: [{ field: 'amount', numericBins: { count: 201 } }] })
    ).not.toBeNull()
    expect(
      validatePivot({ ...pivotRequest, columns: Array(3).fill({ field: 'status' }) })
    ).not.toBeNull()
    expect(
      validatePivot({ ...pivotRequest, rows: Array(4).fill({ field: 'status' }) })
    ).not.toBeNull()
    expect(
      validatePivot({ ...pivotRequest, values: Array(7).fill({ operator: 'COUNT' }) })
    ).not.toBeNull()
    expect(validatePivot(pivotRequest)).toBeNull()
  })
  it('selects grouped bars, date series, and unsupported layouts', () => {
    expect(pivotChartKind(pivotRequest, pivotCapabilities.fields)).toBe('BAR')
    expect(
      pivotChartKind(
        { ...pivotRequest, rows: [{ field: 'createdAt', dateBucket: 'DAY' }] },
        pivotCapabilities.fields
      )
    ).toBe('TIME_SERIES')
    expect(
      pivotChartKind(
        { ...pivotRequest, rows: [{ field: 'status' }, { field: 'amount' }] },
        pivotCapabilities.fields
      )
    ).toBeNull()
    expect(
      pivotChartKind(
        { ...pivotRequest, columns: [{ field: 'status' }, { field: 'amount' }] },
        pivotCapabilities.fields
      )
    ).toBeNull()
  })
})
