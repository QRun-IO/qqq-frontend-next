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
 * @file RecordQuery — orchestrator page component for the record query page. Brings together DataGrid, FilterBuilder, Pagination, ColumnConfig, BulkActionBar, and more.
 */

'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, ArrowLeft } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import type { QTableMetaData, QProcessMetaData } from '@/types'
import { useRecordQuery } from '@/lib/hooks/use-record-query'
import type { PageSize } from '@/lib/hooks/use-record-query'
import { countActiveCriteria } from '@/lib/utils/filter-utils'
import { isSafeRedirectPath } from '@/lib/utils/string-utils'
import { queryKeys } from '@/lib/query-client'
import { useUserPreferences } from '@/lib/hooks/use-user-preferences'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'
import { canInsertRecords } from '@/lib/auth/permissions'

import { FilterBuilder } from './FilterBuilder'
import { RecordQueryToolbar } from './RecordQueryToolbar'
import { RecordQueryBulkBar } from './RecordQueryBulkBar'
import { RecordQueryContent } from './RecordQueryContent'
import { VariantPicker } from './VariantPicker'

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
  /** Optional list of processes that can be launched from this table's toolbar or bulk action bar. */
  processes?: QProcessMetaData[]
}

/**
 * Full-page record query component for a QQQ table.
 *
 * Composes the toolbar (search, filter toggle, column config, density, view mode, export,
 * saved views, process launcher, refresh), inline/mobile filter panels, bulk action bar,
 * error/empty states, DataGrid or RecordCardView, and Pagination.
 *
 * @param props - Component properties.
 * @returns A composed page that assembles:
 *   - `RecordQueryToolbar` (search, filter toggle, column config, density, view mode, export,
 *     saved views, process launcher, refresh button)
 *   - An inline `FilterBuilder` panel (desktop) and a modal bottom-sheet (mobile)
 *   - `RecordQueryBulkBar` (selection count + bulk-process actions, visible when rows are selected)
 *   - `RecordQueryContent` (DataGrid or RecordCardView based on `viewMode`, plus Pagination)
 *   - `VariantPicker` dialog when the table requires a variant selection before querying
 */
export function RecordQuery({ tableName, tableMetaData, allTables, processes }: RecordQueryProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPath = searchParams.get('from')
  const fromLabel = searchParams.get('fromLabel')
  // MED-6: only allow same-origin paths to prevent open redirect (rejects //evil.com protocol-relative URLs)
  const safeFromPath = fromPath && isSafeRedirectPath(fromPath) ? fromPath : null
  const queryClient = useQueryClient()
  const quickSearchRef = useRef<HTMLInputElement>(null)
  const { preferences } = useUserPreferences()

  const rq = useRecordQuery({
    tableName,
    tableMetaData,
    allTables,
    initialPageSize: preferences.tableDefaultPageSize,
  })

  // Debounced quick search
  const [localSearchTerm, setLocalSearchTerm] = useState(rq.filter.quickSearchTerm)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Updates local state immediately so the search input feels responsive, then
   * debounces propagation to the query hook by {@link SEARCH_DEBOUNCE_MS} (300 ms)
   * to reduce API traffic during fast typing. The timer is cleared on each
   * invocation and on component unmount to prevent stale requests.
   *
   * @param value - The current value of the quick-search input.
   */
  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      rq.filter.setQuickSearch(value)
    }, SEARCH_DEBOUNCE_MS)
  }
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  const activeFilterCount = countActiveCriteria(rq.filter.userFilter)

  // View mode: grid vs card — default from user preferences; MED-7: apply mobile
  // override in useEffect (not useState) to avoid SSR/client hydration mismatch
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.tableDefaultViewMode)
  useEffect(() => {
    if (window.innerWidth < 768) setViewMode('card')
    // intentional: runs once on mount to apply mobile breakpoint
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mobile filter bottom-sheet state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  // Variant state — CRIT-15: tables with usesVariants require a variant selection
  const [variantId, setVariantId] = useState<string | number | null>(null)
  const [variantLabel, setVariantLabel] = useState<string | null>(null)
  const [variantPickerOpen, setVariantPickerOpen] = useState(
    // Auto-open on mount when the table requires a variant and none is selected
    tableMetaData.usesVariants
  )

  const canCreate = canInsertRecords(tableMetaData)

  /**
   * Navigates to the create-record route for the current table.
   */
  const handleCreateRecord = () => {
    router.push(`/app/${tableName}/create`)
  }

  /**
   * Invalidates the TanStack Query cache for this table's records, triggering a fresh fetch.
   */
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableName) })
  }

  /**
   * Builds the process URL with selected record IDs as query parameters and navigates to it.
   * Called from both the toolbar ProcessLauncherMenu and the BulkActionBar.
   *
   * @param processName - The backend process name to navigate to.
   */
  // Handle process navigation from the bulk action bar
  const handleRunProcess = useCallback(
    (processName: string) => {
      const params = new URLSearchParams()
      if (rq.selection.selectedRecordIds.length > 0) {
        params.set('recordsParam', 'recordIds')
        params.set('recordIds', rq.selection.selectedRecordIds.join(','))
      }
      const queryString = params.toString()
      router.push(`/app/${encodeURIComponent(processName)}${queryString ? `?${queryString}` : ''}`)
    },
    [router, rq.selection.selectedRecordIds]
  )

  /**
   * Toggles the advanced filter panel.
   *
   * On viewports below the `md` breakpoint the mobile bottom-sheet is opened instead of
   * the inline desktop panel, avoiding layout issues on small screens.
   */
  // Desktop filter toggle also opens mobile bottom-sheet on small screens
  const handleFilterToggle = useCallback(() => {
    // On mobile (below md), use bottom-sheet; on desktop, use inline panel
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileFilterOpen((o) => !o)
    } else {
      rq.filter.toggleFilterPanel()
    }
  }, [rq])

  return (
    <div className="flex flex-col space-y-6" data-qqq-id={`record-query-${tableName}`}>
      {/* Back link — shown when navigated from another record (e.g., "View All" related records) */}
      {safeFromPath && (
        <Link
          href={safeFromPath}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-qqq-id="link-back-to-source"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {fromLabel || 'previous page'}
        </Link>
      )}

      {/* ============================================================
          Toolbar
      ============================================================ */}
      <RecordQueryToolbar
        tableName={tableName}
        tableMetaData={tableMetaData}
        processes={processes}
        canCreate={canCreate}
        handleCreateRecord={handleCreateRecord}
        localSearchTerm={localSearchTerm}
        quickSearchRef={quickSearchRef}
        handleSearchChange={handleSearchChange}
        setLocalSearchTerm={setLocalSearchTerm}
        clearQuickSearch={() => rq.filter.setQuickSearch('')}
        filterPanelOpen={rq.filter.filterPanelOpen}
        mobileFilterOpen={mobileFilterOpen}
        activeFilterCount={activeFilterCount}
        handleFilterToggle={handleFilterToggle}
        selectedRecordIds={rq.selection.selectedRecordIds}
        effectiveFilter={rq.filter.effectiveFilter}
        savedViews={rq.views.list}
        onSaveView={rq.views.saveView}
        onLoadView={rq.views.loadView}
        onDeleteView={rq.views.deleteView}
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
        selectedVariantId={variantId}
        selectedVariantLabel={variantLabel}
        onVariantChipClick={tableMetaData.usesVariants ? () => setVariantPickerOpen(true) : undefined}
      />

      {/* ============================================================
          Filter Panel (advanced) — desktop inline
      ============================================================ */}
      {rq.filter.filterPanelOpen && (
        <div className="hidden md:block rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between border-b border-primary/20 px-4 py-2">
            <span className="text-base font-semibold text-primary">
              Advanced Filters
            </span>
            <button
              type="button"
              onClick={rq.filter.toggleFilterPanel}
              className="text-primary hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Close filter panel"
              data-qqq-id="filter-panel-close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <FilterBuilder
            tableMetaData={tableMetaData}
            filter={rq.filter.userFilter}
            onChange={(f) => rq.filter.setUserFilter(f)}
            onClose={rq.filter.toggleFilterPanel}
          />
        </div>
      )}

      {/* ============================================================
          Filter Panel — mobile bottom-sheet overlay
      ============================================================ */}
      {mobileFilterOpen && (
        <div className="md:hidden" data-qqq-id="mobile-filter-sheet">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileFilterOpen(false)}
            aria-hidden="true"
          />
          {/* Bottom sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-border bg-card shadow-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Filter panel"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-base font-semibold text-foreground">
                Advanced Filters
              </span>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Close filter panel"
                data-qqq-id="mobile-filter-close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {/* Drag indicator */}
            <div className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-muted-foreground/30" aria-hidden="true" />
            <FilterBuilder
              tableMetaData={tableMetaData}
              filter={rq.filter.userFilter}
              onChange={(f) => rq.filter.setUserFilter(f)}
              onClose={() => setMobileFilterOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ============================================================
          Bulk Action Bar
      ============================================================ */}
      <RecordQueryBulkBar
        tableMetaData={tableMetaData}
        processes={processes}
        selectedRecordIds={rq.selection.selectedRecordIds}
        totalCount={rq.pagination.totalCount}
        onClearSelection={rq.selection.clearRowSelection}
        handleRunProcess={processes && processes.length > 0 ? handleRunProcess : undefined}
        effectiveFilter={rq.filter.effectiveFilter}
      />

      {/* ============================================================
          Content — error state, empty state, DataGrid/CardView, Pagination
      ============================================================ */}
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
        onResetFilter={rq.filter.resetFilter}
        quickSearchTerm={rq.filter.quickSearchTerm}
        rowSelection={rq.selection.rowSelection}
        onRowSelectionChange={rq.selection.setRowSelection}
        columnVisibility={rq.columns.columnVisibility}
        columnOrder={rq.columns.columnOrder}
        columnWidths={rq.columns.columnWidths}
        onColumnWidthChange={rq.columns.setColumnWidth}
        density={rq.density}
        pageNum={rq.pagination.pageNum}
        pageSize={rq.pagination.pageSize as PageSize}
        totalCount={rq.pagination.totalCount}
        totalPages={rq.pagination.totalPages}
        onPageChange={rq.pagination.setPage}
        onPageSizeChange={rq.pagination.setPageSize}
      />

      {/* ============================================================
          Variant Picker dialog — CRIT-15: shown when table uses variants
      ============================================================ */}
      {tableMetaData.usesVariants && (
        <VariantPicker
          open={variantPickerOpen}
          variantTableLabel={tableMetaData.variantTableLabel}
          onCancel={() => {
            // Allow closing if a variant was already selected; otherwise keep open
            if (variantId != null) {
              setVariantPickerOpen(false)
            }
          }}
          onSelect={(id, label) => {
            setVariantId(id)
            setVariantLabel(label)
            setVariantPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
