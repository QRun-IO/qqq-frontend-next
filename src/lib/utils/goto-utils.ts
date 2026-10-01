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
 * @file goto-utils — the Material "Go To" record lookup: which fields (the primary key and the
 * table's `materialDashboard.gotoFieldNames` unique keys) can find a record, and the filter a
 * lookup sends.
 */

import type { QFieldMetaData, QQueryFilter, QTableMetaData } from '@/types'

/** Supplemental metadata type the Material dashboard declares its table settings under. */
export const MATERIAL_DASHBOARD_TYPE = 'materialDashboard'

/** Message when a lookup matches nothing (Material's text). */
export const GOTO_NOT_FOUND_MESSAGE = 'Record not found.'
/** Message when a lookup matches more than one record (Material's text). */
export const GOTO_MULTIPLE_MESSAGE = 'More than 1 record was found...'
/** Message when the table offers no lookup fields (Material's text). */
export const GOTO_NOT_CONFIGURED_MESSAGE = 'This table is not configured for this feature.'

/**
 * A plain object, or `undefined`.
 *
 * @param value - Any value.
 * @returns The value as a record when it is a non-array object.
 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

/**
 * The table's Material dashboard supplemental metadata, from the v1 key (`supplementalMetaData`)
 * or the legacy one (`supplementalTableMetaData`).
 *
 * @param table - Table metadata.
 * @returns The `materialDashboard` object, or `undefined`.
 */
export function materialDashboardTableMetaData(table: QTableMetaData | undefined): Record<string, unknown> | undefined {
  return asRecord(asRecord(table?.supplementalMetaData)?.[MATERIAL_DASHBOARD_TYPE])
    ?? asRecord(asRecord(table?.supplementalTableMetaData)?.[MATERIAL_DASHBOARD_TYPE])
}

/**
 * The table's configured Go To keys: each entry is a list of field names that together find
 * one record.
 *
 * @param table - Table metadata.
 * @returns The keys, or `null` when the table does not configure Go To.
 */
export function gotoFieldNames(table: QTableMetaData | undefined): string[][] | null {
  const names = materialDashboardTableMetaData(table)?.gotoFieldNames
  if (!Array.isArray(names)) return null
  return names.filter(Array.isArray).map((key) => key.filter((name): name is string => typeof name === 'string'))
}

/**
 * Whether the table offers the Go To button (Material shows it when `gotoFieldNames` is set).
 *
 * @param table - Table metadata.
 * @returns `true` when the table configures Go To.
 */
export function hasGotoFieldNames(table: QTableMetaData | undefined): boolean {
  return gotoFieldNames(table) !== null
}

/**
 * The lookup options a Go To dialog offers, as Material builds them: each configured key's
 * fields (unknown names dropped), with the primary key first unless a key already is it.
 *
 * @param table - Table metadata.
 * @returns One field list per option.
 */
export function gotoOptions(table: QTableMetaData): QFieldMetaData[][] {
  const primaryKey = table.fields[table.primaryKeyField]
  let hasPrimaryKey = false
  const options: QFieldMetaData[][] = []
  for (const key of gotoFieldNames(table) ?? []) {
    const fields = key.map((name) => table.fields[name]).filter((field): field is QFieldMetaData => Boolean(field))
    if (fields.some((field) => field.name === primaryKey?.name)) hasPrimaryKey = true
    if (fields.length > 0) options.push(fields)
  }
  if (primaryKey && !hasPrimaryKey) options.unshift([primaryKey])
  return options
}

/**
 * The query a Go To lookup sends: EQUALS on each field with a value (blank fields are left
 * out), limited to two rows since only "none", "one" or "more than one" matters.
 *
 * @param option - The option's fields.
 * @param values - Entered values by field name.
 * @returns The filter, or `null` when no field has a value.
 */
export function gotoFilter(option: QFieldMetaData[], values: Record<string, string>): QQueryFilter | null {
  const criteria = option
    .filter((field) => (values[field.name] ?? '').trim() !== '')
    .map((field) => ({ fieldName: field.name, operator: 'EQUALS' as const, values: [values[field.name].trim()] }))
  if (criteria.length === 0) return null
  return { criteria, booleanOperator: 'AND', skip: 0, limit: 2 }
}
