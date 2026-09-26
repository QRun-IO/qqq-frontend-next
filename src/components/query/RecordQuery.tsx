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
import { X, ArrowLeft, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import type { QTableMetaData, QProcessMetaData, QInstance } from '@/types'
import type { TableVariant } from '@/lib/api/tables'
import { useRecordQuery, hasCapability } from '@/lib/hooks/use-record-query'
import type { PageSize } from '@/lib/hooks/use-record-query'
import { useSavedViews, useSavedView } from '@/lib/hooks/use-saved-views'
import { countActiveCriteria, emptyFilter } from '@/lib/utils/filter-utils'
import { withTrailingSlash } from '@/lib/utils/material-links'
import { getQueryColumns, orderColumns } from '@/lib/utils/query-columns'
import { buildViewJson, diffViews, isColumnVisible, viewToState, type SavedView, type ViewState } from '@/lib/utils/saved-view-utils'
import { isSafeRedirectPath } from '@/lib/utils/string-utils'
import { queryKeys } from '@/lib/query-client'
import { useQContext } from '@/lib/context/q-context'
import { useUserPreferences } from '@/lib/hooks/use-user-preferences'
import { canInsertRecords } from '@/lib/auth/permissions'
import { usePageShortcuts } from '@/lib/hooks/use-page-shortcuts'
import { TABLE_VARIANT_STORAGE_KEY_ROOT, readStoredTableVariant } from '@/lib/utils/table-variant'
import { launchTableName } from '@/lib/utils/process-utils'
import { PAGE_SIZE_OPTIONS, SEARCH_DEBOUNCE_MS } from '@/lib/constants'

import { GotoRecordDialog } from '@/components/records/GotoRecordDialog'

import { FilterBuilder } from './FilterBuilder'
import { RecordQueryToolbar } from './RecordQueryToolbar'
import { RecordQueryBulkBar } from './RecordQueryBulkBar'
import { RecordQueryContent } from './RecordQueryContent'
import { SavedViewsMenu } from './SavedViewsMenu'
import { SelectionMenu } from './SelectionMenu'
import { VariantPicker } from './VariantPicker'
import { ColumnStatsDialog, COLUMN_STATS_PROCESS } from './ColumnStatsDialog'

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
export function RecordQuery({ tableName, tableMetaData, allTables, processes, metaData, savedViewId }: RecordQueryProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPath = searchParams.get('from')
  const fromLabel = searchParams.get('fromLabel')
  const safeFromPath = fromPath && isSafeRedirectPath(fromPath) ? fromPath : null
  const queryClient = useQueryClient()
  const quickSearchRef = useRef<HTMLInputElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const { preferences } = useUserPreferences()
  const { userId } = useQContext()
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
    if (first && hadUrlStateRef.current) return
    applyView(viewToState(tableMetaData, currentView.view, preferences.tableDefaultPageSize, PAGE_SIZE_OPTIONS))
  }, [currentView, applyView, tableMetaData, preferences.tableDefaultPageSize])

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
  const viewDiffs = useMemo(
    () => diffViews(tableMetaData, currentView ? currentView.view : buildViewJson(tableMetaData, defaultViewState), currentViewJson),
    [tableMetaData, currentView, defaultViewState, currentViewJson]
  )

  const openNewView = () => {
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
    if (view.id === savedViewId) {
      setLocalSearchTerm('')
      applyView(viewToState(tableMetaData, view.view, preferences.tableDefaultPageSize, PAGE_SIZE_OPTIONS))
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
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [statsColumn, setStatsColumn] = useState<{ name: string; label: string } | null>(null)
  // Column statistics need the table's QUERY_STATS capability and the columnStats process
  const statsProcess = allProcesses[COLUMN_STATS_PROCESS]
  const canShowStats = hasCapability(tableMetaData, 'QUERY_STATS') && Boolean(statsProcess) && statsProcess?.hasPermission !== false
  // Stable, so the grid's memoized rows are not re-rendered by a new handler each render
  const openColumnStats = useCallback((name: string, label: string) => setStatsColumn({ name, label }), [])

  const canCreate = canInsertRecords(tableMetaData)
  const distinct = rq.pagination.distinctCount !== null
  const matchingCount = rq.pagination.distinctCount ?? rq.pagination.totalCount

  const exportColumns = useMemo(
    () => orderColumns(getQueryColumns(tableMetaData), rq.columns.columnOrder).filter((c) => isColumnVisible(c.name, rq.columns.columnVisibility)).map((c) => c.name),
    [tableMetaData, rq.columns.columnOrder, rq.columns.columnVisibility]
  )

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

  const handleFilterToggle = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setMobileFilterOpen((o) => !o)
    else rq.filter.toggleFilterPanel()
  }, [rq])

  // Material query-screen shortcuts: n new record, r refresh the query, f open the filter builder.
  usePageShortcuts({
    n: canCreate && (() => router.push(`/app/${encodeURIComponent(tableName)}/create`)),
    r: handleRefresh,
    f: () => {
      if (!rq.filter.filterPanelOpen && !mobileFilterOpen) handleFilterToggle()
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
    <div className="flex flex-col space-y-6" data-qqq-id={`record-query-${tableName}`} data-view-mode={viewModeReady ? viewMode : undefined}>
      {safeFromPath && (
        <Link href={safeFromPath} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground" data-qqq-id="link-back-to-source">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {fromLabel || 'previous page'}
        </Link>
      )}

      {savedViewId !== undefined && savedViewQuery.isError && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" data-qqq-id="saved-view-load-error">
          There was an error loading the selected view: {savedViewQuery.error instanceof Error ? savedViewQuery.error.message : 'unknown error'}
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
        filterPanelOpen={rq.filter.filterPanelOpen}
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

      {rq.filter.filterPanelOpen && (
        <div className="hidden rounded-xl border border-primary/20 bg-primary/5 md:block">
          <div className="flex items-center justify-between border-b border-primary/20 px-4 py-2">
            <span className="text-base font-semibold text-primary">Advanced Filters</span>
            <button type="button" onClick={rq.filter.toggleFilterPanel}
              className="text-primary hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring" aria-label="Close filter panel" data-qqq-id="filter-panel-close">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <FilterBuilder tableMetaData={tableMetaData} filter={rq.filter.userFilter} onChange={rq.filter.setUserFilter} onClose={rq.filter.toggleFilterPanel} />
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
                <FilterBuilder tableMetaData={tableMetaData} filter={rq.filter.userFilter} onChange={rq.filter.setUserFilter} onClose={() => setMobileFilterOpen(false)} />
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
        <GotoRecordDialog open mayClose={false} tableMetaData={tableMetaData} tableVariant={tableVariant} onClose={() => undefined} />
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
  )
}
