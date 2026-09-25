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
 * @file saved-view-utils — converts the query screen's state to and from the backend
 * `savedView.viewJson` format, which is the Material dashboard's `RecordQueryView`
 * (`{queryFilter, queryColumns: {columns: [{name, isVisible, width, pinned}]}, rowsPerPage,
 * quickFilterFieldNames, mode}`), so views saved in either UI load in the other.
 */

import type { QFilterOrderBy, QQueryFilter, QTableMetaData } from '@/types'
import { normalizeFilter, isCriterionComplete, emptyFilter } from './filter-utils'
import { getQueryColumns, orderColumns } from './query-columns'

/** One column entry in a saved view (Material `QQueryColumns.Column`). */
export interface SavedViewColumn {
  /** Field name (`field` or `joinTable.field`); `__check__` is the selection column. */
  name: string
  /** Whether the column is shown. */
  isVisible: boolean
  /** Column width in pixels. */
  width?: number
  /** Pinned side, when pinned. */
  pinned?: 'left' | 'right'
}

/** The saved view JSON document (Material `RecordQueryView`). */
export interface RecordQueryView {
  /** Filter criteria, sub-filters, boolean operator and sort (`orderBys`). */
  queryFilter: Partial<QQueryFilter>
  /** Column visibility, order, widths and pins. */
  queryColumns?: { columns: SavedViewColumn[] }
  /** Rows per page. */
  rowsPerPage?: number
  /** Fields the user added as quick filters (Material basic mode). */
  quickFilterFieldNames?: string[]
  /** `basic` or `advanced` (Material). */
  mode?: string
  /** Informational identity of the view (`savedView:{id}`). */
  viewIdentity?: string
}

/** A saved view record returned by the `querySavedView` / `storeSavedView` processes. */
export interface SavedView {
  /** Backend record id. */
  id: number
  /** View name. */
  label: string
  /** Owner's user id (the session user's `idReference`). */
  userId?: string
  /** Table the view applies to. */
  tableName: string
  /** Parsed view document. */
  view: RecordQueryView
}

/** The query screen state a view captures. */
export interface ViewState {
  /** Advanced filter (criteria, sub-filters, boolean operator). */
  userFilter: QQueryFilter
  /** Sort order. */
  sortOrder: QFilterOrderBy[]
  /** Explicit column visibility. */
  columnVisibility: Record<string, boolean>
  /** Column order (field names). */
  columnOrder: string[]
  /** Column widths. */
  columnWidths: Record<string, number>
  /** Rows per page. */
  pageSize: number
  /** Filter panel mode. */
  filterMode: 'basic' | 'advanced'
}

/**
 * Whether a column is visible. Base-table columns default to visible; exposed-join
 * columns (`joinTable.field`) default to hidden, as in Material.
 *
 * @param name - Column name.
 * @param visibility - Explicit visibility map.
 * @returns True when the column is shown.
 */
export function isColumnVisible(name: string, visibility: Record<string, boolean>): boolean {
  const explicit = visibility[name]
  if (explicit !== undefined) return explicit
  return !name.includes('.')
}

/**
 * Lists every column the grid can show for a table: non-hidden base fields (primary key
 * first), then each readable exposed join's fields as `joinTable.field`.
 *
 * @param table - Table metadata.
 * @returns Column names in default order.
 */
export function allColumnNames(table: QTableMetaData): string[] {
  return getQueryColumns(table).map((c) => c.name)
}

/**
 * Builds the view document for the current screen state. Incomplete criteria are dropped,
 * as Material does before saving.
 *
 * @param table - Table metadata.
 * @param state - Current screen state.
 * @param base - The stored view being saved over, whose settings Next does not edit are kept.
 * @returns The view JSON document.
 */
export function buildViewJson(table: QTableMetaData, state: ViewState, base?: RecordQueryView): RecordQueryView {
  const strip = (filter: Partial<QQueryFilter>): Partial<QQueryFilter> => ({
    criteria: (filter.criteria ?? []).filter(isCriterionComplete),
    subFilters: (filter.subFilters ?? []).map((s) => strip(s) as QQueryFilter),
    booleanOperator: filter.booleanOperator ?? 'AND',
  })
  const ordered = orderColumns(getQueryColumns(table), state.columnOrder).map((c) => c.name)
  return {
    queryFilter: { ...strip(state.userFilter), orderBys: state.sortOrder },
    queryColumns: {
      columns: [
        { name: '__check__', isVisible: true, width: 100, pinned: 'left' },
        ...ordered.map((name) => ({
          name,
          isVisible: isColumnVisible(name, state.columnVisibility),
          width: state.columnWidths[name] ?? 150,
          ...(name === table.primaryKeyField ? { pinned: 'left' as const } : {}),
        })),
      ],
    },
    rowsPerPage: state.pageSize,
    quickFilterFieldNames: base?.quickFilterFieldNames ?? [],
    mode: state.filterMode,
  }
}

/**
 * Parses a saved view record's `viewJson` (a string or object), tolerating partial documents.
 *
 * @param viewJson - Raw view JSON.
 * @returns The view document.
 */
export function parseViewJson(viewJson: unknown): RecordQueryView {
  let parsed: unknown = viewJson
  if (typeof viewJson === 'string') {
    try {
      parsed = JSON.parse(viewJson)
    } catch {
      parsed = {}
    }
  }
  const source = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  const columns = (source.queryColumns as { columns?: unknown } | undefined)?.columns
  return {
    queryFilter: (source.queryFilter as Partial<QQueryFilter>) ?? {},
    queryColumns: Array.isArray(columns) ? { columns: columns as SavedViewColumn[] } : undefined,
    rowsPerPage: typeof source.rowsPerPage === 'number' ? source.rowsPerPage : undefined,
    quickFilterFieldNames: Array.isArray(source.quickFilterFieldNames) ? (source.quickFilterFieldNames as string[]) : [],
    mode: typeof source.mode === 'string' ? source.mode : undefined,
    viewIdentity: typeof source.viewIdentity === 'string' ? source.viewIdentity : undefined,
  }
}

/**
 * Converts a view document into screen state. Columns missing from the document keep their
 * defaults; columns the table no longer has are ignored.
 *
 * @param table - Table metadata.
 * @param view - The view document.
 * @param fallbackPageSize - Page size when the view has none (or an unsupported one).
 * @param pageSizes - Supported page sizes.
 * @returns The screen state.
 */
export function viewToState(table: QTableMetaData, view: RecordQueryView, fallbackPageSize: number, pageSizes: readonly number[]): ViewState {
  const filter = normalizeFilter(view.queryFilter ?? {}, fallbackPageSize)
  const known = new Set(allColumnNames(table))
  const columnVisibility: Record<string, boolean> = {}
  const columnWidths: Record<string, number> = {}
  const columnOrder: string[] = []
  for (const column of view.queryColumns?.columns ?? []) {
    if (!column || typeof column.name !== 'string' || !known.has(column.name)) continue
    columnOrder.push(column.name)
    columnVisibility[column.name] = column.isVisible !== false
    if (typeof column.width === 'number' && column.width > 0) columnWidths[column.name] = column.width
  }
  const pageSize = view.rowsPerPage && pageSizes.includes(view.rowsPerPage) ? view.rowsPerPage : fallbackPageSize
  return {
    userFilter: { ...emptyFilter(pageSize), criteria: filter.criteria, subFilters: filter.subFilters, booleanOperator: filter.booleanOperator },
    sortOrder: filter.orderBys ?? [],
    columnVisibility,
    columnOrder,
    columnWidths,
    pageSize,
    filterMode: view.mode === 'advanced' ? 'advanced' : 'basic',
  }
}

/**
 * Lists human-readable differences between a saved view and the current state (a subset of
 * Material's `SavedViewUtils.diffViews`), used for the "unsaved changes" indicator.
 *
 * @param table - Table metadata.
 * @param saved - The saved view document.
 * @param current - The current view document.
 * @returns Change descriptions; empty when the view is unmodified.
 */
export function diffViews(table: QTableMetaData, saved: RecordQueryView, current: RecordQueryView): string[] {
  const diffs: string[] = []
  const canonicalFilter = (view: RecordQueryView) => {
    const f = normalizeFilter(view.queryFilter ?? {}, 0)
    const strip = (x: QQueryFilter): unknown => ({
      criteria: x.criteria.filter(isCriterionComplete).map((c) => ({ fieldName: c.fieldName, operator: c.operator, values: c.values.map((v) => (typeof v === 'object' ? v : String(v))) })),
      subFilters: (x.subFilters ?? []).map(strip),
      booleanOperator: x.criteria.length + (x.subFilters ?? []).length > 1 ? x.booleanOperator : 'AND',
    })
    return JSON.stringify(strip(f))
  }
  if (canonicalFilter(saved) !== canonicalFilter(current)) diffs.push('Changed the filter')
  const sortOf = (view: RecordQueryView) => JSON.stringify(normalizeFilter(view.queryFilter ?? {}, 0).orderBys)
  if (sortOf(saved) !== sortOf(current)) diffs.push('Changed the sort')
  const defaults = allColumnNames(table)
  const visibleOf = (view: RecordQueryView) => {
    const columns = (view.queryColumns?.columns ?? []).filter((c) => c.name !== '__check__')
    if (columns.length === 0) return JSON.stringify(defaults.filter((n) => !n.includes('.')))
    const listed = new Set(columns.map((c) => c.name))
    return JSON.stringify([...columns.filter((c) => c.isVisible !== false).map((c) => c.name), ...defaults.filter((n) => !listed.has(n) && !n.includes('.'))])
  }
  if (visibleOf(saved) !== visibleOf(current)) diffs.push('Changed the columns')
  if ((saved.rowsPerPage ?? current.rowsPerPage) !== current.rowsPerPage) diffs.push('Changed the rows per page')
  return diffs
}
