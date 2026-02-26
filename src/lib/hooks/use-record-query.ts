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

export type Density = 'compact' | 'standard' | 'comfortable'
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export interface SavedView {
  id: string
  name: string
  filter: Omit<QQueryFilter, 'skip' | 'limit'>
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  sortOrder: QFilterOrderBy[]
  createdAt: string
}

export interface RecordQueryState {
  // Pagination
  pageNum: number
  pageSize: PageSize

  // Filter
  userFilter: QQueryFilter
  quickSearchTerm: string
  filterMode: 'basic' | 'advanced'

  // Sort
  sortOrder: QFilterOrderBy[]

  // Column config (persisted to localStorage)
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  columnWidths: Record<string, number>

  // Selection
  rowSelection: Record<string, boolean>

  // UI panels
  columnConfigOpen: boolean
  filterPanelOpen: boolean
}

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

    case 'TOGGLE_COLUMN':
      return {
        ...state,
        columnVisibility: {
          ...state.columnVisibility,
          [action.fieldName]: !state.columnVisibility[action.fieldName],
        },
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

interface UseRecordQueryOptions {
  tableName: string
  tableMetaData: QTableMetaData | undefined
  initialPageSize?: PageSize
}

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
      if ([10, 25, 50, 100].includes(n)) resolvedPageSize = n as PageSize
    }

    initialStateRef.current = {
      filter: initialFilter,
      pageNum,
      pageSize: resolvedPageSize,
      quickSearchTerm: searchParams.get('q') ?? '',
    }
  }

  const initVals = initialStateRef.current
  const initialState: RecordQueryState = {
    pageNum: initVals.pageNum,
    pageSize: initVals.pageSize,
    userFilter: initVals.filter,
    quickSearchTerm: initVals.quickSearchTerm,
    filterMode: 'basic',
    sortOrder: initVals.filter.orderBys ?? [],
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
  }, [state.pageNum, state.pageSize, state.userFilter, state.quickSearchTerm]) // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Build the effective filter for API calls
  // Merges userFilter + quickSearch + pagination + sort
  // ------------------------------------------------------------------
  const effectiveFilter = useMemo<QQueryFilter>(() => {
    const base = state.quickSearchTerm
      ? buildQuickFilterFromState(state.quickSearchTerm, tableMetaData, state.columnVisibility)
      : { ...state.userFilter }

    const withSort = applySort(base, state.sortOrder)
    return applyPagination(withSort, state.pageNum, state.pageSize)
  }, [
    state.userFilter,
    state.quickSearchTerm,
    state.sortOrder,
    state.pageNum,
    state.pageSize,
    tableMetaData,
    state.columnVisibility,
  ])

  // Filter for count query (no pagination offsets)
  const countFilter = useMemo<QQueryFilter>(() => {
    const base = state.quickSearchTerm
      ? buildQuickFilterFromState(state.quickSearchTerm, tableMetaData, state.columnVisibility)
      : { ...state.userFilter }
    return { ...base, skip: 0, limit: 0, orderBys: [] }
  }, [state.userFilter, state.quickSearchTerm, tableMetaData, state.columnVisibility])

  // ------------------------------------------------------------------
  // Build joins from exposedJoins metadata
  // ------------------------------------------------------------------
  const joins = useMemo<QueryJoin[] | undefined>(() => {
    if (!tableMetaData?.exposedJoins?.length) return undefined
    return tableMetaData.exposedJoins
      .filter((ej) => ej.joinTable?.name)
      .map((ej): QueryJoin => ({
        joinTable: ej.joinTable!.name,
        select: true,
        type: ej.isMany ? 'LEFT' : 'INNER',
      }))
  }, [tableMetaData])

  // ------------------------------------------------------------------
  // TanStack Query: records
  // ------------------------------------------------------------------
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
  const records = useMemo<QRecord[]>(
    () => recordsQuery.data?.records ?? [],
    [recordsQuery.data?.records]
  )
  const totalCount: number = countQuery.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / state.pageSize))
  const isLoading = recordsQuery.isLoading || countQuery.isLoading
  const isFetching = recordsQuery.isFetching
  const isError = recordsQuery.isError
  const error = recordsQuery.error

  // Selected record IDs
  const selectedRecordIds = useMemo<(string | number)[]>(() => {
    return Object.entries(state.rowSelection)
      .filter(([, selected]) => selected)
      .map(([idx]): string | number => {
        const record = records[parseInt(idx, 10)]
        if (!record || !tableMetaData) return idx
        const pkVal = record.values[tableMetaData.primaryKeyField]
        if (typeof pkVal === 'string' || typeof pkVal === 'number') return pkVal
        return idx
      })
  }, [state.rowSelection, records, tableMetaData])

  // ------------------------------------------------------------------
  // Saved views API
  // ------------------------------------------------------------------
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

  const loadView = useCallback(
    (view: SavedView) => {
      dispatch({ type: 'LOAD_SAVED_VIEW', view })
    },
    []
  )

  const deleteView = useCallback(
    (id: string) => {
      setSavedViews((prev) => prev.filter((v) => v.id !== id))
    },
    [setSavedViews]
  )

  // ------------------------------------------------------------------
  // Action dispatchers (stable references)
  // ------------------------------------------------------------------
  const setPage = useCallback((pageNum: number) => dispatch({ type: 'SET_PAGE', pageNum }), [])
  const setPageSize = useCallback((pageSize: PageSize) => dispatch({ type: 'SET_PAGE_SIZE', pageSize }), [])
  const setUserFilter = useCallback((filter: QQueryFilter) => dispatch({ type: 'SET_USER_FILTER', filter }), [])
  const setQuickSearch = useCallback((term: string) => dispatch({ type: 'SET_QUICK_SEARCH', term }), [])
  const setFilterMode = useCallback((mode: 'basic' | 'advanced') => dispatch({ type: 'SET_FILTER_MODE', mode }), [])
  const setSort = useCallback((sortOrder: QFilterOrderBy[]) => dispatch({ type: 'SET_SORT', sortOrder }), [])
  const setColumnVisibility = useCallback(
    (visibility: Record<string, boolean>) => dispatch({ type: 'SET_COLUMN_VISIBILITY', visibility }),
    []
  )
  const toggleColumn = useCallback((fieldName: string) => dispatch({ type: 'TOGGLE_COLUMN', fieldName }), [])
  const setColumnOrder = useCallback((order: string[]) => dispatch({ type: 'SET_COLUMN_ORDER', order }), [])
  const setColumnWidth = useCallback(
    (fieldName: string, width: number) => dispatch({ type: 'SET_COLUMN_WIDTH', fieldName, width }),
    []
  )
  const setRowSelection = useCallback(
    (selection: Record<string, boolean>) => dispatch({ type: 'SET_ROW_SELECTION', selection }),
    []
  )
  const clearRowSelection = useCallback(() => dispatch({ type: 'CLEAR_ROW_SELECTION' }), [])
  const toggleColumnConfig = useCallback(() => dispatch({ type: 'TOGGLE_COLUMN_CONFIG' }), [])
  const setColumnConfigOpen = useCallback(
    (open: boolean) => dispatch({ type: 'SET_COLUMN_CONFIG_OPEN', open }),
    []
  )
  const toggleFilterPanel = useCallback(() => dispatch({ type: 'TOGGLE_FILTER_PANEL' }), [])
  const resetFilter = useCallback(() => dispatch({ type: 'RESET_FILTER' }), [])

  return {
    // State
    ...state,

    // Derived
    effectiveFilter,
    records,
    totalCount,
    totalPages,
    isLoading,
    isFetching,
    isError,
    error,
    selectedRecordIds,

    // Density
    density,
    setDensity,

    // Saved views
    savedViews,
    saveView,
    loadView,
    deleteView,

    // Dispatchers
    setPage,
    setPageSize,
    setUserFilter,
    setQuickSearch,
    setFilterMode,
    setSort,
    setColumnVisibility,
    toggleColumn,
    setColumnOrder,
    setColumnWidth,
    setRowSelection,
    clearRowSelection,
    toggleColumnConfig,
    setColumnConfigOpen,
    toggleFilterPanel,
    resetFilter,
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

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
