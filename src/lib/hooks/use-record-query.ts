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
 * @file use-record-query — manages all state for the Record Query page including filters,
 * pagination, sorting, column config, selection, joins, variants and data fetching.
 */

'use client'

import { useCallback, useMemo, useReducer, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import type {
  QTableMetaData,
  QRecord,
  QQueryFilter,
  QFilterOrderBy,
  QueryJoin,
  QFieldMetaData,
} from '@/types'
import { queryRecords, countRecords, type TableVariant } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import {
  emptyFilter,
  applyPagination,
  serializeFilter,
  deserializeFilter,
  isFilterEmpty,
  buildQuickFilter,
  combineWithQuickFilter,
  prepFilterForBackend,
  referencedFieldNames,
  resolveField,
} from '@/lib/utils/filter-utils'
import { isColumnVisible, type ViewState } from '@/lib/utils/saved-view-utils'
import { hasCapability } from '@/lib/utils/query-columns'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { useColumnConfig } from '@/lib/hooks/use-column-config'
import { PAGE_SIZE_OPTIONS } from '@/lib/constants'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** Row density preference for the data grid. */
export type Density = 'compact' | 'standard' | 'comfortable'
export { PAGE_SIZE_OPTIONS }
/** Union of all valid page-size values drawn from the shared constant array. */
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export type { SavedView } from '@/lib/utils/saved-view-utils'
export { hasCapability }

/**
 * What the selection covers, as in Material's selection menu: the checked rows, every
 * record matching the query, or the first N records matching the query.
 */
export type SelectionMode = 'rows' | 'all' | 'subset'

/**
 * Full reducer state for the Record Query page.
 */
export interface RecordQueryState {
  /** Current 1-based page number. */
  pageNum: number
  /** Number of records per page. */
  pageSize: PageSize
  /** Advanced filter (criteria, sub-filters, boolean operator). */
  userFilter: QQueryFilter
  /** Quick-search text; ANDed with the advanced filter. */
  quickSearchTerm: string
  /** Filter panel mode, persisted in saved views. */
  filterMode: 'basic' | 'advanced'
  /** Active sort order. */
  sortOrder: QFilterOrderBy[]
  /** Explicit column visibility (join columns default hidden, base columns default shown). */
  columnVisibility: Record<string, boolean>
  /** Ordered column names; empty means metadata-default order. */
  columnOrder: string[]
  /** Column pixel widths. */
  columnWidths: Record<string, number>
  /** Row selection keyed by primary key string. */
  rowSelection: Record<string, boolean>
  /** Which records the selection covers. */
  selectionMode: SelectionMode
  /** Size of a "first N" subset selection. */
  subsetSize: number | null
  /** Whether the column-configuration panel is open. */
  columnConfigOpen: boolean
  /** Whether the filter panel is open. */
  filterPanelOpen: boolean
}

/**
 * Discriminated union of all actions the record query reducer accepts.
 */
export type RecordQueryAction =
  | { type: 'SET_PAGE'; pageNum: number }
  | { type: 'SET_PAGE_SIZE'; pageSize: PageSize }
  | { type: 'SET_USER_FILTER'; filter: QQueryFilter }
  | { type: 'SET_QUICK_SEARCH'; term: string }
  | { type: 'SET_FILTER_MODE'; mode: 'basic' | 'advanced' }
  | { type: 'SET_SORT'; sortOrder: QFilterOrderBy[] }
  | { type: 'SET_COLUMN_VISIBILITY'; visibility: Record<string, boolean> }
  | { type: 'TOGGLE_COLUMN'; fieldName: string }
  | { type: 'SET_COLUMN_ORDER'; order: string[] }
  | { type: 'SET_COLUMN_WIDTH'; fieldName: string; width: number }
  | { type: 'SET_ROW_SELECTION'; selection: Record<string, boolean> }
  | { type: 'SET_SELECTION_MODE'; mode: SelectionMode; subsetSize?: number | null }
  | { type: 'CLEAR_ROW_SELECTION' }
  | { type: 'TOGGLE_COLUMN_CONFIG' }
  | { type: 'SET_COLUMN_CONFIG_OPEN'; open: boolean }
  | { type: 'TOGGLE_FILTER_PANEL' }
  | { type: 'RESET_FILTER' }
  | { type: 'APPLY_VIEW'; view: ViewState }

/**
 * Pure reducer for `RecordQueryState`. Any change to the result set returns to page 1.
 *
 * @param state - Current state snapshot.
 * @param action - Dispatched action describing the transition.
 * @returns New state.
 */
function recordQueryReducer(state: RecordQueryState, action: RecordQueryAction): RecordQueryState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, pageNum: action.pageNum }
    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.pageSize, pageNum: 1 }
    case 'SET_USER_FILTER':
      return { ...state, userFilter: action.filter, pageNum: 1 }
    case 'SET_QUICK_SEARCH':
      return { ...state, quickSearchTerm: action.term, pageNum: 1 }
    case 'SET_FILTER_MODE':
      return { ...state, filterMode: action.mode }
    case 'SET_SORT':
      return { ...state, sortOrder: action.sortOrder, pageNum: 1 }
    case 'SET_COLUMN_VISIBILITY':
      return { ...state, columnVisibility: action.visibility }
    case 'TOGGLE_COLUMN':
      return {
        ...state,
        columnVisibility: { ...state.columnVisibility, [action.fieldName]: !isColumnVisible(action.fieldName, state.columnVisibility) },
      }
    case 'SET_COLUMN_ORDER':
      return { ...state, columnOrder: action.order }
    case 'SET_COLUMN_WIDTH':
      return { ...state, columnWidths: { ...state.columnWidths, [action.fieldName]: action.width } }
    case 'SET_ROW_SELECTION':
      return { ...state, rowSelection: action.selection, selectionMode: 'rows', subsetSize: null }
    case 'SET_SELECTION_MODE':
      return { ...state, selectionMode: action.mode, subsetSize: action.mode === 'subset' ? action.subsetSize ?? null : null }
    case 'CLEAR_ROW_SELECTION':
      return { ...state, rowSelection: {}, selectionMode: 'rows', subsetSize: null }
    case 'TOGGLE_COLUMN_CONFIG':
      return { ...state, columnConfigOpen: !state.columnConfigOpen }
    case 'SET_COLUMN_CONFIG_OPEN':
      return { ...state, columnConfigOpen: action.open }
    case 'TOGGLE_FILTER_PANEL':
      return { ...state, filterPanelOpen: !state.filterPanelOpen }
    case 'RESET_FILTER':
      return { ...state, userFilter: emptyFilter(state.pageSize), quickSearchTerm: '', pageNum: 1 }
    case 'APPLY_VIEW':
      return {
        ...state,
        userFilter: { ...action.view.userFilter, skip: 0, limit: action.view.pageSize as PageSize },
        sortOrder: action.view.sortOrder,
        columnVisibility: action.view.columnVisibility,
        columnOrder: action.view.columnOrder,
        columnWidths: { ...state.columnWidths, ...action.view.columnWidths },
        pageSize: action.view.pageSize as PageSize,
        filterMode: action.view.filterMode,
        pageNum: 1,
        quickSearchTerm: '',
        rowSelection: {},
        selectionMode: 'rows',
        subsetSize: null,
      }
    default:
      return state
  }
}

// ------------------------------------------------------------------
// Hook
// ------------------------------------------------------------------

/**
 * Configuration options for `useRecordQuery`.
 */
interface UseRecordQueryOptions {
  /** Backend table name used for API calls and localStorage keys. */
  tableName: string
  /** Table metadata from the backend; the hook is disabled until this is defined. */
  tableMetaData: QTableMetaData | undefined
  /** All-table metadata used to check read permissions along exposed join paths. */
  allTables: Record<string, QTableMetaData> | undefined
  /** Initial number of rows per page. Defaults to 25. */
  initialPageSize?: PageSize
  /** Selected backend variant (tables whose backend uses variants); queries wait for one. */
  tableVariant?: TableVariant | null
  /** Hold all queries (for example while a saved view is loading). */
  paused?: boolean
}

/**
 * Manages all state for the Record Query page. State is hydrated from URL search params on
 * mount and synced back to the URL on every change so queries are shareable. Column state is
 * persisted to localStorage per table.
 *
 * @param options - Configuration including table name, metadata, page size and variant.
 * @returns Grouped state and actions: `pagination`, `filter`, `columns`, `selection`, `data`,
 *   `joins`, `density`, and `viewState`/`applyView` for saved views.
 */
export function useRecordQuery({
  tableName,
  tableMetaData,
  allTables,
  initialPageSize = 25,
  tableVariant = null,
  paused = false,
}: UseRecordQueryOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [density, setDensity] = useLocalStorage<Density>(`qqq-${tableName}-density`, 'standard')
  const [storedColumnVisibility] = useLocalStorage<Record<string, boolean>>(`qqq-${tableName}-columns`, {})
  const [storedColumnOrder] = useLocalStorage<string[]>(`qqq-${tableName}-column-order`, [])
  const [storedColumnWidths] = useLocalStorage<Record<string, number>>(`qqq-${tableName}-column-widths`, {})

  const primaryKey = tableMetaData?.primaryKeyField
  /** Material's default sort: primary key, descending. */
  const defaultSort = useMemo<QFilterOrderBy[]>(() => (primaryKey ? [{ fieldName: primaryKey, isAscending: false }] : []), [primaryKey])

  // ------------------------------------------------------------------
  // Initial state — hydrate from URL params (read once on mount via ref)
  // ------------------------------------------------------------------
  const initialStateRef = useRef<RecordQueryState | null>(null)
  if (!initialStateRef.current) {
    const pageSizeParam = Number(searchParams.get('pageSize'))
    const pageSize = ((PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeParam) ? pageSizeParam : initialPageSize) as PageSize
    const filterParam = searchParams.get('filter')
    const initialFilter = filterParam ? deserializeFilter(filterParam, pageSize) : emptyFilter(pageSize)
    const pageParam = parseInt(searchParams.get('page') ?? '', 10)
    initialStateRef.current = {
      pageNum: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
      pageSize,
      userFilter: { ...initialFilter, orderBys: [] },
      quickSearchTerm: searchParams.get('q') ?? '',
      filterMode: 'basic',
      sortOrder: initialFilter.orderBys?.length ? initialFilter.orderBys : defaultSort,
      columnVisibility: storedColumnVisibility,
      columnOrder: storedColumnOrder,
      columnWidths: storedColumnWidths,
      rowSelection: {},
      selectionMode: 'rows',
      subsetSize: null,
      columnConfigOpen: false,
      filterPanelOpen: false,
    }
  }

  const [state, dispatch] = useReducer(recordQueryReducer, initialStateRef.current)
  const columns = useColumnConfig(tableName, state, dispatch)

  // ------------------------------------------------------------------
  // Sync state to URL params (filter includes a non-default sort)
  // ------------------------------------------------------------------
  const sortIsDefault = JSON.stringify(state.sortOrder) === JSON.stringify(defaultSort)
  useEffect(() => {
    // Keep parameters this hook does not manage (for example the `from` back link)
    const params = new URLSearchParams(searchParams.toString())
    for (const key of ['page', 'pageSize', 'filter', 'q']) params.delete(key)
    if (state.pageNum > 1) params.set('page', String(state.pageNum))
    if (state.pageSize !== 25) params.set('pageSize', String(state.pageSize))
    if (!isFilterEmpty(state.userFilter) || !sortIsDefault) {
      params.set('filter', serializeFilter({ ...state.userFilter, orderBys: sortIsDefault ? [] : state.sortOrder }))
    }
    if (state.quickSearchTerm) params.set('q', state.quickSearchTerm)
    const newSearch = params.toString()
    if (newSearch !== searchParams.toString()) {
      router.replace(`${pathname}${newSearch ? `?${newSearch}` : ''}`, { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams is read, not tracked, to avoid loops
  }, [state.pageNum, state.pageSize, state.userFilter, state.sortOrder, state.quickSearchTerm, sortIsDefault, router, pathname])

  // ------------------------------------------------------------------
  // Joins: only the exposed joins the visible columns, criteria or sort use
  // ------------------------------------------------------------------
  const readableExposedJoins = useMemo(() => (tableMetaData?.exposedJoins ?? []).filter(({ joinTable, joinPath = [] }) => {
    if (!joinTable?.name || joinTable.readPermission === false) return false
    const names = [joinTable.name, ...joinPath.flatMap(({ leftTable, rightTable }) => [leftTable, rightTable])]
    return names.every((name) => name === tableName || allTables?.[name]?.readPermission === true)
  }), [tableMetaData, tableName, allTables])

  const visibleJoinColumns = useMemo(() => Object.entries(state.columnVisibility).filter(([name, visible]) => visible && name.includes('.')).map(([name]) => name), [state.columnVisibility])

  const activeJoinTables = useMemo(() => {
    const used = new Set<string>()
    for (const name of [...visibleJoinColumns, ...referencedFieldNames({ ...state.userFilter, orderBys: state.sortOrder })]) {
      const dot = name.indexOf('.')
      if (dot > 0) used.add(name.slice(0, dot))
    }
    return used
  }, [visibleJoinColumns, state.userFilter, state.sortOrder])

  const activeExposedJoins = useMemo(() => readableExposedJoins.filter((j) => activeJoinTables.has(j.joinTable!.name)), [readableExposedJoins, activeJoinTables])

  const joins: QueryJoin[] | undefined = activeExposedJoins.length
    ? activeExposedJoins.map((exposedJoin): QueryJoin => ({
        joinTable: exposedJoin.joinTable!.name,
        select: true,
        type: 'LEFT',
        ...(exposedJoin.joinPath?.length === 1 && exposedJoin.joinPath[0].name ? { joinName: exposedJoin.joinPath[0].name } : {}),
      }))
    : undefined
  /** A many-side join can repeat base records, so the count also asks for the distinct count. */
  const includeDistinct = activeExposedJoins.some((j) => j.isMany)

  // ------------------------------------------------------------------
  // Filters sent to the backend
  // ------------------------------------------------------------------
  const fieldFor = useCallback((fieldName: string): QFieldMetaData | undefined => (tableMetaData ? resolveField(tableMetaData, fieldName)?.field : undefined), [tableMetaData])

  const quickFilter = useMemo<QQueryFilter | null>(() => {
    if (!state.quickSearchTerm.trim() || !tableMetaData) return null
    const visible = Object.values(tableMetaData.fields).filter((f) => !f.isHidden && isColumnVisible(f.name, state.columnVisibility)).map((f) => f.name)
    const types = Object.fromEntries(Object.values(tableMetaData.fields).map((f) => [f.name, f.type]))
    const quick = buildQuickFilter(state.quickSearchTerm, visible, types, state.pageSize)
    return quick.criteria.length ? quick : null
  }, [state.quickSearchTerm, tableMetaData, state.columnVisibility, state.pageSize])

  /** Criteria, quick search and sort, prepared for the backend, without paging. */
  const baseFilter = useMemo<QQueryFilter>(() => {
    const combined = combineWithQuickFilter({ ...state.userFilter, orderBys: state.sortOrder }, quickFilter)
    return prepFilterForBackend(combined, fieldFor)
  }, [state.userFilter, state.sortOrder, quickFilter, fieldFor])

  const effectiveFilter = useMemo<QQueryFilter>(() => applyPagination(baseFilter, state.pageNum, state.pageSize), [baseFilter, state.pageNum, state.pageSize])
  const countFilter = useMemo<QQueryFilter>(() => ({ ...baseFilter, skip: 0, limit: 0, orderBys: [] }), [baseFilter])

  // ------------------------------------------------------------------
  // Queries
  // ------------------------------------------------------------------
  const canQuery = hasCapability(tableMetaData, 'TABLE_QUERY')
  const canCount = hasCapability(tableMetaData, 'TABLE_COUNT')
  const needsVariant = Boolean(tableMetaData?.usesVariants) && !tableVariant
  const enabled = Boolean(tableMetaData && allTables) && canQuery && !needsVariant && !paused
  const variantKey = tableVariant ? `${tableVariant.type}:${tableVariant.id}` : null

  const recordsQuery = useQuery({
    queryKey: [
      ...queryKeys.tableRecords(tableName),
      'query',
      JSON.stringify(effectiveFilter),
      JSON.stringify(joins ?? null),
      variantKey,
    ],
    queryFn: () =>
      queryRecords(tableName, {
        filter: effectiveFilter,
        joins,
        ...(tableVariant ? { tableVariant } : {}),
      }),
    // Revalidate on every mount: other users may have changed the rows (cached rows show meanwhile).
    staleTime: 0,
    placeholderData: (prev) => prev,
    enabled,
  })

  const countQuery = useQuery({
    queryKey: [
      ...queryKeys.tableRecords(tableName),
      'count',
      JSON.stringify(countFilter),
      JSON.stringify(joins ?? null),
      variantKey,
      includeDistinct,
    ],
    queryFn: () =>
      countRecords(
        tableName,
        {
          filter: countFilter,
          joins,
          ...(tableVariant ? { tableVariant } : {}),
        },
        includeDistinct
      ),
    // Revalidate on every mount: other users may have changed the rows (cached rows show meanwhile).
    staleTime: 0,
    placeholderData: (prev) => prev,
    enabled: enabled && canCount,
  })

  const records = useMemo<QRecord[]>(() => recordsQuery.data?.records ?? [], [recordsQuery.data?.records])
  /** Total matching rows, or null when the table cannot count. */
  const totalCount: number | null = canCount ? countQuery.data?.count ?? 0 : null
  const distinctCount: number | null = canCount && includeDistinct ? countQuery.data?.distinctCount ?? null : null
  const totalPages = totalCount === null
    ? state.pageNum + (records.length >= state.pageSize ? 1 : 0)
    : Math.max(1, Math.ceil(totalCount / state.pageSize))
  const isLoading = enabled && (recordsQuery.isLoading || (canCount && countQuery.isLoading))
  const isError = recordsQuery.isError || countQuery.isError

  // ------------------------------------------------------------------
  // Selection
  // ------------------------------------------------------------------
  // Row ids are primary keys; a repeated key (many-side join) carries a "#n" suffix
  const selectedRecordIds = useMemo<(string | number)[]>(() => [...new Set(Object.entries(state.rowSelection)
    .filter(([id, selected]) => selected && !id.startsWith('row-'))
    .map(([id]) => id.replace(/#\d+$/, '')))]
    .map((id): string | number => {
      const numId = Number(id)
      return Number.isFinite(numId) && String(numId) === id ? numId : id
    }), [state.rowSelection])
  const matchingCount = distinctCount ?? totalCount
  const selectionCount = state.selectionMode === 'all'
    ? matchingCount ?? 0
    : state.selectionMode === 'subset'
      ? Math.min(state.subsetSize ?? 0, matchingCount ?? state.subsetSize ?? 0)
      : selectedRecordIds.length
  /** Filter describing the selection when it is "all" or "first N" (no page skip; subset limit). */
  const selectionFilter = useMemo<QQueryFilter | null>(() => {
    if (state.selectionMode === 'rows') return null
    const { skip: _skip, limit: _limit, ...rest } = baseFilter
    void _skip
    void _limit
    return (state.selectionMode === 'subset' ? { ...rest, skip: 0, limit: state.subsetSize ?? 0 } : { ...rest, skip: 0 }) as QQueryFilter
  }, [state.selectionMode, state.subsetSize, baseFilter])

  // ------------------------------------------------------------------
  // Action dispatchers
  // ------------------------------------------------------------------
  const setPage = useCallback((pageNum: number) => dispatch({ type: 'SET_PAGE', pageNum }), [])
  const setPageSize = useCallback((pageSize: PageSize) => dispatch({ type: 'SET_PAGE_SIZE', pageSize }), [])
  const setUserFilter = useCallback((filter: QQueryFilter) => dispatch({ type: 'SET_USER_FILTER', filter }), [])
  const setQuickSearch = useCallback((term: string) => dispatch({ type: 'SET_QUICK_SEARCH', term }), [])
  const setFilterMode = useCallback((mode: 'basic' | 'advanced') => dispatch({ type: 'SET_FILTER_MODE', mode }), [])
  const setSort = useCallback((sortOrder: QFilterOrderBy[]) => dispatch({ type: 'SET_SORT', sortOrder: sortOrder.length ? sortOrder : defaultSort }), [defaultSort])
  const setRowSelection = useCallback((selection: Record<string, boolean>) => dispatch({ type: 'SET_ROW_SELECTION', selection }), [])
  const setSelectionMode = useCallback((mode: SelectionMode, subsetSize?: number | null) => dispatch({ type: 'SET_SELECTION_MODE', mode, subsetSize }), [])
  const clearRowSelection = useCallback(() => dispatch({ type: 'CLEAR_ROW_SELECTION' }), [])
  const toggleFilterPanel = useCallback(() => dispatch({ type: 'TOGGLE_FILTER_PANEL' }), [])
  const resetFilter = useCallback(() => dispatch({ type: 'RESET_FILTER' }), [])
  const applyView = useCallback((view: ViewState) => dispatch({ type: 'APPLY_VIEW', view }), [])

  const viewState = useMemo<ViewState>(() => ({
    userFilter: state.userFilter,
    sortOrder: state.sortOrder,
    columnVisibility: state.columnVisibility,
    columnOrder: state.columnOrder,
    columnWidths: state.columnWidths,
    pageSize: state.pageSize,
    filterMode: state.filterMode,
  }), [state.userFilter, state.sortOrder, state.columnVisibility, state.columnOrder, state.columnWidths, state.pageSize, state.filterMode])

  return {
    pagination: {
      pageNum: state.pageNum,
      pageSize: state.pageSize,
      totalCount,
      distinctCount,
      totalPages,
      setPage,
      setPageSize,
    },
    filter: {
      userFilter: state.userFilter,
      quickSearchTerm: state.quickSearchTerm,
      filterMode: state.filterMode,
      filterPanelOpen: state.filterPanelOpen,
      sortOrder: state.sortOrder,
      defaultSort,
      effectiveFilter,
      baseFilter,
      setUserFilter,
      setQuickSearch,
      setFilterMode,
      setSort,
      resetFilter,
      toggleFilterPanel,
    },
    columns,
    selection: {
      rowSelection: state.rowSelection,
      selectedRecordIds,
      selectionMode: state.selectionMode,
      subsetSize: state.subsetSize,
      selectionCount,
      selectionFilter,
      setRowSelection,
      setSelectionMode,
      clearRowSelection,
    },
    data: {
      records,
      isLoading,
      isFetching: recordsQuery.isFetching,
      isError,
      error: recordsQuery.error ?? countQuery.error,
      canQuery,
      canCount,
      needsVariant,
    },
    joins,
    density,
    setDensity,
    viewState,
    applyView,
  }
}
