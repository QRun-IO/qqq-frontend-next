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
 * @file Helpers for widgets that read backing records themselves (data bag viewer,
 * script viewer, child record list).
 */

import type { QQueryFilter, QRecord } from '@/types'
import { getRecord } from '@/lib/api/tables'
import { getErrorStatusCode } from '@/lib/utils/error-utils'

/**
 * Builds a single-field EQUALS filter with an optional ordering and limit.
 *
 * @param fieldName - Field compared with EQUALS.
 * @param value - Value the field must equal.
 * @param orderBy - Optional field to sort by.
 * @param isAscending - Sort direction for `orderBy`.
 * @param limit - Maximum number of records.
 * @returns A filter for the typed query API.
 */
export function equalsFilter(
  fieldName: string,
  value: string | number,
  orderBy?: string,
  isAscending = true,
  limit = 100,
): Partial<QQueryFilter> {
  return {
    criteria: [{ fieldName, operator: 'EQUALS', values: [value] }],
    orderBys: orderBy ? [{ fieldName: orderBy, isAscending }] : [],
    booleanOperator: 'AND',
    skip: 0,
    limit,
  }
}

/**
 * Gets a record, resolving to `null` when the backend answers 404, so a missing
 * record is a normal state (no failed query, no error toast) rather than an error.
 *
 * @param tableName - Table to read.
 * @param primaryKey - Primary key of the record.
 * @returns The record, or `null` when it does not exist.
 */
export async function getRecordOrNull(tableName: string, primaryKey: string | number): Promise<QRecord | null> {
  try {
    return await getRecord(tableName, primaryKey)
  } catch (error) {
    if (getErrorStatusCode(error) === 404) return null
    throw error
  }
}

/**
 * Formats an ISO date-time value for display in the viewer's locale.
 *
 * @param value - Raw backend value (ISO-8601 string) or anything else.
 * @returns A localized date-time string, the raw text when unparseable, or `''`.
 */
export function formatWidgetDateTime(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

/**
 * Renders a value as text, keeping falsy-but-meaningful values such as `0` and `false`.
 *
 * @param value - Any raw value.
 * @returns The display text (`''` for null/undefined).
 */
export function displayText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
