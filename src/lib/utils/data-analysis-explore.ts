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

/** @file Validated shareable relationship layouts; the query owns population A. */
import { z } from 'zod'
import type { QQueryFilter } from '@/types'
import { analysisFilter } from './data-analysis'

export const EXPLORE_VIEWS = ['pivot', 'compare', 'correlation', 'crosstab', 'shift'] as const
export type RelationshipView = Exclude<(typeof EXPLORE_VIEWS)[number], 'pivot'>
export const EXPLORE_LABELS = {
  pivot: 'Pivot',
  compare: 'Compare',
  correlation: 'Correlation',
  crosstab: 'Crosstab',
  shift: 'Shift over time',
}
export const SHIFT_BUCKETS = ['HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'] as const
const field = z.string().min(1, 'Choose a field.')
const fields = z
  .array(field)
  .min(1, 'Choose at least one field.')
  .refine((v) => new Set(v).size === v.length, 'Choose distinct fields.')
const filterB = z
  .custom<Partial<QQueryFilter>>((v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v))
  .transform((v) => analysisFilter(v))
const schemas = {
  compare: z
    .object({
      fields,
      labelA: z.string(),
      labelB: z.string(),
      sideB: z.enum(['whole', 'saved', 'edit']),
      filterB: filterB.optional(),
      savedViewId: z.number().optional(),
    })
    .refine(
      (v) => v.sideB === 'whole' || v.filterB !== undefined,
      'Choose a saved view or edit filter B.'
    ),
  correlation: z.object({
    fields: fields.refine((v) => v.length >= 2 && v.length <= 12, 'Choose 2–12 numeric fields.'),
  }),
  crosstab: z
    .object({ rowField: field, columnField: field })
    .refine((v) => v.rowField !== v.columnField, 'Choose two different fields.'),
  shift: z.object({ field, dateField: field, bucket: z.enum(SHIFT_BUCKETS) }),
}
export type ExploreLayout = {
  fields?: string[]
  labelA?: string
  labelB?: string
  sideB?: 'whole' | 'saved' | 'edit'
  filterB?: Partial<QQueryFilter>
  savedViewId?: number
  rowField?: string
  columnField?: string
  field?: string
  dateField?: string
  bucket?: (typeof SHIFT_BUCKETS)[number]
}

/** Validates a builder before a run.
 * @param view - Explorer kind.
 * @param layout - Untrusted state.
 * @returns A useful validation message or null.
 */
export function validateExplore(view: RelationshipView, layout: unknown): string | null {
  try {
    const parsed = schemas[view].safeParse(layout)
    return parsed.success ? null : parsed.error.issues[0].message
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid filter B.'
  }
}

/** Encodes only the chosen view's parameters, never population A.
 * @param view - Explorer kind.
 * @param layout - Builder state.
 * @returns UTF-8 base64 JSON.
 */
export function encodeExplore(view: RelationshipView, layout: ExploreLayout): string {
  return btoa(
    Array.from(new TextEncoder().encode(JSON.stringify(schemas[view].parse(layout))), (b) =>
      String.fromCharCode(b)
    ).join('')
  )
}

/** Restores validated URL state.
 * @param view - Explorer kind.
 * @param encoded - Base64 URL parameter.
 * @returns The shareable layout.
 */
export function decodeExplore(view: RelationshipView, encoded: string): ExploreLayout {
  try {
    return schemas[view].parse(
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
        )
      )
    )
  } catch {
    throw new Error('This analysis URL is invalid. Choose fields and Run to replace it.')
  }
}
