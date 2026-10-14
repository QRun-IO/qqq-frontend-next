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

/** @file Validated, filter-independent pivot URL state and chart layout rules. */
import { z } from 'zod'
import type {
  DataAnalysisCapabilityFieldV1,
  DataAnalysisPivotRequestV1,
} from '@/types/data-analysis'

export const DATE_BUCKETS = [
  'YEAR',
  'QUARTER',
  'MONTH',
  'WEEK',
  'DAY',
  'HOUR',
  'DAY_OF_WEEK',
  'HOUR_OF_DAY',
] as const
export const PIVOT_OPERATORS = {
  COUNT: 'Count',
  SUM: 'Sum',
  AVG: 'Average',
  MIN: 'Min',
  MAX: 'Max',
  COUNT_DISTINCT: 'Distinct count',
  PERCENTILE: 'Percentile',
} as const
const dimension = z
  .object({
    field: z.string().min(1, 'Choose a dimension field.'),
    dateBucket: z.enum(DATE_BUCKETS).optional(),
    numericBins: z
      .object({
        count: z.number().int().min(1).max(200).optional(),
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
      })
      .optional(),
  })
  .refine((d) => !(d.dateBucket && d.numericBins), 'Choose either date buckets or numeric bins.')
  .refine(
    (d) =>
      d.numericBins?.min === undefined ||
      d.numericBins.max === undefined ||
      d.numericBins.min < d.numericBins.max,
    'Bin maximum must exceed minimum.'
  )
const measure = z
  .object({
    operator: z.enum(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT', 'PERCENTILE']),
    field: z.string().optional(),
    percentile: z.number().finite().min(0).max(1).optional(),
  })
  .refine((m) => m.operator === 'COUNT' || Boolean(m.field), 'Choose a value field.')
  .refine(
    (m) => m.operator !== 'PERCENTILE' || m.percentile !== undefined,
    'Enter a percentile from 0 to 1.'
  )
const schema = z.object({
  rows: z.array(dimension).min(1, 'Choose at least 1 row.').max(3),
  columns: z.array(dimension).max(2).optional(),
  values: z.array(measure).min(1, 'Choose at least 1 value.').max(6),
  showTotals: z.boolean().optional(),
  limitGroups: z.number().int().min(1).max(200).optional(),
})

/** The shared layout deliberately excludes the query page's filter. */
export type PivotLayout = Omit<DataAnalysisPivotRequestV1, 'filter'>

/** Validates builder or decoded URL input.
 * @param input - Untrusted layout.
 * @returns A validation message or null.
 */
export function validatePivot(input: unknown): string | null {
  const result = schema.safeParse(input)
  return result.success ? null : result.error.issues[0].message
}

/** Encodes UTF-8 layout data, dropping filters and unknown properties.
 * @param request - Pivot request.
 * @returns Standard base64 JSON for URLSearchParams.
 */
export function encodePivot(request: PivotLayout): string {
  const json = JSON.stringify(schema.parse(request))
  return btoa(
    Array.from(new TextEncoder().encode(json), (byte) => String.fromCharCode(byte)).join('')
  )
}

/** Decodes a shareable layout without accepting a filter from it.
 * @param encoded - Base64 URL value.
 * @returns Validated layout; throws on malformed input.
 */
export function decodePivot(encoded: string): PivotLayout {
  try {
    return schema.parse(
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
        )
      )
    )
  } catch {
    throw new Error('This pivot URL is invalid. Choose rows and values, then Run to replace it.')
  }
}

/** Determines the supported chart for a layout.
 * @param request - Executed layout.
 * @param fields - Capability fields.
 * @returns Time series, grouped bars, or null.
 */
export function pivotChartKind(
  request: PivotLayout,
  fields: DataAnalysisCapabilityFieldV1[]
): 'TIME_SERIES' | 'BAR' | null {
  if (request.rows.length !== 1 || (request.columns?.length ?? 0) > 1) return null
  const kind = fields.find((f) => f?.name === request.rows[0].field)?.kind
  return kind === 'DATE' || kind === 'DATE_TIME' ? 'TIME_SERIES' : 'BAR'
}
