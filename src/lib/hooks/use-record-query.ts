/** use-record-query — manages all state for the Record Query page including filters, pagination, sorting, column config, saved views, and data fetching */

'use client'

// useRecordQuery — manages all state for the Record Query page
// Handles: filter state, pagination, sorting, column config, saved views, data fetching

import { useCallback, useMemo, useReducer, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import type {
  QTableMetaData,
  QRecord,
  QQueryFilter,
  QFilterOrderBy,
  QueryJoin,
} from '@/types'
import { queryRecords, countRecords } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import {
  emptyFilter,
  applyPagination,
  applySort,
  serializeFilter,
  deserializeFilter,
  isFilterEmpty,
} from '@/lib/utils/filter-utils'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** Row density preference for the data grid. */
export type Density = 'compact' | 'standard' | 'comfortable'
import { PAGE_SIZE_OPTIONS } from '@/lib/constants'
export { PAGE_SIZE_OPTIONS }
/** Union of all valid page-size values drawn from the shared constant array. */
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

/**
 * A named snapshot of filter, column, and sort state that the user can recall later.
 *
 * Saved views are persisted to localStorage keyed by table name. The `filter` field
 * intentionally omits `skip` and `limit` so pagination resets when the view is loaded.
 */
export interface SavedView {
  /** Unique identifier generated with `crypto.randomUUID()`. */
  id: string
  /** Human-readable label shown in the saved-views dropdown. */
  name: string
  /** Active filter at the time the view was saved (no pagination offsets). */
  filter: Omit<QQueryFilter, 'skip' | 'limit'>
  /** Map of fieldName → visible at the time the view was saved. */
  columnVisibility: Record<string, boolean>
  /** Ordered list of column field names at the time the view was saved. */
  columnOrder: string[]
  /** Sort order at the time the view was saved. */
  sortOrder: QFilterOrderBy[]
  /** ISO 8601 timestamp of when the view was created. */
  createdAt: string
}

/**
 * Full reducer state for the Record Query page.
 *
 * All mutable UI state — pagination, filter, sort, column config, and row selection —
 * lives here so it can be managed atomically via `useReducer`.
 */
export interface RecordQueryState {
  // Pagination
  /** Current 1-based page number. */
  pageNum: number
  /** Number of records per page. */
  pageSize: PageSize

  // Filter
  /** User-constructed filter from the filter panel (mutually exclusive with quickSearchTerm). */
  userFilter: QQueryFilter
  /** Text entered in the quick-search input; when set, supersedes `userFilter`. */
  quickSearchTerm: string
  /** Whether the filter panel is showing the basic or advanced editor. */
  filterMode: 'basic' | 'advanced'

  // Sort
  /** Active sort order applied to every data fetch. */
  sortOrder: QFilterOrderBy[]

  // Column config (persisted to localStorage)
  /** Map of fieldName → visible; `undefined` entries are treated as visible. */
  columnVisibility: Record<string, boolean>
  /** Ordered list of column field names; empty array means metadata-default order. */
  columnOrder: string[]
  /** Map of fieldName → pixel width for resized columns. */
  columnWidths: Record<string, number>

  // Selection
  /** Map of row primary-key string → selected boolean, managed by TanStack Table. */
  rowSelection: Record<string, boolean>

  // UI panels
  /** Whether the column-configuration side panel is open. */
  columnConfigOpen: boolean
  /** Whether the filter panel is open. */
  filterPanelOpen: boolean
}

/**
 * Discriminated union of all actions the record query reducer accepts.
 *
 * Each action corresponds to a single user interaction or state transition on the
 * Record Query page. Using a discriminated union provides exhaustive type checking
 * in the reducer switch statement.
 */
type RecordQueryAction =
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
  | { type: 'CLEAR_ROW_SELECTION' }
  | { type: 'TOGGLE_COLUMN_CONFIG' }
  | { type: 'SET_COLUMN_CONFIG_OPEN'; open: boolean }
  | { type: 'TOGGLE_FILTER_PANEL' }
  | { type: 'RESET_FILTER' }
  | { type: 'LOAD_SAVED_VIEW'; view: SavedView }

/**
 * Pure reducer for `RecordQueryState`.
 *
 * Handles all state transitions for the Record Query page. Pagination resets to
 * page 1 on any action that changes the result set (filter change, sort change,
 * page-size change, quick search, filter reset, or saved-view load).
 *
 * @param state - Current state snapshot.
 * @param action - Dispatched action describing the transition.
 * @returns New state (always a new object reference on change).
 */
function recordQueryReducer(
  state: RecordQueryState,
  action: RecordQueryAction
): RecordQueryState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, pageNum: action.pageNum }

    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.pageSize, pageNum: 1 }

    case 'SET_USER_FILTER':
      return { ...state, userFilter: action.filter, pageNum: 1, quickSearchTerm: '' }

    case 'SET_QUICK_SEARCH':
      return { ...state, quickSearchTerm: action.term, pageNum: 1 }

    case 'SET_FILTER_MODE':
      return { ...state, filterMode: action.mode }

    case 'SET_SORT':
      return { ...state, sortOrder: action.sortOrder, pageNum: 1 }

    case 'SET_COLUMN_VISIBILITY':
      return { ...state, columnVisibility: action.visibility }

    case 'TOGGLE_COLUMN': {
      // MED-11: treat undefined (never-toggled) as visible=true before inverting
      const currentVal = state.columnVisibility[action.fieldName] ?? true
      return {
        ...state,
        columnVisibility: {
          ...state.columnVisibility,
          [action.fieldName]: !currentVal,
        },
      }
    }

    case 'SET_COLUMN_ORDER':
      return { ...state, columnOrder: action.order }

    case 'SET_COLUMN_WIDTH':
      return {
        ...state,
        columnWidths: { ...state.columnWidths, [action.fieldName]: action.width },
      }

    case 'SET_ROW_SELECTION':
      return { ...state, rowSelection: action.selection }

    case 'CLEAR_ROW_SELECTION':
      return { ...state, rowSelection: {} }

    case 'TOGGLE_COLUMN_CONFIG':
      return { ...state, columnConfigOpen: !state.columnConfigOpen }

    case 'SET_COLUMN_CONFIG_OPEN':
      return { ...state, columnConfigOpen: action.open }

    case 'TOGGLE_FILTER_PANEL':
      return { ...state, filterPanelOpen: !state.filterPanelOpen }

    case 'RESET_FILTER':
      return {
        ...state,
        userFilter: emptyFilter(state.pageSize),
        quickSearchTerm: '',
        pageNum: 1,
      }

    case 'LOAD_SAVED_VIEW':
      return {
        ...state,
        userFilter: {
          ...action.view.filter,
          skip: 0,
          limit: state.pageSize,
        },
        columnVisibility: action.view.columnVisibility,
        columnOrder: action.view.columnOrder,
        sortOrder: action.view.sortOrder,
        pageNum: 1,
        quickSearchTerm: '',
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
  /** Initial number of rows per page. Defaults to 25. */
  initialPageSize?: PageSize
  /** Initial row density for the data grid. Defaults to `'standard'`. */
  initialDensity?: Density
}

/**
 * Manages all state for the Record Query page.
 *
 * This hook is the single source of truth for filter state, pagination, sorting,
 * column configuration, row selection, saved views, and the two TanStack Query
 * data-fetching queries (records + count). State is hydrated from URL search params
 * on mount and synced back to the URL on every change so that queries are shareable.
 *
 * Column visibility, order, and widths are additionally persisted to localStorage
 * so they survive navigation and page refreshes.
 *
 * @param options - Configuration including table name, metadata, and initial page size.
 * @returns Grouped namespaces: `pagination`, `filter`, `columns`, `selection`, `data`,
 *          `density`/`setDensity`, and `views`.
 */
export function useRecordQuery({
  tableName,
  tableMetaData,
  initialPageSize = 25,
}: UseRecordQueryOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ------------------------------------------------------------------
  // localStorage persistence keys
  // ------------------------------------------------------------------
  const storageKeyDensity = `qqq-${tableName}-density`
  const storageKeyColumns = `qqq-${tableName}-columns`
  const storageKeyColumnOrder = `qqq-${tableName}-column-order`
  const storageKeyColumnWidths = `qqq-${tableName}-column-widths`
  const storageKeySavedViews = `qqq-${tableName}-saved-views`

  const [density, setDensity] = useLocalStorage<Density>(storageKeyDensity, 'standard')
  const [storedColumnVisibility, setStoredColumnVisibility] = useLocalStorage<Record<string, boolean>>(
    storageKeyColumns,
    {}
  )
  const [storedColumnOrder, setStoredColumnOrder] = useLocalStorage<string[]>(
    storageKeyColumnOrder,
    []
  )
  const [storedColumnWidths, setStoredColumnWidths] = useLocalStorage<Record<string, number>>(
    storageKeyColumnWidths,
    {}
  )
  const [savedViews, setSavedViews] = useLocalStorage<SavedView[]>(storageKeySavedViews, [])

  // ------------------------------------------------------------------
  // Initial state — hydrate from URL params (read once on mount via ref)
  // ------------------------------------------------------------------
  const initialStateRef = useRef<{
    filter: QQueryFilter
    pageNum: number
    pageSize: PageSize
    quickSearchTerm: string
  } | null>(null)

  if (!initialStateRef.current) {
    const filterParam = searchParams.get('filter')
    const initialFilter = filterParam
      ? deserializeFilter(filterParam, initialPageSize)
      : emptyFilter(initialPageSize)

    const pageParam = searchParams.get('page')
    const pageNum = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1

    const pageSizeParam = searchParams.get('pageSize')
    let resolvedPageSize = initialPageSize
    if (pageSizeParam) {
      const n = parseInt(pageSizeParam, 10)
      if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) resolvedPageSize = n as PageSize
    }

    initialStateRef.current = {
      filter: initialFilter,
      pageNum,
      pageSize: resolvedPageSize,
      quickSearchTerm: searchParams.get('q') ?? '',
    }
  }

  const initialValues = initialStateRef.current
  const initialState: RecordQueryState = {
    pageNum: initialValues.pageNum,
    pageSize: initialValues.pageSize,
    userFilter: initialValues.filter,
    quickSearchTerm: initialValues.quickSearchTerm,
    filterMode: 'basic',
    sortOrder: initialValues.filter.orderBys ?? [],
    columnVisibility: storedColumnVisibility,
    columnOrder: storedColumnOrder,
    columnWidths: storedColumnWidths,
    rowSelection: {},
    columnConfigOpen: false,
    filterPanelOpen: false,
  }

  const [state, dispatch] = useReducer(recordQueryReducer, initialState)

  // ------------------------------------------------------------------
  // Persist column settings to localStorage when they change
  // ------------------------------------------------------------------
  useEffect(() => {
    setStoredColumnVisibility(state.columnVisibility)
  }, [state.columnVisibility]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStoredColumnOrder(state.columnOrder)
  }, [state.columnOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStoredColumnWidths(state.columnWidths)
  }, [state.columnWidths]) // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Sync state to URL params
  // ------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams()

    if (state.pageNum > 1) params.set('page', String(state.pageNum))
    if (state.pageSize !== 25) params.set('pageSize', String(state.pageSize))

    if (!isFilterEmpty(state.userFilter)) {
      params.set('filter', serializeFilter(state.userFilter))
    }

    if (state.quickSearchTerm) params.set('q', state.quickSearchTerm)

    const newSearch = params.toString()
    const currentSearch = searchParams.toString()

    if (newSearch !== currentSearch) {
      router.replace(`${pathname}?${newSearch}`, { scroll: false })
    }
  // HIGH-1: include router and pathname so the effect uses the current route in concurrent mode
  }, [state.pageNum, state.pageSize, state.userFilter, state.quickSearchTerm, router, pathname])

  // ------------------------------------------------------------------
  // Build the effective filter for API calls
  // Merges userFilter + quickSearch + pagination + sort
  // ------------------------------------------------------------------

  // Separated so effectiveFilter/countFilter don't depend on columnVisibility
  // when quickSearchTerm is empty (avoids needless re-queries on column toggle)
  /**
   * Base filter built from the quick-search term, or `null` when the term is empty.
   *
   * Kept separate from `effectiveFilter` and `countFilter` so that toggling column
   * visibility does not trigger a re-query when no quick-search term is active.
   */
  const quickSearchBase = useMemo<QQueryFilter | null>(() => {
    if (!state.quickSearchTerm) return null
    return buildQuickFilterFromState(state.quickSearchTerm, tableMetaData, state.columnVisibility)
  }, [state.quickSearchTerm, tableMetaData, state.columnVisibility])

  /**
   * Fully assembled filter sent to the records query.
   *
   * Merges `quickSearchBase` (or `userFilter`), the active sort order, and
   * the current pagination offsets (`skip` / `limit`).
   */
  const effectiveFilter = useMemo<QQueryFilter>(() => {
    const base = quickSearchBase ?? { ...state.userFilter }
    const withSort = applySort(base, state.sortOrder)
    return applyPagination(withSort, state.pageNum, state.pageSize)
  }, [quickSearchBase, state.userFilter, state.sortOrder, state.pageNum, state.pageSize])

  /**
   * Filter sent to the count query — identical to `effectiveFilter` but with
   * `skip: 0`, `limit: 0`, and no sort order so the backend returns only the total count.
   */
  const countFilter = useMemo<QQueryFilter>(() => {
    const base = quickSearchBase ?? { ...state.userFilter }
    return { ...base, skip: 0, limit: 0, orderBys: [] }
  }, [quickSearchBase, state.userFilter])

  // ------------------------------------------------------------------
  // Build joins from exposedJoins metadata
  // Derived directly from stable tableMetaData prop — no useMemo needed
  // ------------------------------------------------------------------
  /**
   * Join descriptors derived from `tableMetaData.exposedJoins`.
   *
   * Many-side joins use `LEFT` so records without related rows are still returned;
   * one-side joins use `INNER`. Undefined when the table has no exposed joins.
   */
  const joins: QueryJoin[] | undefined = tableMetaData?.exposedJoins?.length
    ? tableMetaData.exposedJoins
        .filter((exposedJoin) => exposedJoin.joinTable?.name)
        .map((exposedJoin): QueryJoin => ({
          joinTable: exposedJoin.joinTable!.name,
          select: true,
          type: exposedJoin.isMany ? 'LEFT' : 'INNER',
        }))
    : undefined

  // ------------------------------------------------------------------
  // TanStack Query: records
  // ------------------------------------------------------------------
  /**
   * TanStack Query result for the paginated records list.
   *
   * Disabled until `tableMetaData` is available. Uses `placeholderData` so the
   * previous page's records remain visible during transitions (avoids layout shift).
   * Cache key includes the serialized `effectiveFilter` and `joins` so any filter
   * or join change triggers an independent cache entry.
   */
  const recordsQuery = useQuery({
    queryKey: [
      ...queryKeys.tableRecords(tableName),
      'query',
      JSON.stringify(effectiveFilter),
      JSON.stringify(joins ?? null),
    ],
    queryFn: () =>
      queryRecords(tableName, {
        filter: effectiveFilter,
        joins,
      }),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
    enabled: Boolean(tableMetaData),
  })

  // ------------------------------------------------------------------
  // TanStack Query: count
  // ------------------------------------------------------------------
  /**
   * TanStack Query result for the total record count matching the active filter.
   *
   * Uses `countFilter` (no pagination offsets) so the total is independent of the
   * current page. Runs in parallel with `recordsQuery` and uses the same
   * `placeholderData` strategy to avoid flickering the pagination controls.
   */
  const countQuery = useQuery({
    queryKey: [
      ...queryKeys.tableRecords(tableName),
      'count',
      JSON.stringify(countFilter),
      JSON.stringify(joins ?? null),
    ],
    queryFn: () =>
      countRecords(tableName, {
        filter: countFilter,
        joins,
      }),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
    enabled: Boolean(tableMetaData),
  })

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------
  /** Flat array of records returned by the current query; empty array while loading. */
  const records = useMemo<QRecord[]>(
    () => recordsQuery.data?.records ?? [],
    [recordsQuery.data?.records]
  )
  /** Total number of records matching the active filter (for pagination controls). */
  const totalCount: number = countQuery.data?.count ?? 0
  /** Total number of pages; always at least 1 to avoid division-by-zero. */
  const totalPages = Math.max(1, Math.ceil(totalCount / state.pageSize))
  /** `true` while either the records or count query is in its initial loading state. */
  const isLoading = recordsQuery.isLoading || countQuery.isLoading
  /** `true` whenever the records query is fetching (includes background refetches). */
  const isFetching = recordsQuery.isFetching
  /** `true` if the records query encountered an error. */
  const isError = recordsQuery.isError
  /** The error thrown by the records query, or `null`. */
  const error = recordsQuery.error

  /**
   * Primary-key values of all currently selected rows.
   *
   * `rowSelection` is keyed by PK string (set via DataGrid's `getRowId`), so the
   * keys are used directly instead of resolving through the records array by index
   * (HIGH-7). Numeric-looking strings are converted to numbers to match the backend's
   * expected type for delete / bulk-action calls.
   */
  const selectedRecordIds = useMemo<(string | number)[]>(() => {
    return Object.entries(state.rowSelection)
      .filter(([, selected]) => selected)
      .map(([id]): string | number => {
        const numId = Number(id)
        return Number.isFinite(numId) && String(numId) === id ? numId : id
      })
  }, [state.rowSelection])

  // ------------------------------------------------------------------
  // Saved views API
  // ------------------------------------------------------------------
  /**
   * Snapshot the current filter, column visibility, column order, and sort order
   * into a new saved view and persist it to localStorage.
   *
   * Pagination offsets are intentionally excluded from the snapshot so that loading
   * the view always starts at page 1.
   *
   * @param name - User-visible label for the saved view.
   * @returns The newly created `SavedView` object.
   */
  const saveView = useCallback(
    (name: string) => {
      const view: SavedView = {
        id: crypto.randomUUID(),
        name,
        filter: {
          criteria: state.userFilter.criteria,
          orderBys: state.userFilter.orderBys,
          subFilters: state.userFilter.subFilters,
          booleanOperator: state.userFilter.booleanOperator,
        },
        columnVisibility: state.columnVisibility,
        columnOrder: state.columnOrder,
        sortOrder: state.sortOrder,
        createdAt: new Date().toISOString(),
      }
      setSavedViews((prev) => [...prev, view])
      return view
    },
    [state.userFilter, state.columnVisibility, state.columnOrder, state.sortOrder, setSavedViews]
  )

  /**
   * Apply a previously saved view to the current query state.
   *
   * Restores filter, column visibility, column order, and sort order from the view.
   * Pagination resets to page 1 and the quick-search term is cleared.
   *
   * @param view - The saved view to load.
   */
  const loadView = useCallback(
    (view: SavedView) => {
      dispatch({ type: 'LOAD_SAVED_VIEW', view })
    },
    []
  )

  /**
   * Remove a saved view from localStorage by its ID.
   *
   * @param id - The `id` of the `SavedView` to delete.
   */
  const deleteView = useCallback(
    (id: string) => {
      setSavedViews((prev) => prev.filter((v) => v.id !== id))
    },
    [setSavedViews]
  )

  // ------------------------------------------------------------------
  // Action dispatchers (stable references)
  // ------------------------------------------------------------------
  /** Navigate to a specific 1-based page number. */
  const setPage = useCallback((pageNum: number) => dispatch({ type: 'SET_PAGE', pageNum }), [])
  /** Change the number of rows per page; resets to page 1. */
  const setPageSize = useCallback((pageSize: PageSize) => dispatch({ type: 'SET_PAGE_SIZE', pageSize }), [])
  /** Replace the user-constructed filter; clears quick-search and resets to page 1. */
  const setUserFilter = useCallback((filter: QQueryFilter) => dispatch({ type: 'SET_USER_FILTER', filter }), [])
  /** Update the quick-search text; resets to page 1. */
  const setQuickSearch = useCallback((term: string) => dispatch({ type: 'SET_QUICK_SEARCH', term }), [])
  /** Switch between the basic and advanced filter editors. */
  const setFilterMode = useCallback((mode: 'basic' | 'advanced') => dispatch({ type: 'SET_FILTER_MODE', mode }), [])
  /** Replace the active sort order; resets to page 1. */
  const setSort = useCallback((sortOrder: QFilterOrderBy[]) => dispatch({ type: 'SET_SORT', sortOrder }), [])
  /**
   * Replace the entire column visibility map.
   *
   * @param visibility - Map of fieldName → boolean.
   */
  const setColumnVisibility = useCallback(
    (visibility: Record<string, boolean>) => dispatch({ type: 'SET_COLUMN_VISIBILITY', visibility }),
    []
  )
  /**
   * Toggle a single column's visibility.
   *
   * Treats `undefined` (never toggled) as `true` before inverting (MED-11).
   *
   * @param fieldName - The field to toggle.
   */
  const toggleColumn = useCallback((fieldName: string) => dispatch({ type: 'TOGGLE_COLUMN', fieldName }), [])
  /**
   * Replace the ordered list of column field names.
   *
   * @param order - Array of field names in the desired display order.
   */
  const setColumnOrder = useCallback((order: string[]) => dispatch({ type: 'SET_COLUMN_ORDER', order }), [])
  /**
   * Record the pixel width of a resized column.
   *
   * @param fieldName - The resized column's field name.
   * @param width - New width in pixels.
   */
  const setColumnWidth = useCallback(
    (fieldName: string, width: number) => dispatch({ type: 'SET_COLUMN_WIDTH', fieldName, width }),
    []
  )
  /**
   * Replace the row selection map (keyed by primary key string).
   *
   * @param selection - Map of PK string → selected boolean.
   */
  const setRowSelection = useCallback(
    (selection: Record<string, boolean>) => dispatch({ type: 'SET_ROW_SELECTION', selection }),
    []
  )
  /** Deselect all currently selected rows. */
  const clearRowSelection = useCallback(() => dispatch({ type: 'CLEAR_ROW_SELECTION' }), [])
  /** Toggle the column-configuration side panel open/closed. */
  const toggleColumnConfig = useCallback(() => dispatch({ type: 'TOGGLE_COLUMN_CONFIG' }), [])
  /**
   * Explicitly set the open state of the column-configuration side panel.
   *
   * @param open - `true` to open, `false` to close.
   */
  const setColumnConfigOpen = useCallback(
    (open: boolean) => dispatch({ type: 'SET_COLUMN_CONFIG_OPEN', open }),
    []
  )
  /** Toggle the filter panel open/closed. */
  const toggleFilterPanel = useCallback(() => dispatch({ type: 'TOGGLE_FILTER_PANEL' }), [])
  /** Clear all active filters and quick-search, resetting to page 1. */
  const resetFilter = useCallback(() => dispatch({ type: 'RESET_FILTER' }), [])

  return {
    pagination: {
      pageNum: state.pageNum,
      pageSize: state.pageSize,
      totalCount,
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
      effectiveFilter,
      setUserFilter,
      setQuickSearch,
      setFilterMode,
      setSort,
      resetFilter,
      toggleFilterPanel,
    },

    columns: {
      columnVisibility: state.columnVisibility,
      columnOrder: state.columnOrder,
      columnWidths: state.columnWidths,
      columnConfigOpen: state.columnConfigOpen,
      setColumnVisibility,
      toggleColumn,
      setColumnOrder,
      setColumnWidth,
      toggleColumnConfig,
      setColumnConfigOpen,
    },

    selection: {
      rowSelection: state.rowSelection,
      selectedRecordIds,
      setRowSelection,
      clearRowSelection,
    },

    data: {
      records,
      isLoading,
      isFetching,
      isError,
      error,
    },

    // Density is a persisted display preference — kept flat for brevity
    density,
    setDensity,

    views: {
      list: savedViews,
      saveView,
      loadView,
      deleteView,
    },
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * Build a `QQueryFilter` that performs an OR-joined `CONTAINS` search across all
 * visible `STRING` and `TEXT` columns.
 *
 * Used exclusively by `useRecordQuery` to implement the quick-search input. Returns
 * an empty filter when `searchTerm` is blank, `tableMetaData` is undefined, or no
 * visible string/text columns exist.
 *
 * @param searchTerm - The user's raw search string (trimmed internally before use).
 * @param tableMetaData - Metadata for the table being searched.
 * @param columnVisibility - Current column visibility map; columns set to `false` are excluded.
 * @returns A `QQueryFilter` with one `CONTAINS` criterion per visible string/text field,
 *          joined with `booleanOperator: 'OR'`, or an empty filter if no columns qualify.
 */
function buildQuickFilterFromState(
  searchTerm: string,
  tableMetaData: QTableMetaData | undefined,
  columnVisibility: Record<string, boolean>
): QQueryFilter {
  if (!tableMetaData || !searchTerm.trim()) {
    return emptyFilter()
  }

  const visibleStringFields = Object.values(tableMetaData.fields).filter((f) => {
    if (f.isHidden) return false
    if (columnVisibility[f.name] === false) return false
    return ['STRING', 'TEXT'].includes(f.type)
  })

  if (visibleStringFields.length === 0) return emptyFilter()

  return {
    criteria: visibleStringFields.map((field) => ({
      fieldName: field.name,
      operator: 'CONTAINS' as const,
      values: [searchTerm],
    })),
    orderBys: [],
    subFilters: [],
    booleanOperator: 'OR',
    skip: 0,
    limit: 25,
  }
}
