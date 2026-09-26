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
 * @file Pure model of a saved report's pivot table definition (`pivotTableJson`): parsing,
 * serializing in the shape Material writes, the aggregate functions offered per field type,
 * the report-column field options, and the editor's "Missing value" validation
 * (Material `PivotTableDefinitionModels.ts` and `PivotTableSetupWidget.tsx`).
 */

import type { QFieldMetaData, QFieldType, QTableMetaData } from '@/types'
import { asList, isPlainObject } from '../widget-types'

/** A part of the definition: the row group-bys, the column group-bys, or the values. */
export type PivotSection = 'rows' | 'columns' | 'values'

/**
 * One row or column group-by, or one value, of a definition being shown or edited.
 * `function` is used by values only. `extra` keeps any other properties of the saved
 * entry (e.g. `showTotals`) so they are written back unchanged.
 */
export interface PivotItem {
  /** Unique key (Material's `PivotObjectKey`), also written into the JSON as Material does. */
  key: number
  /** Field name (`joinTable.field` for a field of an exposed join); null until chosen. */
  fieldName: string | null
  /** Aggregate function of a value (e.g. `COUNT`); null until chosen. */
  function?: string | null
  /** Other properties of the saved entry, kept as they were. */
  extra: Record<string, unknown>
}

/**
 * A pivot table definition. A part is undefined when the saved JSON does not have it
 * (a new definition has none until one is added), matching what Material writes.
 */
export interface PivotDefinition {
  rows?: PivotItem[]
  columns?: PivotItem[]
  values?: PivotItem[]
  /** Other top-level properties of the saved definition, kept as they were. */
  extra: Record<string, unknown>
}

/** A field that may be chosen in the editor's field pickers. */
export interface PivotFieldOption {
  /** Field name as written into the definition (`joinTable.field` for join fields). */
  fieldName: string
  /** Field label (without the table prefix: options are grouped by table). */
  label: string
  /** Group heading, e.g. "Person fields". */
  group: string
  /** The field's metadata. */
  field: QFieldMetaData
}

/** Labels for `PivotTableFunction` values, matching the Material dashboard. */
export const PIVOT_FUNCTION_LABELS: Record<string, string> = {
  SUM: 'Sum',
  COUNT: 'Count',
  COUNT_NUMS: 'Count Numbers',
  AVERAGE: 'Average',
  MAX: 'Max',
  MIN: 'Min',
  PRODUCT: 'Product',
  STD_DEV: 'StdDev',
  STD_DEVP: 'StdDevp',
  VAR: 'Var',
  VARP: 'Varp',
}

/** Why the pivot table cannot be set up yet: no table (Material wording). */
export const PIVOT_NO_TABLE_REASON = 'You must select a table before you can set up your pivot table'

/** Why the pivot table cannot be set up yet: no report columns (Material wording). */
export const PIVOT_NO_COLUMNS_REASON = "You must set up your report's Columns before you can set up your Pivot Table"

/** The aggregate functions offered when editing, in Material's order (`allFunctions`). */
export const PIVOT_EDIT_FUNCTIONS: readonly string[] = ['SUM', 'COUNT', 'AVERAGE', 'MAX', 'MIN', 'PRODUCT', 'STD_DEV', 'STD_DEVP', 'VAR', 'VARP']

/** Only `COUNT` (Material `onlyCount`). */
const ONLY_COUNT: readonly string[] = ['COUNT']

/** Functions for date fields (Material `functionsForDates`). */
const FUNCTIONS_FOR_DATES: readonly string[] = ['COUNT', 'AVERAGE', 'MAX', 'MIN']

/** Functions per field type (Material `functionsPerFieldType`); unlisted types get every function. */
const FUNCTIONS_PER_FIELD_TYPE: Partial<Record<QFieldType, readonly string[]>> = {
  STRING: ONLY_COUNT,
  BOOLEAN: ONLY_COUNT,
  BLOB: ONLY_COUNT,
  HTML: ONLY_COUNT,
  PASSWORD: ONLY_COUNT,
  TEXT: ONLY_COUNT,
  TIME: ONLY_COUNT,
  INTEGER: PIVOT_EDIT_FUNCTIONS,
  DECIMAL: PIVOT_EDIT_FUNCTIONS,
  DATE: FUNCTIONS_FOR_DATES,
  DATE_TIME: FUNCTIONS_FOR_DATES,
}

/** Next key value; seeded from the clock like Material's `PivotObjectKey`. */
let nextKeyValue = Date.now()

/**
 * Returns a new unique key for a pivot item.
 *
 * @returns The key.
 */
export function nextPivotKey(): number {
  return nextKeyValue++
}

/**
 * The aggregate functions that may be applied to a field (Material
 * `PivotTableValueElement.getFunctionsForField`): a field with a possible-value source counts
 * as a string (Count only), and without a field every function is offered.
 *
 * @param field - The value's field, when chosen.
 * @returns The function names, in Material's order.
 */
export function functionsForField(field: QFieldMetaData | undefined): readonly string[] {
  if (field) {
    const type: QFieldType = field.possibleValueSourceName ? 'STRING' : field.type
    const functions = FUNCTIONS_PER_FIELD_TYPE[type]
    if (functions) return functions
  }
  return PIVOT_EDIT_FUNCTIONS
}

/**
 * Finds a field of a table, or of one of its exposed joins for a `joinTable.field` name.
 *
 * @param table - Table metadata.
 * @param fieldName - Field name.
 * @returns The field metadata, or undefined when unknown.
 */
export function findPivotField(table: QTableMetaData | undefined, fieldName: string | null | undefined): QFieldMetaData | undefined {
  if (!table || !fieldName) return undefined
  const own = table.fields?.[fieldName]
  if (own) return own
  const dot = fieldName.indexOf('.')
  if (dot <= 0) return undefined
  const join = (table.exposedJoins ?? []).find((candidate) => candidate.joinTable?.name === fieldName.slice(0, dot))
  return join?.joinTable?.fields?.[fieldName.slice(dot + 1)]
}

/**
 * Parses one part of a saved definition.
 *
 * @param value - The saved list.
 * @param withFunction - True for values (reads `function`).
 * @returns The items (undefined for an absent part), or `null` when malformed.
 */
function parseItems(value: unknown, withFunction: boolean): PivotItem[] | undefined | null {
  if (value === undefined || value === null) return undefined
  const list = asList(value)
  if (list === undefined) return null
  const items: PivotItem[] = []
  for (const entry of list) {
    if (!isPlainObject(entry)) return null
    const { fieldName, function: aggregate, key, ...extra } = entry
    const name = typeof fieldName === 'string' && fieldName ? fieldName : null
    if (fieldName !== undefined && fieldName !== null && typeof fieldName !== 'string') return null
    const item: PivotItem = { key: typeof key === 'number' ? key : nextPivotKey(), fieldName: name, extra }
    if (withFunction) item.function = typeof aggregate === 'string' && aggregate ? aggregate : null
    else if (aggregate !== undefined) item.extra = { ...extra, function: aggregate }
    items.push(item)
  }
  return items
}

/**
 * Parses a pivot table definition from the parsed `pivotTableJson` value.
 *
 * @param value - The parsed JSON (undefined or null for none).
 * @returns The definition (empty for none), or undefined when its shape is not a definition.
 */
export function parsePivotDefinition(value: unknown): PivotDefinition | undefined {
  if (value === undefined || value === null) return { extra: {} }
  if (!isPlainObject(value)) return undefined
  const { rows, columns, values, ...extra } = value
  const parsedRows = parseItems(rows, false)
  const parsedColumns = parseItems(columns, false)
  const parsedValues = parseItems(values, true)
  if (parsedRows === null || parsedColumns === null || parsedValues === null) return undefined
  const definition: PivotDefinition = { extra }
  if (parsedRows) definition.rows = parsedRows
  if (parsedColumns) definition.columns = parsedColumns
  if (parsedValues) definition.values = parsedValues
  return definition
}

/**
 * Whether a definition has any row, column or value.
 *
 * @param definition - The definition.
 * @returns True when at least one part is not empty.
 */
export function hasPivotEntries(definition: PivotDefinition): boolean {
  return Boolean(definition.rows?.length || definition.columns?.length || definition.values?.length)
}

/**
 * Copies a definition so the editor can change it without touching the original.
 *
 * @param definition - The definition.
 * @returns A copy with new lists and items.
 */
export function clonePivotDefinition(definition: PivotDefinition): PivotDefinition {
  const copy: PivotDefinition = { extra: { ...definition.extra } }
  if (definition.rows) copy.rows = definition.rows.map((item) => ({ ...item }))
  if (definition.columns) copy.columns = definition.columns.map((item) => ({ ...item }))
  if (definition.values) copy.values = definition.values.map((item) => ({ ...item }))
  return copy
}

/**
 * Serializes a definition into `pivotTableJson`, in the shape Material writes: parts it has,
 * each entry with its `fieldName` (plus `function` for values) and its `key`.
 *
 * @param definition - The definition.
 * @returns The JSON string.
 */
export function serializePivotDefinition(definition: PivotDefinition): string {
  const groupBy = (item: PivotItem) => ({ ...item.extra, fieldName: item.fieldName, key: item.key })
  const value = (item: PivotItem) => ({ ...item.extra, fieldName: item.fieldName, function: item.function ?? null, key: item.key })
  return JSON.stringify({
    ...definition.extra,
    ...(definition.rows ? { rows: definition.rows.map(groupBy) } : {}),
    ...(definition.columns ? { columns: definition.columns.map(groupBy) } : {}),
    ...(definition.values ? { values: definition.values.map(value) } : {}),
  })
}

/**
 * Counts the unset fields of a definition (Material `validateForm`): a group-by without a
 * field, and a value without a field or without a function.
 *
 * @param definition - The definition being edited.
 * @returns The number of missing values.
 */
export function countMissingValues(definition: PivotDefinition): number {
  let missing = 0
  for (const item of [...(definition.rows ?? []), ...(definition.columns ?? [])]) {
    if (!item.fieldName) missing++
  }
  for (const item of definition.values ?? []) {
    if (!item.fieldName) missing++
    if (!item.function) missing++
  }
  return missing
}

/**
 * Material's validation message.
 *
 * @param missing - Number of missing values (at least 1).
 * @returns E.g. "Missing value in 2 fields.".
 */
export function missingValueMessage(missing: number): string {
  return `Missing value in ${missing} field${missing === 1 ? '' : 's'}.`
}

/**
 * The names of the report's visible columns, from the parsed `columnsJson`: the fields the
 * pivot table may use. As on the backend (`ReportColumns.extractVisibleColumns`), a column
 * without `isVisible` is visible and `__check` columns are skipped.
 *
 * @param columns - The parsed columns JSON (`{columns: [...]}` or a list).
 * @returns The field names in column order; empty when there are none or the JSON is malformed.
 */
export function reportColumnFieldNames(columns: unknown): string[] {
  const list = isPlainObject(columns) ? asList(columns.columns) : asList(columns)
  const names: string[] = []
  for (const column of list ?? []) {
    let name: unknown = column
    if (isPlainObject(column)) {
      if (column.isVisible === false) continue
      name = column.name
    }
    if (typeof name === 'string' && name && !name.startsWith('__check') && !names.includes(name)) names.push(name)
  }
  return names
}

/**
 * The fields offered by the editor's field pickers (Material `FieldAutoComplete`): the table's
 * fields and then each exposed join's, each sorted by label, limited to the report's columns.
 *
 * @param table - The report's table metadata.
 * @param availableFieldNames - The report's visible column names.
 * @returns The options.
 */
export function pivotFieldOptions(table: QTableMetaData, availableFieldNames: readonly string[]): PivotFieldOption[] {
  const options: PivotFieldOption[] = []
  const addTable = (source: QTableMetaData, joinName: string | null) => {
    const fields = Object.values(source.fields ?? {}).sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name))
    for (const field of fields) {
      const fieldName = joinName ? `${joinName}.${field.name}` : field.name
      if (availableFieldNames.length > 0 && !availableFieldNames.includes(fieldName)) continue
      options.push({ fieldName, label: field.label || field.name, group: `${source.label} fields`, field })
    }
  }
  addTable(table, null)
  for (const join of table.exposedJoins ?? []) {
    if (join.joinTable) addTable(join.joinTable, join.joinTable.name)
  }
  return options
}

/**
 * Moves one entry of a list.
 *
 * @param list - The list.
 * @param from - Index of the entry to move.
 * @param to - Its new index.
 * @returns The reordered copy (an unchanged copy when either index is out of range).
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list]
  const moved = [...list]
  const [item] = moved.splice(from, 1)
  moved.splice(to, 0, item)
  return moved
}
