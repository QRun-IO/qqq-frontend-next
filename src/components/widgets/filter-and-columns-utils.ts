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
 * @file filter-and-columns-utils — pure helpers of the `filterAndColumnsSetup` widget (saved
 * report filter and columns): Material's wording, default criteria seeded from form values,
 * removal of fields the table no longer has, filter variables, and the exact `queryFilterJson`
 * and `columnsJson` shapes Material writes (`FilterUtils.prepQueryFilterForBackend` and
 * `QQueryColumns`), which the backend renders reports from.
 */

import type { QFieldMetaData, QFilterCriteria, QQueryFilter, QTableMetaData, QueryJoin } from '@/types'
import type { ApiVersionRef } from '@/lib/api/api-versioned'
import {
  emptyFilter,
  isFilterVariableExpression,
  prepFilterForBackend,
  referencedFieldNames,
  resolveField,
} from '@/lib/utils/filter-utils'
import { getQueryColumns, orderColumns } from '@/lib/utils/query-columns'
import { buildViewJson, isColumnVisible, viewToState, type SavedViewColumn } from '@/lib/utils/saved-view-utils'

/** Material's warning when a preview or editor query would need a variable's value (RecordQuery `updateTable`). */
export const MISSING_VARIABLE_MESSAGE = 'Cannot perform query because of a missing value for a variable.'

/** Rows the preview grid shows (the first page). */
export const PREVIEW_PAGE_SIZE = 25

/**
 * Tooltip of the edit and add buttons while no table (or, for an API-versioned widget, no API
 * details) is chosen, in Material's wording.
 *
 * @param isApiVersioned - Whether the widget needs API details too.
 * @param hideColumns - Whether columns are hidden (then only filters are mentioned).
 * @returns The tooltip text.
 */
export function selectTableFirstMessage(isApiVersioned: boolean, hideColumns: boolean): string {
  return `You must select a table${isApiVersioned ? ' and API details' : ''} before you can set up your filters${hideColumns ? '' : ' and columns'}`
}

/**
 * Label of the header edit button: Material's "Edit Filters and Columns" ("Edit Filters" when
 * columns are hidden), unless the widget data overrides it (`editButtonLabel`).
 *
 * @param hideColumns - Whether columns are hidden.
 * @param override - `editButtonLabel` from the widget data.
 * @returns The label.
 */
export function editButtonLabel(hideColumns: boolean, override?: string | null): string {
  return override || (hideColumns ? 'Edit Filters' : 'Edit Filters and Columns')
}

/**
 * Heading of the editor dialog: Material's "Edit Filters and Columns" ("Edit Filters" when
 * columns are hidden), unless the widget data overrides it (`modalHeader`).
 *
 * @param hideColumns - Whether columns are hidden.
 * @param override - `modalHeader` from the widget data.
 * @returns The heading.
 */
export function editorHeading(hideColumns: boolean, override?: string | null): string {
  return override || (hideColumns ? 'Edit Filters' : 'Edit Filters and Columns')
}

/**
 * Material's alert when default filter fields have no value in the form yet.
 *
 * @param labels - Labels of the fields that need a value.
 * @returns The alert text.
 */
export function missingDefaultFieldsMessage(labels: string[]): string {
  return `The following fields must first be selected to edit the filter: '${labels.join(', ')}'`
}

/**
 * Material's warning for stored criteria on fields the table no longer has.
 *
 * @param fieldNames - The removed criteria's field names.
 * @returns The warning text ("; "-separated), or an empty string.
 */
export function removedFieldsWarning(fieldNames: string[]): string {
  return fieldNames.map((name) => `Removing non-existing filter field: ${name}`).join('; ')
}

/**
 * Whether a form value counts as set for a default filter field.
 *
 * @param value - The form value.
 * @returns False for undefined, null and blank text.
 */
export function hasFormValue(value: unknown): boolean {
  return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')
}

/**
 * The form field a default filter field's value comes from (`filterDefaultFieldNameSourceFieldNames`,
 * else the same name).
 *
 * @param fieldName - A `filterDefaultFieldNames` entry.
 * @param sourceFieldNames - `filterDefaultFieldNameSourceFieldNames` from the widget data.
 * @returns The form field name.
 */
export function defaultFieldSource(fieldName: string, sourceFieldNames?: Record<string, string> | null): string {
  return sourceFieldNames?.[fieldName] || fieldName
}

/**
 * Seeds a filter with the default criteria (Material): for each default field, criteria on it
 * are removed and, when the form has a value for it, an `EQUALS` criterion with that value is
 * added.
 *
 * @param filter - The stored filter.
 * @param defaultFieldNames - `filterDefaultFieldNames` from the widget data.
 * @param values - The form (or record) values.
 * @param sourceFieldNames - `filterDefaultFieldNameSourceFieldNames` from the widget data.
 * @returns The seeded filter (the input when there are no default fields).
 */
export function seedDefaultCriteria(
  filter: QQueryFilter,
  defaultFieldNames: string[] | undefined,
  values: Record<string, unknown>,
  sourceFieldNames?: Record<string, string> | null
): QQueryFilter {
  if (!defaultFieldNames?.length) return filter
  let criteria = filter.criteria
  for (const fieldName of defaultFieldNames) {
    criteria = criteria.filter((criterion) => criterion.fieldName !== fieldName)
    const value = values[defaultFieldSource(fieldName, sourceFieldNames)]
    if (hasFormValue(value)) {
      criteria = [...criteria, { fieldName, operator: 'EQUALS', values: [value as QFilterCriteria['values'][number]] }]
    }
  }
  return { ...filter, criteria }
}

/**
 * The default filter fields that have no value in the form yet.
 *
 * @param defaultFieldNames - `filterDefaultFieldNames` from the widget data.
 * @param values - The form values.
 * @param sourceFieldNames - `filterDefaultFieldNameSourceFieldNames` from the widget data.
 * @returns The field names (of the filtered table) missing a value.
 */
export function missingDefaultFields(defaultFieldNames: string[] | undefined, values: Record<string, unknown>, sourceFieldNames?: Record<string, string> | null): string[] {
  return (defaultFieldNames ?? []).filter((fieldName) => !hasFormValue(values[defaultFieldSource(fieldName, sourceFieldNames)]))
}

/**
 * Removes the top-level criteria on fields the table (and its exposed joins) does not have, as
 * Material does after loading the table metadata.
 *
 * @param table - The filtered table's metadata.
 * @param filter - The filter.
 * @returns The filter without those criteria, and their field names.
 */
export function removeUnknownCriteria(table: QTableMetaData, filter: QQueryFilter): { filter: QQueryFilter; removed: string[] } {
  const removed: string[] = []
  const criteria = filter.criteria.filter((criterion) => {
    if (resolveField(table, criterion.fieldName)) return true
    removed.push(criterion.fieldName)
    return false
  })
  return { filter: removed.length ? { ...filter, criteria } : filter, removed }
}

/**
 * Whether any criterion value (in the filter or its sub-filters) is a filter variable, so a
 * query cannot run until it has a value (Material RecordQuery `updateTable`).
 *
 * @param filter - The filter.
 * @returns True when a variable is used.
 */
export function filterHasVariables(filter: Partial<QQueryFilter> | undefined): boolean {
  if (!filter) return false
  if ((filter.criteria ?? []).some((criterion) => (criterion?.values ?? []).some(isFilterVariableExpression))) return true
  return (filter.subFilters ?? []).some(filterHasVariables)
}

/**
 * The table without the exposed joins the widget omits (`omitExposedJoins`, by join table name),
 * so the filter builder, sort, column picker and grid do not offer them (Material `FieldListMenu`).
 *
 * @param table - The table metadata.
 * @param omitExposedJoins - Join table names to omit.
 * @returns The table, or a copy without those joins.
 */
export function omitExposedJoins(table: QTableMetaData, omitExposedJoins: string[] | undefined): QTableMetaData {
  if (!omitExposedJoins?.length || !table.exposedJoins?.length) return table
  return { ...table, exposedJoins: table.exposedJoins.filter((join) => !omitExposedJoins.includes(join.joinTable?.name ?? '')) }
}

/**
 * A field lookup for a table and its exposed joins.
 *
 * @param table - The table metadata.
 * @returns A function from a criterion field name to its metadata.
 */
export function fieldLookup(table: QTableMetaData): (fieldName: string) => QFieldMetaData | undefined {
  return (fieldName) => resolveField(table, fieldName)?.field
}

/** A filter in the JSON shape Material saves (`QQueryFilter` as `prepQueryFilterForBackend` builds it). */
export interface BackendQueryFilter {
  criteria: QFilterCriteria[]
  orderBys?: Array<{ fieldName: string; isAscending: boolean }>
  subFilters: BackendQueryFilter[]
  booleanOperator: 'AND' | 'OR'
}

/**
 * Prepares a filter as Material saves it in `queryFilterJson` and puts it in its "open in new
 * window" links: incomplete criteria dropped, values typed for their fields, no values for the
 * value-less operators, sub-filters prepared the same way, and the keys in Material's order
 * (`criteria`, `orderBys`, `subFilters`, `booleanOperator`; no paging).
 *
 * @param table - The filtered table (for value types).
 * @param filter - The filter, with its sort in `orderBys`.
 * @returns The filter for the backend.
 */
export function toBackendFilter(table: QTableMetaData, filter: QQueryFilter): BackendQueryFilter {
  const shape = (f: QQueryFilter): BackendQueryFilter => ({
    criteria: f.criteria.map((criterion) => ({ ...criterion })),
    ...(f.orderBys ? { orderBys: f.orderBys.map(({ fieldName, isAscending }) => ({ fieldName, isAscending })) } : {}),
    subFilters: (f.subFilters ?? []).map(shape),
    booleanOperator: f.booleanOperator === 'OR' ? 'OR' : 'AND',
  })
  return shape(prepFilterForBackend(filter, fieldLookup(table)))
}

/** The column selection the editor, the summary and the preview work with. */
export interface ColumnsState {
  /** Explicit visibility by column name. */
  columnVisibility: Record<string, boolean>
  /** Column order. */
  columnOrder: string[]
  /** Column widths. */
  columnWidths: Record<string, number>
}

/**
 * Reads the stored columns (`{columns: [{name, isVisible, width, pinned}]}`, or a plain list of
 * names) into column state. Columns the table no longer has are ignored; the table's columns
 * the stored list does not name are hidden, so saving keeps exactly the columns the report had.
 *
 * @param table - The table metadata.
 * @param entries - The stored column entries.
 * @returns The column state, or undefined when no columns are stored.
 */
export function columnsStateFromEntries(table: QTableMetaData, entries: Array<{ name: string; isVisible: boolean; width?: number }> | undefined): ColumnsState | undefined {
  const listed = (entries ?? []).filter((entry) => entry.name !== '__check__')
  if (listed.length === 0) return undefined
  const state = viewToState(table, { queryFilter: {}, queryColumns: { columns: listed } }, PREVIEW_PAGE_SIZE, [PREVIEW_PAGE_SIZE])
  const named = new Set(state.columnOrder)
  const columnVisibility = { ...state.columnVisibility }
  for (const column of getQueryColumns(table)) if (!named.has(column.name)) columnVisibility[column.name] = false
  return { columnVisibility, columnOrder: state.columnOrder, columnWidths: state.columnWidths }
}

/** Column state with the table's default columns (base fields shown, join fields hidden). */
export const DEFAULT_COLUMNS_STATE: ColumnsState = { columnVisibility: {}, columnOrder: [], columnWidths: {} }

/**
 * The column names a column state shows, in order.
 *
 * @param table - The table metadata.
 * @param state - The column state.
 * @returns Visible column names.
 */
export function visibleColumnNames(table: QTableMetaData, state: ColumnsState): string[] {
  return orderColumns(getQueryColumns(table), state.columnOrder)
    .filter((column) => isColumnVisible(column.name, state.columnVisibility))
    .map((column) => column.name)
}

/**
 * Builds the columns as Material saves them in `columnsJson` (`JSON.stringify(view.queryColumns)`
 * after `sortColumnsFixingPinPositions`): the selection column, then every column of the table
 * with its visibility and width, in order, with pinned-left columns first.
 *
 * @param table - The table metadata.
 * @param state - The column state.
 * @returns The columns object.
 */
export function toColumnsJson(table: QTableMetaData, state: ColumnsState): { columns: SavedViewColumn[] } {
  const view = buildViewJson(table, {
    userFilter: emptyFilter(PREVIEW_PAGE_SIZE),
    sortOrder: [],
    columnVisibility: state.columnVisibility,
    columnOrder: state.columnOrder,
    columnWidths: state.columnWidths,
    pageSize: PREVIEW_PAGE_SIZE,
    filterMode: 'advanced',
  })
  const columns = view.queryColumns?.columns ?? []
  const rank = (column: SavedViewColumn) => (column.pinned === 'left' ? 0 : column.pinned === 'right' ? 2 : 1)
  return { columns: [...columns].sort((a, b) => rank(a) - rank(b)) }
}

/**
 * The joins a preview query needs: the readable exposed joins whose fields are shown or used by
 * the filter or sort (as the query screen does), and whether a many-side join can repeat rows.
 *
 * @param table - The table metadata.
 * @param columnNames - Visible column names.
 * @param filter - The filter, with its sort.
 * @returns The joins (undefined when none) and whether to ask for the distinct count.
 */
export function previewJoins(table: QTableMetaData, columnNames: string[], filter: Partial<QQueryFilter>): { joins?: QueryJoin[]; includeDistinct: boolean } {
  const used = new Set<string>()
  for (const name of [...columnNames, ...referencedFieldNames(filter)]) {
    const dot = name.indexOf('.')
    if (dot > 0) used.add(name.slice(0, dot))
  }
  const active = (table.exposedJoins ?? []).filter((join) => join.joinTable?.name && join.joinTable.readPermission !== false && used.has(join.joinTable.name))
  if (active.length === 0) return { includeDistinct: false }
  return {
    joins: active.map((join): QueryJoin => ({
      joinTable: join.joinTable!.name,
      select: true,
      type: 'LEFT',
      ...(join.joinPath?.length === 1 && join.joinPath[0].name ? { joinName: join.joinPath[0].name } : {}),
    })),
    includeDistinct: active.some((join) => join.isMany),
  }
}

/**
 * The query screen link Material's preview "Open In New Window" button opens: the table's query
 * screen with the current filter (and sort) as `?filter=` JSON.
 *
 * @param tableName - The table name.
 * @param filter - The filter prepared for the backend.
 * @returns The link path.
 */
export function openInNewWindowHref(tableName: string, filter: BackendQueryFilter): string {
  return `/app/${encodeURIComponent(tableName)}?filter=${encodeURIComponent(JSON.stringify(filter))}`
}

/**
 * The API version an API-versioned widget works with: `apiName`, `apiPath` and `apiVersion`
 * from the widget data, else from the form (or record) values, as in Material.
 *
 * @param data - The widget data.
 * @param values - The form (or record) values.
 * @returns The API version, or undefined while any part is missing.
 */
export function resolveApiVersion(
  data: { apiName?: string | null; apiPath?: string | null; apiVersion?: string | null } | undefined,
  values: Record<string, unknown>
): ApiVersionRef | undefined {
  const pick = (own: string | null | undefined, key: string) => {
    if (own) return own
    const value = values[key]
    return typeof value === 'string' && value ? value : undefined
  }
  const name = pick(data?.apiName, 'apiName')
  const path = pick(data?.apiPath, 'apiPath')
  const version = pick(data?.apiVersion, 'apiVersion')
  return name && path && version ? { name, path, version } : undefined
}
