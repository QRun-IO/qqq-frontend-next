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
 * @file RecordQuery — orchestrator page component for the record query page. Brings together
 * DataGrid, FilterBuilder, Pagination, ColumnConfig, selection, the Actions menu, backend saved
 * views, export and table variants.
 */

'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, ArrowLeft, CircleHelp, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import type { QTableMetaData, QProcessMetaData, QInstance, QQueryFilter } from '@/types'
import { queryRecords, type TableVariant } from '@/lib/api/tables'
import { useRecordQuery, hasCapability } from '@/lib/hooks/use-record-query'
import type { PageSize } from '@/lib/hooks/use-record-query'
import { useSavedViews, useSavedView } from '@/lib/hooks/use-saved-views'
import { countActiveCriteria, emptyFilter, isCriterionComplete, MISSING_FILTER_VARIABLE_MESSAGE, normalizeFilter, prepFilterForBackend, resolveField } from '@/lib/utils/filter-utils'
import { withTrailingSlash } from '@/lib/utils/material-links'
import { canFilterWorkAsBasic } from '@/lib/utils/quick-filter-utils'
import { getQueryColumns, orderColumns, pinColumn, withReadableExposedJoins } from '@/lib/utils/query-columns'
import { buildViewJson, diffViews, isColumnVisible, reconcileView, viewToState, type SavedView, type ViewState } from '@/lib/utils/saved-view-utils'
import { AD_HOC_VIEW_IDENTITY, clearStoredQueryState, readCurrentSavedViewId, readStoredQueryView, savedViewIdentity, writeCurrentSavedViewId, writeStoredQueryView } from '@/lib/utils/query-view-storage'
import { isSafeRedirectPath } from '@/lib/utils/string-utils'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { queryKeys } from '@/lib/query-client'
import { useQContext } from '@/lib/context/q-context'
import { useUserPreferences } from '@/lib/hooks/use-user-preferences'
import { canInsertRecords } from '@/lib/auth/permissions'
import { usePageShortcuts } from '@/lib/hooks/use-page-shortcuts'
import { FilterSettingsProvider, filterSettingsFrom } from '@/lib/context/filter-settings-context'
import { TABLE_VARIANT_STORAGE_KEY_ROOT, readStoredTableVariant } from '@/lib/utils/table-variant'
import { launchTableName } from '@/lib/utils/process-utils'
import { DEFAULT_COPY_FULL_QUERY_VALUES_LIMIT, PAGE_SIZE_OPTIONS, SEARCH_DEBOUNCE_MS } from '@/lib/constants'
import { recordAnalytics } from '@/lib/analytics'
import { scrollPageToTop } from '@/lib/utils/scroll-to-top'

import { GotoRecordDialog } from '@/components/records/GotoRecordDialog'

import { FilterBuilder, buildFilterFields } from './FilterBuilder'
import { QuickFilterBar } from './QuickFilterBar'
import { AdvancedQueryPreview } from './AdvancedQueryPreview'
import { HintTooltip } from './HintTooltip'
import { RecordQueryToolbar } from './RecordQueryToolbar'
import { RecordQueryBulkBar } from './RecordQueryBulkBar'
import { RecordQueryContent } from './RecordQueryContent'
import { SavedViewsMenu } from './SavedViewsMenu'
import { SelectionMenu } from './SelectionMenu'
import { VariantPicker } from './VariantPicker'
import { ColumnStatsDialog, COLUMN_STATS_PROCESS } from './ColumnStatsDialog'
import { QuickSavedViews } from './QuickSavedViews'

/** Display mode for the record list — either a tabular grid or a card layout. */
type ViewMode = 'grid' | 'card'

/**
 * Props for the RecordQuery component.
 */
interface RecordQueryProps {
  /** The backend table name used in API calls and URL routing. */
  tableName: string
  /** Full table metadata from the QQQ backend, describing fields and permissions. */
  tableMetaData: QTableMetaData
  /** Complete table registry, including permissions for intermediate join tables. */
  allTables: Record<string, QTableMetaData>
  /** The table's visible processes (Actions menu). */
  processes?: QProcessMetaData[]
  /** Instance metadata (bulk processes, saved view processes). */
  metaData?: QInstance
  /** Saved view to open (the `/savedView/{id}` route). */
  savedViewId?: number
}

/**
 * Full-page record query component for a QQQ table.
 *
 * @param props - Component properties.
 * @returns The composed query page.
 */
export function RecordQuery({ tableName, tableMetaData: sourceTableMetaData, allTables, processes, metaData, savedViewId }: RecordQueryProps) {
  const tableMetaData = useMemo(() => withReadableExposedJoins(sourceTableMetaData, allTables), [sourceTableMetaData, allTables])
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPath = searchParams.get('from')
  const fromLabel = searchParams.get('fromLabel')
  const safeFromPath = fromPath && isSafeRedirectPath(fromPath) ? fromPath : null
  const queryClient = useQueryClient()
  const quickSearchRef = useRef<HTMLInputElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const { preferences } = useUserPreferences()
  const { userId, setPageHeader } = useQContext()
  const allProcesses = useMemo(() => metaData?.processes ?? {}, [metaData])

  // ------------------------------------------------------------------
  // Variants (tables whose backend uses variants): stored per table, as in Material
  // ------------------------------------------------------------------
  const [tableVariant, setTableVariant] = useState<TableVariant | null>(() => (tableMetaData.usesVariants ? readStoredTableVariant(tableName) : null))
  const [variantPickerOpen, setVariantPickerOpen] = useState(() => Boolean(tableMetaData.usesVariants) && readStoredTableVariant(tableName) === null)
  const chooseVariant = (variant: TableVariant) => {
    try {
      localStorage.setItem(`${TABLE_VARIANT_STORAGE_KEY_ROOT}.${tableName}`, JSON.stringify(variant))
    } catch {
      // persistence is best-effort
    }
    setTableVariant(variant)
    setVariantPickerOpen(false)
  }

  // ------------------------------------------------------------------
  // Saved views
  // ------------------------------------------------------------------
  const savedViews = useSavedViews(tableName, metaData, userId)
  const savedViewQuery = useSavedView(tableName, savedViewId, savedViews.isAvailable)
  const currentView: SavedView | null = savedViewId !== undefined ? savedViewQuery.data ?? null : null
  const [viewWarnings, setViewWarnings] = useState<string[]>([])
  const hadUrlStateRef = useRef(['filter', 'q', 'page', 'pageSize'].some((key) => searchParams.has(key)))
  const appliedViewRef = useRef<string | null>(null)
  const viewLoading = savedViewId !== undefined && savedViews.isAvailable && savedViewQuery.isLoading

  const rq = useRecordQuery({
    tableName,
    tableMetaData,
    allTables,
    initialPageSize: preferences.tableDefaultPageSize,
    tableVariant,
    paused: viewLoading || !tableMetaData.readPermission,
  })
  const { applyView } = rq

  // Apply a saved view once it loads (unless the URL already carries modified state)
  useEffect(() => {
    if (!currentView) return
    const key = `${currentView.id}:${JSON.stringify(currentView.view)}`
    if (appliedViewRef.current === key) return
    const first = appliedViewRef.current === null
    appliedViewRef.current = key
    const stored = readStoredQueryView(tableName)
    const view = stored?.viewIdentity === savedViewIdentity(currentView.id) ? stored : currentView.view
    const reconciled = reconcileView(tableMetaData, view)
    setViewWarnings(reconciled.warnings)
    if (first && hadUrlStateRef.current) return
    applyView(viewToState(tableMetaData, reconciled.view, preferences.tableDefaultPageSize, PAGE_SIZE_OPTIONS))
  }, [currentView, applyView, tableMetaData, tableName, preferences.tableDefaultPageSize])

  useEffect(() => {
    setPageHeader(`${tableMetaData.label}${currentView ? ` / ${currentView.label}` : ''}`)
  }, [currentView, setPageHeader, tableMetaData.label])

  useEffect(() => {
    if (savedViewId !== undefined) {
      if (currentView) writeCurrentSavedViewId(tableName, currentView.id)
      return
    }
    if (hadUrlStateRef.current) return
    const lastId = readCurrentSavedViewId(tableName)
    if (lastId) router.replace(`/app/${encodeURIComponent(tableName)}/savedView/${lastId}`)
  }, [savedViewId, currentView, tableName, router])

  const defaultViewState = useMemo<ViewState>(() => ({
    userFilter: emptyFilter(preferences.tableDefaultPageSize),
    sortOrder: rq.filter.defaultSort,
    columnVisibility: {},
    columnOrder: [],
    columnWidths: {},
    pageSize: preferences.tableDefaultPageSize,
    filterMode: 'basic',
  }), [preferences.tableDefaultPageSize, rq.filter.defaultSort])
  const currentViewJson = useMemo(() => buildViewJson(tableMetaData, rq.viewState), [tableMetaData, rq.viewState])
  const reportHref = useMemo(() => {
    if (!canInsertRecords(metaData?.tables?.savedReport)) return undefined
    const filter = normalizeFilter(currentViewJson.queryFilter, rq.viewState.pageSize)
    const prepared = prepFilterForBackend(filter, (name) => resolveField(tableMetaData, name)?.field)
    const presets = {
      tableName,
      queryFilterJson: JSON.stringify(prepared),
      columnsJson: JSON.stringify(currentViewJson.queryColumns),
    }
    return `/app/savedReport/create#defaultValues=${encodeURIComponent(JSON.stringify(presets))}`
  }, [currentViewJson, metaData?.tables?.savedReport, rq.viewState.pageSize, tableMetaData, tableName])
  const viewDiffs = useMemo(
    () => diffViews(tableMetaData, currentView ? currentView.view : buildViewJson(tableMetaData, defaultViewState), currentViewJson),
    [tableMetaData, currentView, defaultViewState, currentViewJson]
  )

  const openNewView = () => {
    recordAnalytics({ category: 'tableEvents', action: 'activateNewView', label: tableMetaData.label })
    clearStoredQueryState(tableName)
    setViewWarnings([])
    setLocalSearchTerm('')
    if (savedViewId === undefined) {
      applyView(defaultViewState)
      return
    }
    // Leaving a saved view: the table page starts from the default columns
    try {
      for (const suffix of ['columns', 'column-order', 'column-widths']) localStorage.removeItem(`qqq-${tableName}-${suffix}`)
    } catch {
      // persistence is best-effort
    }
    router.push(`/app/${encodeURIComponent(tableName)}`)
  }
  const openSavedView = (view: SavedView) => {
    recordAnalytics({ category: 'tableEvents', action: 'activateSavedView', label: tableMetaData.label })
    if (view.id === savedViewId) {
      setLocalSearchTerm('')
      const reconciled = reconcileView(tableMetaData, view.view)
      setViewWarnings(reconciled.warnings)
      applyView(viewToState(tableMetaData, reconciled.view, preferences.tableDefaultPageSize, PAGE_SIZE_OPTIONS))
      return
    }
    router.push(`/app/${encodeURIComponent(tableName)}/savedView/${view.id}`)
  }
  const storeView = async ({ id, label }: { id?: number; label: string }) => {
    // keep settings Next does not edit (Material quick filter fields) from the view being saved over
    const stored = await savedViews.storeView({ id, label, view: buildViewJson(tableMetaData, rq.viewState, id !== undefined ? currentView?.view : undefined) })
    if (stored.id !== savedViewId) router.push(`/app/${encodeURIComponent(tableName)}/savedView/${stored.id}`)
    else await savedViewQuery.refetch()
  }
  const deleteView = async (view: SavedView) => {
    await savedViews.deleteView(view.id)
    openNewView()
  }

  // ------------------------------------------------------------------
  // Quick search (debounced)
  // ------------------------------------------------------------------
  const [localSearchTerm, setLocalSearchTerm] = useState(rq.filter.quickSearchTerm)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => rq.filter.setQuickSearch(value), SEARCH_DEBOUNCE_MS)
  }
  useEffect(() => () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }, [])

  const activeFilterCount = countActiveCriteria(rq.filter.userFilter)
  const basicModeCheck = canFilterWorkAsBasic(tableMetaData, rq.filter.userFilter)
  const availableFilterFields = useMemo(() => buildFilterFields(tableMetaData), [tableMetaData])
  const quickFilterNames = [...new Set([...rq.filter.defaultQuickFilterFieldNames, ...rq.filter.quickFilterFieldNames])]
  const quickFilterFields = quickFilterNames.flatMap((name) => {
    const field = availableFilterFields.find((candidate) => candidate.name === name)
    return field ? [field] : []
  })
  const filterSettings = useMemo(() => filterSettingsFrom(metaData), [metaData])

  // View mode: grid vs card — default from user preferences; mobile override after mount
  // A chosen view mode is remembered per table, so returning from a record keeps the table view on a phone.
  const viewModeKey = `qqq-${tableName}-view-mode`
  const [viewMode, setViewModeState] = useState<ViewMode>(preferences.tableDefaultViewMode)
  const [viewModeReady, setViewModeReady] = useState(false)
  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(viewModeKey)
    } catch {
      // persistence is best-effort
    }
    if (stored === 'grid' || stored === 'card') setViewModeState(stored)
    else if (window.innerWidth < 768) setViewModeState('card')
    setViewModeReady(true)
  }, [viewModeKey])
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
    try {
      localStorage.setItem(viewModeKey, mode)
    } catch {
      // persistence is best-effort
    }
  }, [viewModeKey])
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [statsColumn, setStatsColumn] = useState<{ name: string; label: string } | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  // Column statistics need the table's QUERY_STATS capability and the columnStats process
  const statsProcess = allProcesses[COLUMN_STATS_PROCESS]
  const canShowStats = hasCapability(tableMetaData, 'QUERY_STATS') && Boolean(statsProcess) && statsProcess?.hasPermission !== false
  // Stable, so the grid's memoized rows are not re-rendered by a new handler each render
  const openColumnStats = useCallback((name: string, label: string) => setStatsColumn({ name, label }), [setStatsColumn])

  const canCreate = canInsertRecords(tableMetaData)
  const distinct = rq.pagination.distinctCount !== null
  const matchingCount = rq.pagination.distinctCount ?? rq.pagination.totalCount

  const exportColumns = useMemo(
    () => orderColumns(getQueryColumns(tableMetaData), rq.columns.columnOrder).filter((c) => isColumnVisible(c.name, rq.columns.columnVisibility)).map((c) => c.name),
    [tableMetaData, rq.columns.columnOrder, rq.columns.columnVisibility]
  )
  const queryColumns = useMemo(() => getQueryColumns(tableMetaData), [tableMetaData])
  const joinedLabels = useMemo(() => {
    const active = new Set((rq.joins ?? []).map((join) => join.joinTable))
    return (tableMetaData.exposedJoins ?? []).filter((join) => join.joinTable && active.has(join.joinTable.name))
      .map((join) => join.label || join.joinTable?.label || join.joinTable?.name).filter((label): label is string => Boolean(label))
  }, [rq.joins, tableMetaData.exposedJoins])
  const filteredColumns = useMemo(() => {
    const names = new Set<string>()
    const visit = (filter: QQueryFilter) => {
      for (const criterion of filter.criteria ?? []) if (isCriterionComplete(criterion)) names.add(criterion.fieldName)
      for (const child of filter.subFilters ?? []) visit(child)
    }
    visit(rq.filter.userFilter)
    return names
  }, [rq.filter.userFilter])
  const baselineColumns = currentView?.view.queryColumns ?? buildViewJson(tableMetaData, defaultViewState).queryColumns
  const columnsChanged = JSON.stringify(currentViewJson.queryColumns) !== JSON.stringify(baselineColumns)
  const columnsState = columnsChanged ? 'dirty' : currentView ? 'clean' : 'empty'

  useEffect(() => {
    if (savedViewId === undefined && !hadUrlStateRef.current && !readCurrentSavedViewId(tableName)) {
      const stored = readStoredQueryView(tableName)
      if (stored) {
        const reconciled = reconcileView(tableMetaData, stored)
        setViewWarnings(reconciled.warnings)
        applyView(viewToState(tableMetaData, reconciled.view, preferences.tableDefaultPageSize, PAGE_SIZE_OPTIONS))
      }
    }
    setStorageReady(true)
  // Restore once on mount; subsequent state changes are saved by the next effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!storageReady || (savedViewId !== undefined && !currentView)) return
    if (savedViewId === undefined && !hadUrlStateRef.current && readCurrentSavedViewId(tableName)) return
    writeStoredQueryView(tableName, {
      ...currentViewJson,
      viewIdentity: currentView ? savedViewIdentity(currentView.id) : AD_HOC_VIEW_IDENTITY,
    })
  }, [storageReady, tableName, currentViewJson, currentView, savedViewId])

  const columnMenu = {
    onFilter: (name: string) => {
      rq.filter.setUserFilter({ ...rq.filter.userFilter, criteria: [...rq.filter.userFilter.criteria, { fieldName: name, operator: 'EQUALS' as const, values: [] }] })
      if (!rq.filter.filterPanelOpen && !mobileFilterOpen) handleFilterToggle()
    },
    onHide: (name: string) => rq.columns.setColumnVisibility({ ...rq.columns.columnVisibility, [name]: false }),
    onPin: (name: string, side: 'left' | 'right' | null) => rq.columns.setColumnPins(
      pinColumn(queryColumns.map((column) => column.name), rq.columns.columnPins, name, side, tableMetaData.primaryKeyField)
    ),
    onCopyPageValues: (name: string) => {
      const label = queryColumns.find((column) => column.name === name)?.label ?? name
      const values = rq.data.records.map((record) => String(record.displayValues?.[name] ?? record.values[name] ?? ''))
      void navigator.clipboard.writeText(`${values.join('\n')}\n`)
        .then(() => setAlertMessage(`Copied ${values.length.toLocaleString()} ${label} values.`))
        .catch(() => setAlertMessage(`Could not copy ${label} values.`))
    },
    onCopyFullQueryValues: (name: string) => {
      void (async () => {
        const label = queryColumns.find((column) => column.name === name)?.label ?? name
        const setting = metaData?.supplementalInstanceMetaData?.materialDashboard
        const configuredLimit = setting && typeof setting === 'object' && 'queryScreenCopyFullQueryColumnValuesLimit' in setting
          ? setting.queryScreenCopyFullQueryColumnValuesLimit : undefined
        const limit = typeof configuredLimit === 'number' && configuredLimit > 0 ? configuredLimit : DEFAULT_COPY_FULL_QUERY_VALUES_LIMIT
        if (rq.pagination.totalCount !== null && rq.pagination.totalCount > limit) {
          setAlertMessage(`The current query contains too many rows to copy (limit: ${limit.toLocaleString()}).`)
          return
        }
        try {
          const values: string[] = []
          const pageLength = 250
          while (values.length < limit) {
            const result = await queryRecords(tableName, {
              filter: { ...rq.filter.baseFilter, skip: values.length, limit: Math.min(pageLength, limit - values.length) },
              joins: rq.joins,
              ...(tableVariant ? { tableVariant } : {}),
            })
            values.push(...result.records.map((record) => String(record.displayValues?.[name] ?? record.values[name] ?? '')))
            if (result.records.length < pageLength) break
          }
          if (values.length === limit && (rq.pagination.totalCount === null || rq.pagination.totalCount > limit)) {
            setAlertMessage(`The current query contains too many rows to copy (limit: ${limit.toLocaleString()}).`)
            return
          }
          if (values.length === 0) {
            setAlertMessage(`There are no ${label} values to copy.`)
            return
          }
          await navigator.clipboard.writeText(`${values.join('\n')}\n`)
          setAlertMessage(`Copied ${values.length.toLocaleString()} ${label} values.`)
        } catch {
          setAlertMessage(`Could not copy ${label} values.`)
        }
      })()
    },
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableName) })
  }

  /**
   * Launches a process with the current selection, as Material does: all/first-N selections send
   * the query filter (no page skip; the subset size as the limit), row selections send the ids.
   */
  const launchProcess = useCallback((process: QProcessMetaData) => {
    const params = new URLSearchParams()
    if (rq.selection.selectionFilter) {
      params.set('recordsParam', 'filterJSON')
      params.set('filterJSON', JSON.stringify(rq.selection.selectionFilter))
    } else if (rq.selection.selectedRecordIds.length > 0) {
      params.set('recordsParam', 'recordIds')
      params.set('recordIds', rq.selection.selectedRecordIds.join(','))
    }
    // a process added to every screen reads the selection from this table
    const forTable = launchTableName(process, tableName)
    if (forTable) params.set('tableName', forTable)
    // the run comes back to this query (filter, sort and page kept), as Material's modal does
    params.set('returnTo', `${window.location.pathname}${window.location.search}`)
    router.push(withTrailingSlash(`/app/${encodeURIComponent(process.name)}?${params.toString()}`))
  }, [router, tableName, rq.selection.selectionFilter, rq.selection.selectedRecordIds])

  const openAdvancedFilters = useCallback(() => {
    rq.filter.setFilterMode('advanced')
    if (typeof window !== 'undefined' && window.innerWidth < 768) setMobileFilterOpen(true)
    else if (!rq.filter.filterPanelOpen) rq.filter.toggleFilterPanel()
  }, [rq, setMobileFilterOpen])

  // A new page or page size starts at the top of the page (Material RecordQuery)
  const pageKey = `${rq.pagination.pageNum}:${rq.pagination.pageSize}`
  const shownPageKey = useRef(pageKey)
  useEffect(() => {
    if (shownPageKey.current === pageKey) return
    shownPageKey.current = pageKey
    scrollPageToTop()
  }, [pageKey])
  const handleFilterToggle = useCallback(() => {
    if (rq.filter.filterMode === 'basic') {
      openAdvancedFilters()
    } else if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileFilterOpen((open) => !open)
    } else {
      rq.filter.toggleFilterPanel()
    }
  }, [rq, openAdvancedFilters, setMobileFilterOpen])

  // Material query-screen shortcuts: n new record, r refresh the query, f open the filter builder.
  usePageShortcuts({
    n: canCreate && (() => router.push(`/app/${encodeURIComponent(tableName)}/create`)),
    r: handleRefresh,
    f: () => {
      if (rq.filter.filterMode === 'basic' || (!rq.filter.filterPanelOpen && !mobileFilterOpen)) handleFilterToggle()
    },
  }, Boolean(tableMetaData.readPermission))

  const pageRowCount = rq.data.records.length
  const allPageRowsSelected = pageRowCount > 0 && rq.selection.selectionMode === 'rows' && rq.selection.selectedRecordIds.length > 0
    && rq.data.records.every((r) => rq.selection.selectedRecordIds.map(String).includes(String(r.values[tableMetaData.primaryKeyField])))
  const pageOffset = (rq.pagination.pageNum - 1) * rq.pagination.pageSize
  const { selectionMode, subsetSize } = rq.selection
  const coveredByQuery = useCallback(
    (index: number) => selectionMode === 'all' || (selectionMode === 'subset' && pageOffset + index < (subsetSize ?? 0)),
    [selectionMode, pageOffset, subsetSize]
  )
  const isRowSelectedByQuery = selectionMode === 'rows' ? undefined : coveredByQuery

  if (!tableMetaData.readPermission) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive" data-qqq-id="query-no-permission">
        You do not have permission to view {tableMetaData.label} records.
      </div>
    )
  }

  return (
    <FilterSettingsProvider value={filterSettings}>
    <div className="flex flex-col space-y-6" data-qqq-id={`record-query-${tableName}`} data-view-mode={viewModeReady ? viewMode : undefined}>
      {safeFromPath && (
        <Link href={safeFromPath} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground" data-qqq-id="link-back-to-source">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {fromLabel || 'previous page'}
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2" data-qqq-id="query-heading">
        <h1 className="text-xl font-semibold text-foreground">{tableMetaData.label}{currentView ? ` / ${currentView.label}` : ''}</h1>
        {joinedLabels.length > 0 && (
          <button type="button" className="rounded p-1 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={`Joined with ${joinedLabels.join(', ')}`}
            title={`Results from ${tableMetaData.label} joined with ${joinedLabels.join(', ')}`}
            data-qqq-id="query-joins-help">
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {viewWarnings.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100" data-qqq-id="query-view-warning">
          {viewWarnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      {rq.filter.hasVariables && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100" data-qqq-id="query-variable-warning">
          {MISSING_FILTER_VARIABLE_MESSAGE}
        </div>
      )}

      {savedViewId !== undefined && savedViewQuery.isError && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" data-qqq-id="saved-view-load-error">
          There was an error loading the selected view: {savedViewQuery.error instanceof Error ? savedViewQuery.error.message : 'unknown error'}
        </div>
      )}

      {rq.data.countError && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" data-qqq-id="query-count-error">
          {getErrorStatusCode(rq.data.countError) === 403
            ? 'You do not have permission to view these records.'
            : 'Failed to count records.'}
        </div>
      )}

      {alertMessage && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100" data-qqq-id="query-alert">
          <span>{alertMessage}</span>
          <button type="button" onClick={() => setAlertMessage(null)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-ring dark:hover:bg-amber-900">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <RecordQueryToolbar
        tableName={tableName}
        tableMetaData={tableMetaData}
        processes={processes}
        canCreate={canCreate}
        handleCreateRecord={() => router.push(`/app/${tableName}/create`)}
        localSearchTerm={localSearchTerm}
        quickSearchRef={quickSearchRef}
        filterButtonRef={filterButtonRef}
        handleSearchChange={handleSearchChange}
        setLocalSearchTerm={setLocalSearchTerm}
        clearQuickSearch={() => rq.filter.setQuickSearch('')}
        filterPanelOpen={rq.filter.filterMode === 'advanced' && rq.filter.filterPanelOpen}
        mobileFilterOpen={mobileFilterOpen}
        activeFilterCount={activeFilterCount}
        handleFilterToggle={handleFilterToggle}
        allProcesses={allProcesses}
        selectionCount={rq.selection.selectionCount}
        onLaunchProcess={launchProcess}
        onProcessBlocked={setAlertMessage}
        exportFilter={rq.filter.baseFilter}
        exportColumns={exportColumns}
        totalCount={rq.pagination.totalCount}
        tableVariant={tableVariant}
        savedViewsMenu={
          <SavedViewsMenu
            savedViews={savedViews}
            currentView={currentView}
            viewDiffs={viewDiffs}
            onSelectView={openSavedView}
            onNewView={openNewView}
            onStore={storeView}
            onDelete={deleteView}
            reportHref={reportHref}
          />
        }
        selectionMenu={
          <SelectionMenu
            pageRowCount={pageRowCount}
            matchingCount={matchingCount}
            distinct={distinct}
            onSelectPage={() => rq.selection.setRowSelection(Object.fromEntries(rq.data.records
              .map((r) => r.values[tableMetaData.primaryKeyField]).filter((id) => id != null).map((id) => [String(id), true])))}
            onSelectMode={rq.selection.setSelectionMode}
            onClear={rq.selection.clearRowSelection}
          />
        }
        columnVisibility={rq.columns.columnVisibility}
        columnOrder={rq.columns.columnOrder}
        columnPins={rq.columns.columnPins}
        visibleColumnCount={exportColumns.length}
        columnsState={columnsState}
        columnConfigOpen={rq.columns.columnConfigOpen}
        toggleColumnConfig={rq.columns.toggleColumnConfig}
        setColumnConfigOpen={rq.columns.setColumnConfigOpen}
        setColumnVisibility={rq.columns.setColumnVisibility}
        setColumnOrder={rq.columns.setColumnOrder}
        density={rq.density}
        setDensity={rq.setDensity}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isFetching={rq.data.isFetching}
        handleRefresh={handleRefresh}
        selectedVariantId={tableVariant?.id ?? null}
        selectedVariantLabel={tableVariant?.name ?? null}
        onVariantChipClick={tableMetaData.usesVariants ? () => setVariantPickerOpen(true) : undefined}
      />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter mode" data-qqq-id="query-filter-mode">
        <HintTooltip content={basicModeCheck.reasons.join(' ')} data-qqq-id="basic-mode-reasons">
          <button type="button" aria-pressed={rq.filter.filterMode === 'basic'}
            aria-disabled={!basicModeCheck.canWorkAsBasic}
            onClick={() => { if (basicModeCheck.canWorkAsBasic) rq.filter.setFilterMode('basic') }}
            className="min-h-11 rounded border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id="button-filter-basic">Basic</button>
        </HintTooltip>
        <button type="button" aria-pressed={rq.filter.filterMode === 'advanced'}
          onClick={openAdvancedFilters}
          className="min-h-11 rounded border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id="button-filter-advanced">Advanced</button>
        <div className="flex items-center gap-1">
          <label htmlFor={`query-sort-${tableName}`} className="text-sm text-muted-foreground">Sort:</label>
          <select id={`query-sort-${tableName}`} aria-label="Sort field"
            value={rq.filter.sortOrder[0]?.fieldName ?? ''}
            onChange={(event) => rq.filter.setSort([{ fieldName: event.target.value, isAscending: rq.filter.sortOrder[0]?.isAscending ?? false }])}
            className="min-h-11 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id="query-sort-field">
            {availableFilterFields.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}
          </select>
          <button type="button" aria-label={rq.filter.sortOrder[0]?.isAscending ? 'Sort descending' : 'Sort ascending'}
            onClick={() => rq.filter.setSort([{ fieldName: rq.filter.sortOrder[0]?.fieldName ?? tableMetaData.primaryKeyField, isAscending: !rq.filter.sortOrder[0]?.isAscending }])}
            className="min-h-11 rounded border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id="query-sort-direction">{rq.filter.sortOrder[0]?.isAscending ? '↑' : '↓'}</button>
        </div>
        {(activeFilterCount > 0 || rq.filter.quickSearchTerm) && (
          <button type="button" onClick={() => setClearConfirmOpen(true)}
            className="min-h-11 rounded px-2 text-sm text-muted-foreground underline focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id="query-clear-all">Clear all filters</button>
        )}
      </div>

      <AlertDialogPrimitive.Root open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-lg">
            <AlertDialogPrimitive.Title className="text-lg font-semibold">Clear all filters?</AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">This removes all conditions and quick search. Your sort order stays in place.</AlertDialogPrimitive.Description>
            <div className="mt-5 flex justify-end gap-3">
              <AlertDialogPrimitive.Cancel className="min-h-11 rounded border border-input px-4 text-sm">Cancel</AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action onClick={() => { setLocalSearchTerm(''); rq.filter.resetFilter() }}
                className="min-h-11 rounded bg-destructive px-4 text-sm text-destructive-foreground">Clear filters</AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>

      {rq.filter.filterMode === 'basic' && (
        <QuickFilterBar fields={quickFilterFields} allFields={availableFilterFields}
          defaultFieldNames={rq.filter.defaultQuickFilterFieldNames}
          customFieldNames={rq.filter.quickFilterFieldNames}
          filter={rq.filter.userFilter} onChange={rq.filter.setUserFilter}
          onCustomFieldsChange={rq.filter.setQuickFilterFieldNames}
          onOpenAdvanced={openAdvancedFilters} />
      )}

      {rq.filter.filterMode === 'advanced' && (
        <AdvancedQueryPreview filter={rq.filter.userFilter} fields={availableFilterFields} onChange={rq.filter.setUserFilter} />
      )}

      <QuickSavedViews tableMetaData={tableMetaData} quickViews={savedViews.quickViews} currentView={currentView}
        isModified={viewDiffs.length > 0} tableVariant={tableVariant} canCount={rq.data.canCount && !rq.data.needsVariant}
        onSelect={openSavedView} />

      {rq.filter.filterMode === 'advanced' && rq.filter.filterPanelOpen && (
        <div className="hidden rounded-xl border border-primary/20 bg-primary/5 md:block">
          <div className="flex items-center justify-between border-b border-primary/20 px-4 py-2">
            <span className="text-base font-semibold text-primary">Advanced Filters</span>
            <button type="button" onClick={rq.filter.toggleFilterPanel}
              className="text-primary hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring" aria-label="Close filter panel" data-qqq-id="filter-panel-close">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <FilterBuilder tableMetaData={tableMetaData} filter={rq.filter.userFilter} onChange={rq.filter.setUserFilter} onClose={rq.filter.toggleFilterPanel} onClear={() => setClearConfirmOpen(true)} />
        </div>
      )}

      {/* Phone filter sheet: a modal dialog (focus moves in, Escape closes, focus returns to Filter) */}
      <DialogPrimitive.Root open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <DialogPrimitive.Portal>
          <div className="md:hidden" data-qqq-id="mobile-filter-sheet">
            <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
            <DialogPrimitive.Content aria-describedby={undefined}
              onCloseAutoFocus={(e) => { e.preventDefault(); filterButtonRef.current?.focus() }}
              className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85dvh] flex-col rounded-t-xl border-t border-border bg-card shadow-sm focus:outline-none">
              <div className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-muted-foreground/30" aria-hidden="true" />
              <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                <DialogPrimitive.Title className="text-base font-semibold text-foreground">Advanced Filters</DialogPrimitive.Title>
                <DialogPrimitive.Close
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Close filter panel" data-qqq-id="mobile-filter-close">
                  <X className="h-5 w-5" aria-hidden="true" />
                </DialogPrimitive.Close>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-qqq-id="mobile-filter-body">
                <FilterBuilder tableMetaData={tableMetaData} filter={rq.filter.userFilter} onChange={rq.filter.setUserFilter} onClose={() => setMobileFilterOpen(false)} onClear={() => setClearConfirmOpen(true)} />
              </div>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <RecordQueryBulkBar
        tableMetaData={tableMetaData}
        allProcesses={allProcesses}
        selectionMode={rq.selection.selectionMode}
        selectionCount={rq.selection.selectionCount}
        pageRowCount={pageRowCount}
        allPageRowsSelected={allPageRowsSelected}
        distinct={distinct}
        onClearSelection={rq.selection.clearRowSelection}
        onLaunch={launchProcess}
      />

      {!rq.data.canQuery ? (
        <div role="status" className="rounded-xl border border-border bg-muted px-4 py-6 text-center text-sm text-muted-foreground" data-qqq-id="query-not-supported">
          {tableMetaData.label} records cannot be queried.
        </div>
      ) : rq.data.needsVariant ? (
        <div role="status" className="rounded-xl border border-border bg-muted px-4 py-6 text-center text-sm text-muted-foreground" data-qqq-id="query-needs-variant">
          <p>Select a {tableMetaData.variantTableLabel} to view {tableMetaData.label} records.</p>
          <button type="button" onClick={() => setVariantPickerOpen(true)} data-qqq-id="button-choose-variant"
            className="mt-3 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring">
            Select {tableMetaData.variantTableLabel}
          </button>
        </div>
      ) : viewLoading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" data-qqq-id="saved-view-loading">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading saved view...
        </div>
      ) : (
        <RecordQueryContent
          tableName={tableName}
          tableMetaData={tableMetaData}
          viewMode={viewMode}
          activeFilterCount={activeFilterCount}
          records={rq.data.records}
          isLoading={rq.data.isLoading}
          isFetching={rq.data.isFetching}
          isError={rq.data.isError}
          error={rq.data.error}
          sortOrder={rq.filter.sortOrder}
          onSortChange={rq.filter.setSort}
          onResetFilter={() => { setLocalSearchTerm(''); rq.filter.resetFilter() }}
          quickSearchTerm={rq.filter.quickSearchTerm}
          rowSelection={rq.selection.rowSelection}
          onRowSelectionChange={rq.selection.setRowSelection}
          isRowSelectedByQuery={isRowSelectedByQuery}
          onColumnStats={canShowStats ? openColumnStats : undefined}
          columnVisibility={rq.columns.columnVisibility}
          columnOrder={rq.columns.columnOrder}
          columnWidths={rq.columns.columnWidths}
          columnPins={rq.columns.columnPins}
          columnMenu={columnMenu}
          filteredColumns={filteredColumns}
          onShowFilter={columnMenu.onFilter}
          isCounting={rq.pagination.isCounting}
          onColumnWidthChange={rq.columns.setColumnWidth}
          density={rq.density}
          pageNum={rq.pagination.pageNum}
          pageSize={rq.pagination.pageSize as PageSize}
          totalCount={rq.pagination.totalCount}
          distinctCount={rq.pagination.distinctCount}
          totalPages={rq.pagination.totalPages}
          onPageChange={rq.pagination.setPage}
          onPageSizeChange={rq.pagination.setPageSize}
        />
      )}

      {canShowStats && (
        <ColumnStatsDialog
          tableName={tableName}
          fieldName={statsColumn?.name ?? null}
          fieldLabel={statsColumn?.label ?? ''}
          filter={rq.filter.baseFilter}
          onClose={() => setStatsColumn(null)}
        />
      )}

      {/* A table that can be read by key but not queried: Material opens Go To, and it cannot be dismissed */}
      {!rq.data.canQuery && hasCapability(tableMetaData, 'TABLE_GET') && (!tableMetaData.usesVariants || (tableVariant && !variantPickerOpen)) && (
        <GotoRecordDialog open mayClose={false} tableMetaData={tableMetaData} tableVariant={tableVariant}
          onChangeVariant={tableMetaData.usesVariants ? () => setVariantPickerOpen(true) : undefined} onClose={() => undefined} />
      )}

      {tableMetaData.usesVariants && (
        <VariantPicker
          open={variantPickerOpen}
          tableName={tableName}
          variantTableLabel={tableMetaData.variantTableLabel}
          selected={tableVariant}
          onCancel={() => setVariantPickerOpen(false)}
          onSelect={chooseVariant}
        />
      )}
    </div>
    </FilterSettingsProvider>
  )
}
