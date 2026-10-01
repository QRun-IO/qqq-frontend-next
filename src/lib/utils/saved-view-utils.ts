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
 * quickFilterFieldNames, mode}`), so views saved in either UI load in the other. Also Material's
 * unsaved-change descriptions (`SavedViewUtils.diffViews`) and the reconciliation of a view with
 * the table's current metadata.
 */

import type { QFieldMetaData, QFilterCriteria, QFilterOrderBy, QQueryFilter, QTableMetaData } from '@/types'
import { formatDateTime } from './datetime-utils'
import { normalizeFilter, isCriterionComplete, emptyFilter, isFilterExpression, describeExpression, resolveField } from './filter-utils'
import { arrangePinnedColumns, effectivePins, getQueryColumns, orderColumns, type ColumnPin, type ColumnPins } from './query-columns'

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
  /** Which view the document is (`empty` for an ad-hoc view, `savedView:{id}` for a saved one). */
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
  /** `quickView` when the view is one of the table's quick views (Material `QuickSavedViews`). */
  type?: string
  /** A quick view's position in the quick views row. */
  sortOrder?: number
  /** Whether a quick view shows its record count. */
  doCount?: boolean
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
  /** Pinned columns; null (or absent) pins the first column, as Material pins the primary key. */
  columnPins?: ColumnPins | null
  /** Rows per page. */
  pageSize: number
  /** Filter panel mode. */
  filterMode: 'basic' | 'advanced'
  /** Quick filters added beyond the table's defaults (Material basic mode). */
  quickFilterFieldNames?: string[]
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
 * The columns of a state in display order (pinned columns at their sides), with the pins in effect.
 *
 * @param table - Table metadata.
 * @param state - Column order and pins.
 * @returns The arranged columns and pins.
 */
export function arrangedColumns(table: QTableMetaData, state: Pick<ViewState, 'columnOrder' | 'columnPins'>) {
  const ordered = orderColumns(getQueryColumns(table), state.columnOrder)
  const pins = effectivePins(ordered.map((c) => c.name), state.columnPins ?? null, table.primaryKeyField)
  return { columns: arrangePinnedColumns(ordered, pins), pins }
}

/**
 * Builds the view document for the current screen state. Incomplete criteria are dropped,
 * as Material does before saving.
 *
 * @param table - Table metadata.
 * @param state - Current screen state.
 * @param base - The stored view being saved over; its quick filters are kept when the state has none.
 * @returns The view JSON document.
 */
export function buildViewJson(table: QTableMetaData, state: ViewState, base?: RecordQueryView): RecordQueryView {
  const strip = (filter: Partial<QQueryFilter>): Partial<QQueryFilter> => ({
    criteria: (filter.criteria ?? []).filter(isCriterionComplete),
    subFilters: (filter.subFilters ?? []).map((s) => strip(s) as QQueryFilter),
    booleanOperator: filter.booleanOperator ?? 'AND',
  })
  const { columns, pins } = arrangedColumns(table, state)
  return {
    queryFilter: { ...strip(state.userFilter), orderBys: state.sortOrder },
    queryColumns: {
      columns: [
        { name: '__check__', isVisible: true, width: 100, pinned: 'left' },
        ...columns.map((column) => ({
          name: column.name,
          isVisible: isColumnVisible(column.name, state.columnVisibility),
          width: state.columnWidths[column.name] ?? column.defaultWidth,
          ...(pins[column.name] ? { pinned: pins[column.name] } : {}),
        })),
      ],
    },
    rowsPerPage: state.pageSize,
    quickFilterFieldNames: state.quickFilterFieldNames ?? base?.quickFilterFieldNames ?? [],
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
    queryFilter: (source.queryFilter && typeof source.queryFilter === 'object' ? source.queryFilter as Partial<QQueryFilter> : {}),
    queryColumns: Array.isArray(columns) ? { columns: (columns as SavedViewColumn[]).filter((c) => c && typeof c === 'object' && typeof c.name === 'string') } : undefined,
    rowsPerPage: typeof source.rowsPerPage === 'number' ? source.rowsPerPage : undefined,
    quickFilterFieldNames: Array.isArray(source.quickFilterFieldNames) ? (source.quickFilterFieldNames as unknown[]).filter((n): n is string => typeof n === 'string') : [],
    mode: typeof source.mode === 'string' ? source.mode : undefined,
    viewIdentity: typeof source.viewIdentity === 'string' ? source.viewIdentity : undefined,
  }
}

/**
 * Converts a view document into screen state. Columns the table no longer has are ignored.
 * Columns missing from the document are shown on an initial page load and hidden when a saved
 * view is loaded, as Material's reconciliation adds them.
 *
 * @param table - Table metadata.
 * @param view - The view document.
 * @param fallbackPageSize - Page size when the view has none (or an unsupported one).
 * @param pageSizes - Supported page sizes.
 * @param newColumnsVisible - Whether columns the document does not list are shown.
 * @returns The screen state.
 */
export function viewToState(table: QTableMetaData, view: RecordQueryView, fallbackPageSize: number, pageSizes: readonly number[], newColumnsVisible = true): ViewState {
  const filter = normalizeFilter(view.queryFilter ?? {}, fallbackPageSize)
  const known = allColumnNames(table)
  const knownSet = new Set(known)
  const columnVisibility: Record<string, boolean> = {}
  const columnWidths: Record<string, number> = {}
  const columnOrder: string[] = []
  const savedColumns = (view.queryColumns?.columns ?? []).filter((column) => column && typeof column.name === 'string' && knownSet.has(column.name))
  let columnPins: ColumnPins | null = null
  if (savedColumns.length > 0) {
    columnPins = {}
    for (const column of savedColumns) {
      columnOrder.push(column.name)
      columnVisibility[column.name] = column.isVisible !== false
      if (typeof column.width === 'number' && column.width > 0) columnWidths[column.name] = column.width
      if (column.pinned === 'left' || column.pinned === 'right') columnPins[column.name] = column.pinned as ColumnPin
    }
    if (!newColumnsVisible) for (const name of known) if (!(name in columnVisibility)) columnVisibility[name] = false
  }
  const pageSize = view.rowsPerPage && pageSizes.includes(view.rowsPerPage) ? view.rowsPerPage : fallbackPageSize
  return {
    userFilter: { ...emptyFilter(pageSize), criteria: filter.criteria, subFilters: filter.subFilters, booleanOperator: filter.booleanOperator },
    sortOrder: filter.orderBys ?? [],
    columnVisibility,
    columnOrder,
    columnWidths,
    columnPins,
    pageSize,
    filterMode: view.mode === 'advanced' ? 'advanced' : 'basic',
    // quick filters on fields the table no longer has are dropped (Material's reconcile)
    quickFilterFieldNames: [...new Set((view.quickFilterFieldNames ?? []).filter((name) => typeof name === 'string' && resolveField(table, name) !== undefined))],
  }
}

// ------------------------------------------------------------------
// Field lookup and human-readable criteria (Material FilterUtils / TableUtils)
// ------------------------------------------------------------------

/** A field of a table or one of its exposed joins, with the table it belongs to. */
interface FieldAndTable {
  field: QFieldMetaData
  tableName: string
  tableLabel: string
}

/**
 * Lists the basic-mode differences Material's `diffViews` reports: quick filters turned on or
 * off ("basic filters"; fields that have a condition are implied, so they do not count) and a
 * changed mode.
 *
 * @param table - Table metadata (for labels).
 * @param saved - The saved view document.
 * @param current - The current view document.
 * @returns Change descriptions.
 */
export function diffBasicModeSettings(table: QTableMetaData, saved: RecordQueryView, current: RecordQueryView): string[] {
  const diffs: string[] = []
  const withCriteria = new Set([...(saved.queryFilter?.criteria ?? []), ...(current.queryFilter?.criteria ?? [])].map((c) => c?.fieldName))
  const explicit = (view: RecordQueryView) => (view.quickFilterFieldNames ?? []).filter((name) => !withCriteria.has(name))
  const label = (name: string) => resolveField(table, name)?.label ?? name
  const describe = (prefix: string, names: string[]) => {
    if (names.length > 0) diffs.push(`${prefix} basic filter${names.length === 1 ? '' : 's'}: ${names.map(label).join(', ')}`)
  }
  describe('Turned on', explicit(current).filter((name) => !explicit(saved).includes(name)))
  describe('Turned off', explicit(saved).filter((name) => !explicit(current).includes(name)))
  const savedMode = saved.mode === 'advanced' ? 'advanced' : 'basic'
  const currentMode = current.mode === 'advanced' ? 'advanced' : 'basic'
  if (savedMode !== currentMode) diffs.push(`Mode changed from ${savedMode} to ${currentMode}`)
  return diffs
}

/**
 * Finds a field (stored or virtual) of the table or of an exposed join (`joinTable.field`).
 *
 * @param table - The query table.
 * @param fieldName - Field name.
 * @returns The field and its table, or undefined when the table has no such field.
 */
export function findFieldAndTable(table: QTableMetaData, fieldName: string): FieldAndTable | undefined {
  const own = table.fields?.[fieldName] ?? table.virtualFields?.[fieldName]
  if (own) return { field: own, tableName: table.name, tableLabel: table.label }
  const dot = fieldName.indexOf('.')
  if (dot < 0) return undefined
  const joinTable = (table.exposedJoins ?? []).find((join) => join.joinTable?.name === fieldName.slice(0, dot))?.joinTable
  const name = fieldName.slice(dot + 1)
  const field = joinTable?.fields?.[name] ?? joinTable?.virtualFields?.[name]
  return joinTable && field ? { field, tableName: joinTable.name, tableLabel: joinTable.label } : undefined
}

/**
 * A field's label for messages: "Table: Field" for a join field, as Material's `fieldNameToLabel`.
 *
 * @param table - The query table.
 * @param fieldName - Field name.
 * @returns The label, or the name when the field is unknown.
 */
export function fieldFullLabel(table: QTableMetaData, fieldName: string): string {
  const found = findFieldAndTable(table, fieldName)
  if (!found) return fieldName
  return found.tableName === table.name ? found.field.label : `${found.tableLabel}: ${found.field.label}`
}

/**
 * Material's words for an operator (`FilterUtils.operatorToHumanString`).
 *
 * @param operator - The criteria operator.
 * @param field - The criteria field (date and date-time wording).
 * @returns The words.
 */
function operatorWords(operator: string, field: QFieldMetaData | undefined): string {
  const isDate = field?.type === 'DATE'
  const isDateTime = field?.type === 'DATE_TIME'
  const dated = isDate || isDateTime
  switch (operator) {
    case 'EQUALS': return 'equals'
    case 'NOT_EQUALS':
    case 'NOT_EQUALS_OR_IS_NULL': return 'does not equal'
    case 'IN': return dated ? 'day is any of' : 'is any of'
    case 'NOT_IN': return dated ? 'day is none of' : 'is none of'
    case 'STARTS_WITH': return 'starts with'
    case 'ENDS_WITH': return 'ends with'
    case 'CONTAINS': return 'contains'
    case 'NOT_STARTS_WITH': return 'does not start with'
    case 'NOT_ENDS_WITH': return 'does not end with'
    case 'NOT_CONTAINS': return 'does not contain'
    case 'LESS_THAN': return dated ? 'is before' : 'less than'
    case 'LESS_THAN_OR_EQUALS': return isDate ? 'is on or before' : isDateTime ? 'is at or before' : 'less than or equals'
    case 'GREATER_THAN': return dated ? 'is after' : 'greater than'
    case 'GREATER_THAN_OR_EQUALS': return isDate ? 'is on or after' : isDateTime ? 'is at or after' : 'greater than or equals'
    case 'IS_BLANK': return 'is empty'
    case 'IS_NOT_BLANK': return 'is not empty'
    case 'BETWEEN': return 'is between'
    case 'NOT_BETWEEN': return 'is not between'
    default: return operator
  }
}

/**
 * Material's values text for a criterion (`FilterUtils.getValuesString`): up to three values
 * (all of them when there are at most five), then "and N other values.".
 *
 * @param criterion - The criterion.
 * @param field - Its field.
 * @returns The values text.
 */
function valuesText(criterion: QFilterCriteria, field: QFieldMetaData | undefined): string {
  if (criterion.operator === 'IS_BLANK' || criterion.operator === 'IS_NOT_BLANK') return ''
  const values = criterion.values ?? []
  if (values.length === 0) return ''
  const shown = values.length > 5 ? 3 : values.length
  const labels: string[] = []
  for (const value of values.slice(0, shown)) {
    if (isFilterExpression(value)) labels.push(describeExpression(value, field?.type === 'DATE' ? 'DATE' : 'DATE_TIME'))
    else if (field?.type === 'BOOLEAN') labels.push(value === true || value === 'true' ? 'yes' : 'no')
    else if (value && typeof value === 'object' && 'label' in value && (value as { label?: unknown }).label != null) labels.push(String((value as { label: unknown }).label))
    else if (field?.type === 'DATE_TIME') labels.push(formatDateTime(value) ?? String(value))
    else labels.push(String(value))
  }
  if (shown < values.length) {
    const n = values.length - shown
    labels.push(` and ${n} other value${n === 1 ? '' : 's'}.`)
  }
  return labels.join(', ')
}

/**
 * A criterion as Material words it (`FilterUtils.criteriaToHumanString`), e.g.
 * "First Name starts with B".
 *
 * @param table - The query table.
 * @param criterion - The criterion.
 * @returns The text.
 */
export function criteriaToHumanString(table: QTableMetaData, criterion: QFilterCriteria): string {
  try {
    const field = findFieldAndTable(table, criterion.fieldName)?.field
    return `${fieldFullLabel(table, criterion.fieldName)} ${operatorWords(criterion.operator, field)} ${valuesText(criterion, field)}`.trim()
  } catch {
    return `${criterion.fieldName} ${criterion.operator}`
  }
}

// ------------------------------------------------------------------
// Unsaved-change descriptions (Material SavedViewUtils.diffViews)
// ------------------------------------------------------------------

/**
 * Format Material's singular, plural and count wording for a list of columns.
 *
 * @param prefix - The change description.
 * @param labels - Column labels in display order.
 * @returns The change description with its column list.
 */
function columnList(prefix: string, labels: string[]): string {
  if (labels.length > 5) return `${prefix} ${labels.length} columns.`
  return `${prefix} column${labels.length === 1 ? '' : 's'}: ${labels.join(', ')}`
}

/**
 * Group complete top-level criteria by field.
 *
 * @param filter - The view filter.
 * @returns Complete criteria keyed by field name.
 */
function criteriaByField(filter: Partial<QQueryFilter> | undefined): Record<string, QFilterCriteria[]> {
  const map: Record<string, QFilterCriteria[]> = {}
  for (const criterion of normalizeFilter(filter ?? {}, 0).criteria) {
    if (!isCriterionComplete(criterion)) continue
    ;(map[criterion.fieldName] ??= []).push(criterion)
  }
  return map
}

/**
 * Compare criterion values by ID when they are possible-value objects.
 *
 * @param criterion - The criterion to compare.
 * @returns A stable JSON key for its values.
 */
function valuesKey(criterion: QFilterCriteria): string {
  return JSON.stringify((criterion.values ?? []).map((v) => (v && typeof v === 'object' && 'id' in v ? (v as { id: unknown }).id : v)))
}

/**
 * Adds Material's descriptions of filter and sort changes.
 *
 * @param table - The query table.
 * @param saved - The base view.
 * @param active - The current view.
 * @param diffs - Collected descriptions.
 */
export function diffFilters(table: QTableMetaData, saved: RecordQueryView, active: RecordQueryView, diffs: string[]): void {
  try {
    const savedCriteria = criteriaByField(saved.queryFilter)
    const activeCriteria = criteriaByField(active.queryFilter)
    const addedOrRemoved = (base: Record<string, QFilterCriteria[]>, compare: Record<string, QFilterCriteria[]>, prefix: string) => {
      for (const fieldName of Object.keys(compare)) {
        const baseCount = base[fieldName]?.length ?? 0
        const compareCount = compare[fieldName].length
        if (baseCount >= compareCount) continue
        if (baseCount === 0 && compareCount === 1) diffs.push(`${prefix} filter: ${criteriaToHumanString(table, compare[fieldName][0])}`)
        else diffs.push(`${prefix} ${compareCount - baseCount} filters on ${fieldFullLabel(table, fieldName)}`)
      }
    }
    addedOrRemoved(savedCriteria, activeCriteria, 'Added')
    addedOrRemoved(activeCriteria, savedCriteria, 'Removed')
    for (const fieldName of Object.keys(activeCriteria)) {
      const base = savedCriteria[fieldName] ?? []
      const compare = activeCriteria[fieldName]
      if (base.length === 1 && compare.length === 1) {
        if (base[0].operator !== compare[0].operator || valuesKey(base[0]) !== valuesKey(compare[0])) {
          diffs.push(`Changed a filter from ${criteriaToHumanString(table, base[0])} to ${criteriaToHumanString(table, compare[0])}`)
        }
      } else if (base.length === compare.length && JSON.stringify(base.map((c) => [c.operator, valuesKey(c)])) !== JSON.stringify(compare.map((c) => [c.operator, valuesKey(c)]))) {
        diffs.push(`Changed 1 or more filters on ${fieldFullLabel(table, fieldName)}`)
      }
    }

    const savedFilter = normalizeFilter(saved.queryFilter ?? {}, 0)
    const activeFilter = normalizeFilter(active.queryFilter ?? {}, 0)
    if (savedFilter.booleanOperator !== activeFilter.booleanOperator) {
      diffs.push(`Changed filter from '${savedFilter.booleanOperator === 'OR' ? 'Or' : 'And'}' to '${activeFilter.booleanOperator === 'OR' ? 'Or' : 'And'}'`)
    }
    // Next edits nested groups, which Material's diff does not look at
    const groups = (f: QQueryFilter): string => JSON.stringify((f.subFilters ?? []).map((s) => ({ b: s.booleanOperator, c: s.criteria.filter(isCriterionComplete).map((c) => [c.fieldName, c.operator, valuesKey(c)]), s: groups(s) })))
    if (groups(savedFilter) !== groups(activeFilter)) diffs.push('Changed the filter groups')

    const savedOrderBys = savedFilter.orderBys ?? []
    const activeOrderBys = activeFilter.orderBys ?? []
    const word = (ascending: boolean) => (ascending ? 'ascending' : 'descending')
    if (savedOrderBys.length !== activeOrderBys.length) diffs.push('Changed sort')
    else if (savedOrderBys.length > 0) {
      const [s, a] = [savedOrderBys[0], activeOrderBys[0]]
      if (s.fieldName !== a.fieldName && s.isAscending !== a.isAscending) {
        diffs.push(`Changed sort from ${fieldFullLabel(table, s.fieldName)} ${word(s.isAscending)} to ${fieldFullLabel(table, a.fieldName)} ${word(a.isAscending)}`)
      } else if (s.fieldName !== a.fieldName) {
        diffs.push(`Changed sort field from ${fieldFullLabel(table, s.fieldName)} to ${fieldFullLabel(table, a.fieldName)}`)
      } else if (s.isAscending !== a.isAscending) {
        diffs.push(`Changed sort direction from ${word(s.isAscending)} to ${word(a.isAscending)}`)
      }
    }
  } catch {
    // a malformed view must not break the screen (Material logs and moves on)
  }
}

/**
 * A view's columns as the table has them now: columns the table no longer has are dropped and
 * missing ones are added hidden (Material's reconciliation of a loaded view).
 *
 * @param table - The query table.
 * @param view - The view.
 * @returns The columns (without `__check__`), or null when the view has none.
 */
function reconciledColumns(table: QTableMetaData, view: RecordQueryView): SavedViewColumn[] | null {
  const listed = (view.queryColumns?.columns ?? []).filter((c) => c.name !== '__check__')
  if (listed.length === 0) return null
  const known = getQueryColumns(table)
  const knownNames = new Set(known.map((c) => c.name))
  const kept = listed.filter((c) => knownNames.has(c.name))
  const keptNames = new Set(kept.map((c) => c.name))
  return [...kept, ...known.filter((c) => !keptNames.has(c.name)).map((c) => ({ name: c.name, isVisible: false, width: c.defaultWidth }))]
}

/**
 * Adds Material's descriptions of column changes: shown and hidden columns, pins, order and widths.
 *
 * @param table - The query table.
 * @param saved - The base view.
 * @param active - The current view.
 * @param diffs - Collected descriptions.
 */
export function diffColumns(table: QTableMetaData, saved: RecordQueryView, active: RecordQueryView, diffs: string[]): void {
  try {
    const savedColumns = reconciledColumns(table, saved)
    if (!savedColumns) {
      diffs.push('This view did not previously have columns saved with it, so the next time you save it they will be initialized.')
      return
    }
    const activeColumns = reconciledColumns(table, active) ?? []
    const label = (name: string) => fieldFullLabel(table, name)
    const visible = (columns: SavedViewColumn[]) => new Set(columns.filter((c) => c.isVisible !== false).map((c) => c.name))
    const savedVisible = visible(savedColumns)
    const activeVisible = visible(activeColumns)
    const turnedOn = activeColumns.filter((c) => activeVisible.has(c.name) && !savedVisible.has(c.name)).map((c) => label(c.name))
    const turnedOff = savedColumns.filter((c) => savedVisible.has(c.name) && !activeVisible.has(c.name)).map((c) => label(c.name))
    if (turnedOn.length) diffs.push(columnList('Turned on', turnedOn))
    if (turnedOff.length) diffs.push(columnList('Turned off', turnedOff))
    const savedPins = new Map(savedColumns.map((c) => [c.name, c.pinned]))
    const pinChanged = activeColumns.filter((c) => savedPins.get(c.name) !== c.pinned).map((c) => label(c.name))
    if (pinChanged.length) diffs.push(columnList('Changed pinned state for', pinChanged))
    if (savedColumns.map((c) => c.name).join(',') !== activeColumns.map((c) => c.name).join(',')) diffs.push('Changed the order of columns.')
    const savedWidths = new Map(savedColumns.map((c) => [c.name, c.width]))
    const widthChanged = activeColumns.filter((c) => savedWidths.has(c.name) && savedWidths.get(c.name) !== undefined && c.width !== undefined && savedWidths.get(c.name) !== c.width).map((c) => label(c.name))
    if (widthChanged.length) diffs.push(columnList('Changed width for', widthChanged))
  } catch {
    // a malformed view must not break the screen
  }
}

/**
 * Lists human-readable differences between a saved view (or the table's default view) and the
 * current state, worded as Material's `SavedViewUtils.diffViews`, for the "unsaved changes"
 * indicator and its tooltip.
 *
 * @param table - Table metadata.
 * @param saved - The saved view document.
 * @param current - The current view document.
 * @returns Change descriptions; empty when the view is unmodified.
 */
export function diffViews(table: QTableMetaData, saved: RecordQueryView, current: RecordQueryView): string[] {
  const diffs: string[] = []
  diffFilters(table, saved, current, diffs)
  diffColumns(table, saved, current, diffs)
  diffs.push(...diffBasicModeSettings(table, saved, current))
  if (saved.rowsPerPage !== current.rowsPerPage && current.rowsPerPage !== undefined) {
    diffs.push(saved.rowsPerPage ? `Rows per page changed from ${saved.rowsPerPage} to ${current.rowsPerPage}` : `Rows per page set to ${current.rowsPerPage}`)
  }
  return diffs
}

// ------------------------------------------------------------------
// Reconciling a view with the table's metadata
// ------------------------------------------------------------------

/** A view cleaned of references to fields the table no longer has. */
export interface ReconciledView {
  /** The view, with those references removed. */
  view: RecordQueryView
  /** Warnings to show, worded as Material's. */
  warnings: string[]
}

/**
 * Drops what a view references that the table no longer has (Material's
 * `reconcileCurrentTableMetaDataWithView`): visible columns, criteria and sorts on deleted fields,
 * quick filters on deleted fields, and boolean criteria with an operator the screen cannot edit.
 * Returns the warnings Material shows.
 *
 * @param table - The query table.
 * @param view - The view.
 * @returns The cleaned view and its warnings.
 */
export function reconcileView(table: QTableMetaData, view: RecordQueryView): ReconciledView {
  const removedFields = new Set<string>()
  const removedReasons = new Set<string>()
  const known = new Set(allColumnNames(table))
  const exists = (name: string) => Boolean(findFieldAndTable(table, name))

  const columns = view.queryColumns?.columns
  if (columns?.length) {
    for (const column of columns) {
      if (column.name !== '__check__' && !known.has(column.name) && !exists(column.name) && column.isVisible !== false) removedFields.add(column.name)
    }
  }
  const cleanFilter = (filter: Partial<QQueryFilter>): Partial<QQueryFilter> => {
    const criteria: QFilterCriteria[] = []
    for (const criterion of Array.isArray(filter.criteria) ? filter.criteria : []) {
      if (!criterion || typeof criterion.fieldName !== 'string') continue
      const found = findFieldAndTable(table, criterion.fieldName)
      if (!found) {
        removedFields.add(criterion.fieldName)
        continue
      }
      if (found.field.type === 'BOOLEAN' && criterion.operator && !['EQUALS', 'IS_BLANK', 'IS_NOT_BLANK'].includes(criterion.operator)) {
        removedReasons.add(`${found.field.label} has an unsupported operator: ${criterion.operator}`)
        continue
      }
      criteria.push(criterion)
    }
    return {
      ...filter,
      criteria,
      ...(Array.isArray(filter.subFilters) ? { subFilters: filter.subFilters.map((s) => cleanFilter(s) as QQueryFilter) } : {}),
    }
  }
  const queryFilter = cleanFilter(view.queryFilter ?? {})
  const savedOrderBys = Array.isArray(view.queryFilter?.orderBys) ? view.queryFilter.orderBys : []
  const orderBys = savedOrderBys.filter((orderBy) => {
    if (!orderBy || typeof orderBy.fieldName !== 'string') return false
    if (exists(orderBy.fieldName)) return true
    removedFields.add(orderBy.fieldName)
    return false
  })
  if (savedOrderBys.length > 0 && orderBys.length === 0 && table.primaryKeyField) {
    orderBys.push({ fieldName: table.primaryKeyField, isAscending: false })
  }
  const quickFilterFieldNames = (view.quickFilterFieldNames ?? []).filter((name) => {
    if (exists(name)) return true
    removedFields.add(name)
    return false
  })

  const warnings: string[] = []
  if (removedFields.size > 0) {
    const plural = removedFields.size > 1
    warnings.push(`${removedFields.size} field${plural ? 's' : ''} that ${plural ? 'were' : 'was'} part of this view ${plural ? 'are' : 'is'} no longer in this table, and ${plural ? 'were' : 'was'} removed from this view (${[...removedFields].join(', ')}).`)
  }
  if (removedReasons.size > 0) {
    const plural = removedReasons.size > 1
    warnings.push(`${removedReasons.size} filter${plural ? 's' : ''} is misconfigured for this screen and was removed from this view: (Details: ${[...removedReasons].join(', ')}).`)
  }
  return {
    view: {
      ...view,
      queryFilter: { ...queryFilter, orderBys },
      ...(columns ? { queryColumns: { columns: columns.filter((c) => c.name === '__check__' || known.has(c.name)) } } : {}),
      quickFilterFieldNames,
    },
    warnings,
  }
}
