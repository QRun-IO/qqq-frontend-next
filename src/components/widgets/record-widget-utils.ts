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

/**
 * @file Pure helpers shared by record-view widgets (filter/columns setup, pivot
 * setup, dynamic form, cron UI, row builder).
 */

import type { QTableMetaData } from '@/types'
import { isPlainObject } from './widget-types'
import type { WidgetRecordContext } from './widget-types'

/** Em dash shown for null, undefined or empty values. */
export const EMPTY_VALUE = '—'

/** A field label resolved from table metadata, flagged when the field is unknown. */
export interface ResolvedFieldLabel {
  label: string
  known: boolean
}

/**
 * Resolves the label for a field name against table metadata, including
 * `joinTable.field` names through the table's exposed joins.
 *
 * @param table - Table metadata; when absent every field is reported unknown.
 * @param fieldName - Field name (optionally prefixed by a join table name).
 * @returns The label and whether the field was found; unknown fields keep their raw name.
 */
export function resolveFieldLabel(table: QTableMetaData | undefined, fieldName: string): ResolvedFieldLabel {
  if (!table) return { label: fieldName, known: false }
  const own = table.fields?.[fieldName]
  if (own) return { label: own.label || fieldName, known: true }
  const dot = fieldName.indexOf('.')
  if (dot > 0) {
    const joinName = fieldName.slice(0, dot)
    const joinFieldName = fieldName.slice(dot + 1)
    const join = (table.exposedJoins ?? []).find((candidate) => candidate.joinTable?.name === joinName)
    const joinField = join?.joinTable?.fields?.[joinFieldName]
    if (join?.joinTable && joinField) {
      return { label: `${join.joinTable.label}: ${joinField.label || joinFieldName}`, known: true }
    }
  }
  return { label: fieldName, known: false }
}

/**
 * Reads a raw value of the hosting record.
 *
 * @param context - Record context passed to the widget.
 * @param fieldName - Field to read.
 * @returns The raw value or `undefined`.
 */
export function recordValue(context: WidgetRecordContext | undefined, fieldName: string | undefined): unknown {
  if (!fieldName) return undefined
  return context?.record?.values?.[fieldName]
}

/**
 * Reads the display value of the hosting record (falls back to the raw value).
 *
 * @param context - Record context passed to the widget.
 * @param fieldName - Field to read.
 * @returns The display string, the raw value, or `undefined`.
 */
export function recordDisplayValue(context: WidgetRecordContext | undefined, fieldName: string | undefined): unknown {
  if (!fieldName) return undefined
  const display = context?.record?.displayValues?.[fieldName]
  return display !== undefined && display !== null && display !== '' ? display : recordValue(context, fieldName)
}

/** Result of parsing a JSON-bearing record value. */
export type JsonValue = { ok: true; value: unknown } | { ok: false }

/**
 * Parses a JSON field value: strings are parsed, objects/arrays pass through,
 * null/undefined/blank yield `{ ok: true, value: undefined }`.
 *
 * @param raw - The stored value.
 * @returns The parsed value, or `{ ok: false }` when the string is not JSON.
 */
export function parseJsonValue(raw: unknown): JsonValue {
  if (raw === undefined || raw === null) return { ok: true, value: undefined }
  if (typeof raw === 'string') {
    if (raw.trim() === '') return { ok: true, value: undefined }
    try {
      return { ok: true, value: JSON.parse(raw) as unknown }
    } catch {
      return { ok: false }
    }
  }
  if (typeof raw === 'object') return { ok: true, value: raw }
  return { ok: false }
}

/**
 * Formats a plain field value for read-only display. `0` and `false` are
 * preserved; null, undefined and empty strings become an em dash.
 *
 * @param value - Raw or display value.
 * @param fieldType - Optional QQQ field type (BOOLEAN renders Yes/No).
 * @returns The display string.
 */
export function formatPlainValue(value: unknown, fieldType?: string): string {
  if (value === undefined || value === null || value === '') return EMPTY_VALUE
  if (typeof value === 'boolean') {
    return fieldType === 'BOOLEAN' ? (value ? 'Yes' : 'No') : String(value)
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (Array.isArray(value)) return value.map((item) => formatPlainValue(item)).join(', ')
  if (isPlainObject(value)) return JSON.stringify(value)
  return String(value)
}
