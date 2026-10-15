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
 * @file record-picker-query — the record picker dialog's filter controls, the filter and ordering
 * a picker page sends (keyset or offset paging), and the per-field preferences remembered in local
 * storage. Loaded with the dialog only.
 */

import { allowedOperators, canSortField, isRestricted } from './secured-data'
import type { QFieldMetaData, QFilterCriteria, QPossibleValuePicker, QPossibleValue } from '@/types'
import type { PickerPageRequest } from '@/lib/api/possible-values'

/** One filter control's value: an exact value, a text, or a from/to range. */
export interface PickerFilterValue {
  /** Exact value (a possible value id, `true`/`false`), or the text a string field contains. */
  value?: string
  /** Range start (a number, or a `yyyy-mm-dd` date). */
  from?: string
  /** Range end (a number, or a `yyyy-mm-dd` date). */
  to?: string
}

/** What the picker remembers per field: filters, ordering and view. */
export interface PickerPreferences {
  /** Filter values by field name. */
  filters: Record<string, PickerFilterValue>
  /** Index into the picker's sorts. */
  sortIndex: number
  /** Thumbnail grid or list. */
  view: 'grid' | 'list'
}

/** The preferences of a field the picker has not seen. */
export const DEFAULT_PICKER_PREFERENCES: PickerPreferences = { filters: {}, sortIndex: 0, view: 'grid' }

/** How a filter field is edited: a choice, a text, or a range. */
export type PickerFilterKind = 'choice' | 'boolean' | 'text' | 'number' | 'date'

/**
 * The control kind of a picker filter field.
 * @param field - The field (of the picker's table).
 * @returns `choice` for a possible-value field, else by type.
 */
export function pickerFilterKind(field: Pick<QFieldMetaData, 'type' | 'possibleValueSourceName' | 'accessTier'>): PickerFilterKind {
  if (isRestricted(field)) return 'text'
  if (field.possibleValueSourceName) return 'choice'
  if (field.type === 'BOOLEAN') return 'boolean'
  if (field.type === 'INTEGER' || field.type === 'LONG' || field.type === 'DECIMAL') return 'number'
  if (field.type === 'DATE' || field.type === 'DATE_TIME') return 'date'
  return 'text'
}

/**
 * The criteria of the filter values, by each field's control kind.
 * @param filters - Filter values by field name.
 * @param fields - The picker table's fields, by name.
 * @returns The criteria (`AND`ed).
 */
export function pickerCriteria(filters: Record<string, PickerFilterValue>, fields: Record<string, QFieldMetaData> | undefined): QFilterCriteria[] {
  const criteria: QFilterCriteria[] = []
  for (const [fieldName, filter] of Object.entries(filters)) {
    const field = fields?.[fieldName]
    if (!field || !filter || allowedOperators(field)?.length === 0) continue
    if (isRestricted(field)) {
      if (allowedOperators(field)?.includes('EQUALS') && filter.value?.trim()) criteria.push({ fieldName, operator: 'EQUALS', values: [filter.value.trim()] })
      continue
    }
    const kind = pickerFilterKind(field)
    if (kind === 'choice' || kind === 'boolean') {
      if (filter.value === undefined || filter.value === '') continue
      criteria.push({ fieldName, operator: 'EQUALS', values: [kind === 'boolean' ? filter.value === 'true' : filter.value] })
    } else if (kind === 'text') {
      if (filter.value?.trim()) criteria.push({ fieldName, operator: 'CONTAINS', values: [filter.value.trim()] })
    } else {
      const bound = (value: string | undefined, end: boolean) => {
        if (!value) return undefined
        if (kind === 'number') return Number(value)
        return field.type === 'DATE_TIME' ? `${value}T${end ? '23:59:59' : '00:00:00'}Z` : value
      }
      const from = bound(filter.from, false)
      const to = bound(filter.to, true)
      if (from !== undefined && !(typeof from === 'number' && Number.isNaN(from))) criteria.push({ fieldName, operator: 'GREATER_THAN_OR_EQUALS', values: [from] })
      if (to !== undefined && !(typeof to === 'number' && Number.isNaN(to))) criteria.push({ fieldName, operator: 'LESS_THAN_OR_EQUALS', values: [to] })
    }
  }
  return criteria
}

/**
 * The picker page request for the filters and ordering, continuing after the options loaded so
 * far: by keyset (the last id) when ordering by the primary key alone, else by offset.
 * @param picker - The picker.
 * @param preferences - Filters and the chosen ordering.
 * @param fields - The picker table's fields.
 * @param primaryKey - The picker table's primary key field.
 * @param loaded - The options already loaded (empty for the first page).
 * @returns The request.
 */
export function pickerPageRequest(
  picker: QPossibleValuePicker,
  preferences: PickerPreferences,
  fields: Record<string, QFieldMetaData> | undefined,
  primaryKey: string | undefined,
  loaded: QPossibleValue[]
): PickerPageRequest {
  const sort = picker.sorts?.[preferences.sortIndex] ?? picker.sorts?.[0]
  const orderBys = sort && (!fields || canSortField(fields[sort.fieldName])) ? [{ fieldName: sort.fieldName, isAscending: sort.isAscending }] : undefined
  const request: PickerPageRequest = {
    filter: { criteria: pickerCriteria(preferences.filters, fields), booleanOperator: 'AND', ...(orderBys ? { orderBys } : {}) },
  }
  if (loaded.length) {
    if (sort && primaryKey && sort.fieldName === primaryKey) request.afterId = loaded[loaded.length - 1].id
    else request.skip = loaded.length
  }
  return request
}

/**
 * The local storage key of a field's picker preferences.
 * @param tableName - The picker's table.
 * @param fieldName - The field.
 * @returns The key.
 */
export function pickerStorageKey(tableName: string | undefined, fieldName: string): string {
  return `qqq-picker-${tableName ?? ''}-${fieldName}`
}

/**
 * The remembered preferences of a field (defaults when none, or storage is unavailable).
 * @param key - {@link pickerStorageKey}.
 * @returns The preferences.
 */
export function readPickerPreferences(key: string): PickerPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<PickerPreferences> | null
    if (!stored || typeof stored !== 'object') return DEFAULT_PICKER_PREFERENCES
    return {
      filters: stored.filters && typeof stored.filters === 'object' ? stored.filters : {},
      sortIndex: Number.isInteger(stored.sortIndex) ? stored.sortIndex! : 0,
      view: stored.view === 'list' ? 'list' : 'grid',
    }
  } catch {
    return DEFAULT_PICKER_PREFERENCES
  }
}

/**
 * Remember a field's preferences (ignored when storage is unavailable).
 * @param key - {@link pickerStorageKey}.
 * @param preferences - The preferences.
 */
export function writePickerPreferences(key: string, preferences: PickerPreferences): void {
  try {
    localStorage.setItem(key, JSON.stringify(preferences))
  } catch {
    /* private mode or blocked storage: the picker still works */
  }
}
