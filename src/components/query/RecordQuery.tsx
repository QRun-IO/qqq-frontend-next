/** RecordQuery — orchestrator page component for the record query page. Brings together DataGrid, FilterBuilder, Pagination, ColumnConfig, BulkActionBar, and more. */
'use client'

// RecordQuery — orchestrator page component for the record query page
// Brings together DataGrid, FilterBuilder, Pagination, ColumnConfig, BulkActionBar, etc.

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus,
  Columns,
  Search,
  X,
  ChevronDown,
  RefreshCw,
  Filter,
  LayoutList,
  LayoutGrid,
  Table2,
  ArrowLeft,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import type { QTableMetaData, QProcessMetaData } from '@/types'
import { useRecordQuery } from '@/lib/hooks/use-record-query'
import type { Density, PageSize } from '@/lib/hooks/use-record-query'
import { countActiveCriteria } from '@/lib/utils/filter-utils'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { queryKeys } from '@/lib/query-client'
import { useUserPreferences } from '@/lib/hooks/use-user-preferences'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'

import { DataGrid } from './DataGrid'
import { FilterBuilder } from './FilterBuilder'
import { Pagination } from './Pagination'
import { ColumnConfig } from './ColumnConfig'
import { BulkActionBar } from './BulkActionBar'
import { SavedViewsMenu } from './SavedViewsMenu'
import { ExportButton } from './ExportButton'
import { ProcessLauncherMenu } from './ProcessLauncherMenu'
import { RecordCardView } from './RecordCardView'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'

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
  /** Optional list of processes that can be launched from this table's toolbar or bulk action bar. */
  processes?: QProcessMetaData[]
}

// ─── Toolbar subcomponents ────────────────────────────────────────────────────

/** Static list of available row density options presented in the DensitySelector dropdown. */
const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'comfortable', label: 'Comfortable' },
]

/**
 * Toolbar button that opens a listbox for selecting the row density of the data grid.
 *
 * @param density - The currently active density value.
 * @param onSelect - Callback invoked when the user picks a new density option.
 */
function DensitySelector({
  density,
  onSelect,
}: {
  density: Density
  onSelect: (d: Density) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Select display density"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-qqq-id="button-density"
      >
        <LayoutList className="h-4 w-4" aria-hidden="true" />
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-border bg-popover shadow-sm"
            role="listbox"
            aria-label="Display density"
          >
            {DENSITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={density === opt.value}
                onClick={() => {
                  onSelect(opt.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring ${
                  density === opt.value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-popover-foreground hover:bg-accent'
                }`}
                data-qqq-id={`density-option-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Paired toggle buttons for switching between the tabular grid view and the card view.
 *
 * @param viewMode - The currently active view mode.
 * @param onChange - Callback invoked when the user selects a different view mode.
 */
function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <div className="flex items-center rounded border border-input" data-qqq-id="view-mode-toggle">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`flex h-8 w-8 items-center justify-center rounded-l transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
          viewMode === 'grid'
            ? 'bg-primary/10 text-primary'
            : 'bg-background text-muted-foreground hover:bg-accent'
        }`}
        aria-label="Table view"
        aria-pressed={viewMode === 'grid'}
        data-qqq-id="view-mode-grid"
      >
        <Table2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onChange('card')}
        className={`flex h-8 w-8 items-center justify-center rounded-r border-l border-input transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
          viewMode === 'card'
            ? 'bg-primary/10 text-primary'
            : 'bg-background text-muted-foreground hover:bg-accent'
        }`}
        aria-label="Card view"
        aria-pressed={viewMode === 'card'}
        data-qqq-id="view-mode-card"
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Full-page record query component for a QQQ table.
 *
 * Composes the toolbar (search, filter toggle, column config, density, view mode, export,
 * saved views, process launcher, refresh), inline/mobile filter panels, bulk action bar,
 * error/empty states, DataGrid or RecordCardView, and Pagination.
 *
 * @param tableName - Backend table name used in API routes and URLs.
 * @param tableMetaData - Table metadata describing fields, permissions, and labels.
 * @param processes - Optional processes available for bulk actions or toolbar launch.
 */
export function RecordQuery({ tableName, tableMetaData, processes }: RecordQueryProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPath = searchParams.get('from')
  const fromLabel = searchParams.get('fromLabel')
  // MED-6: only allow same-origin paths to prevent open redirect
  const safeFromPath = fromPath?.startsWith('/') ? fromPath : null
  const queryClient = useQueryClient()
  const quickSearchRef = useRef<HTMLInputElement>(null)
  const { preferences } = useUserPreferences()

  const rq = useRecordQuery({
    tableName,
    tableMetaData,
    initialPageSize: preferences.tableDefaultPageSize,
  })

  // Debounced quick search
  const [localSearchTerm, setLocalSearchTerm] = useState(rq.filter.quickSearchTerm)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Updates local search term immediately for a responsive input feel, then debounces
   * the propagation to the query hook to avoid firing an API request on every keystroke.
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

  const canCreate = tableMetaData.insertPermission

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
      <div className="flex flex-wrap items-center gap-2">
        {/* Create button */}
        {canCreate && (
          <button
            type="button"
            onClick={handleCreateRecord}
            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            aria-label={`Create new ${tableMetaData.label} record`}
            data-qqq-id="button-create"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create
          </button>
        )}

        {/* Quick search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <label htmlFor="quick-search" className="sr-only">
            Search {tableMetaData.label}
          </label>
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={quickSearchRef}
            id="quick-search"
            type="search"
            value={localSearchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={`Search ${tableMetaData.label}...`}
            className="w-full rounded border border-input bg-background py-1.5 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={`Quick search ${tableMetaData.label}`}
            data-qqq-id="quick-search"
          />
          {localSearchTerm && (
            <button
              type="button"
              onClick={() => {
                setLocalSearchTerm('')
                rq.filter.setQuickSearch('')
                quickSearchRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label="Clear search"
              data-qqq-id="quick-search-clear"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Advanced filter toggle */}
        <button
          type="button"
          onClick={handleFilterToggle}
          className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
            rq.filter.filterPanelOpen || mobileFilterOpen || activeFilterCount > 0
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input bg-background text-foreground hover:bg-accent'
          }`}
          aria-label="Toggle advanced filter panel"
          aria-expanded={rq.filter.filterPanelOpen || mobileFilterOpen}
          data-qqq-id="button-filter"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Process launcher */}
        {processes && processes.length > 0 && (
          <ProcessLauncherMenu
            processes={processes}
            selectedRecordIds={rq.selection.selectedRecordIds}
            tableName={tableName}
            currentFilter={rq.filter.effectiveFilter}
          />
        )}

        {/* Saved views */}
        <SavedViewsMenu
          savedViews={rq.views.list}
          onSave={rq.views.saveView}
          onLoad={rq.views.loadView}
          onDelete={rq.views.deleteView}
        />

        {/* Export */}
        <ExportButton
          tableName={tableName}
          tableMetaData={tableMetaData}
          currentFilter={rq.filter.effectiveFilter}
          columnVisibility={rq.columns.columnVisibility}
          columnOrder={rq.columns.columnOrder}
          selectedRecordIds={rq.selection.selectedRecordIds}
        />

        {/* View mode toggle: grid / card */}
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />

        {/* Density selector */}
        <DensitySelector density={rq.density} onSelect={rq.setDensity} />

        {/* Column config toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={rq.columns.toggleColumnConfig}
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
              rq.columns.columnConfigOpen
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background text-foreground hover:bg-accent'
            }`}
            aria-label="Configure columns"
            aria-expanded={rq.columns.columnConfigOpen}
            data-qqq-id="button-column-config"
          >
            <Columns className="h-4 w-4" aria-hidden="true" />
          </button>

          {rq.columns.columnConfigOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => rq.columns.setColumnConfigOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 z-20 mt-1">
                <ColumnConfig
                  tableMetaData={tableMetaData}
                  columnVisibility={rq.columns.columnVisibility}
                  columnOrder={rq.columns.columnOrder}
                  onVisibilityChange={rq.columns.setColumnVisibility}
                  onOrderChange={rq.columns.setColumnOrder}
                  onClose={() => rq.columns.setColumnConfigOpen(false)}
                />
              </div>
            </>
          )}
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={handleRefresh}
          className="flex h-8 w-8 items-center justify-center rounded border border-input bg-background text-muted-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Refresh data"
          data-qqq-id="button-refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${rq.data.isFetching ? 'animate-spin text-primary' : ''}`}
            aria-hidden="true"
          />
        </button>

      </div>

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
      <BulkActionBar
        tableMetaData={tableMetaData}
        selectedCount={rq.selection.selectedRecordIds.length}
        totalCount={rq.pagination.totalCount}
        onClearSelection={rq.selection.clearRowSelection}
        onRunProcess={processes && processes.length > 0 ? handleRunProcess : undefined}
        processes={processes}
        selectedRecordIds={rq.selection.selectedRecordIds}
        currentFilter={rq.filter.effectiveFilter}
      />

      {/* ============================================================
          Error state
      ============================================================ */}
      {rq.data.isError && (
        <div
          className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
          data-qqq-id="grid-error"
        >
          <p className="font-medium">
            {getErrorStatusCode(rq.data.error) === 403
              ? 'You do not have permission to view these records.'
              : getErrorStatusCode(rq.data.error) === 404
                ? 'This table could not be found.'
                : 'Failed to load records.'}
          </p>
          <p className="mt-1 text-xs">
            {rq.data.error instanceof Error ? rq.data.error.message : 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableName) })}
            className="mt-2 text-xs underline hover:text-red-900 focus:outline-none"
            data-qqq-id="button-retry"
          >
            Retry
          </button>
        </div>
      )}

      {/* ============================================================
          Empty State (zero results, not loading, no error)
      ============================================================ */}
      {!rq.data.isLoading && !rq.data.isError && rq.data.records.length === 0 && (
        <EmptyState
          title="No records found"
          description="Try adjusting your filters or search term."
          action={
            activeFilterCount > 0 || rq.filter.quickSearchTerm
              ? { label: 'Clear Filters', onClick: rq.filter.resetFilter }
              : undefined
          }
        />
      )}

      {/* ============================================================
          Data Grid / Card View
      ============================================================ */}
      {(rq.data.isLoading || rq.data.records.length > 0) && (
      <ErrorBoundary className="rounded-xl">
      <div className="overflow-hidden rounded-xl border border-border">
        {/* DataGrid: shown when viewMode is 'grid' */}
        {viewMode === 'grid' && (
          <DataGrid
            tableName={tableName}
            tableMetaData={tableMetaData}
            records={rq.data.records}
            totalCount={rq.pagination.totalCount}
            isLoading={rq.data.isLoading}
            isFetching={rq.data.isFetching}
            sortOrder={rq.filter.sortOrder}
            onSortChange={rq.filter.setSort}
            rowSelection={rq.selection.rowSelection}
            onRowSelectionChange={rq.selection.setRowSelection}
            columnVisibility={rq.columns.columnVisibility}
            columnOrder={rq.columns.columnOrder}
            columnWidths={rq.columns.columnWidths}
            onColumnWidthChange={rq.columns.setColumnWidth}
            density={rq.density}
            pageSize={rq.pagination.pageSize}
            onResetFilter={rq.filter.resetFilter}
          />
        )}

        {/* Card view: shown when viewMode is 'card' */}
        {viewMode === 'card' && (
          <div className="p-3">
            <RecordCardView
              tableName={tableName}
              tableMetaData={tableMetaData}
              records={rq.data.records}
              rowSelection={rq.selection.rowSelection}
              onRowSelectionChange={rq.selection.setRowSelection}
              columnVisibility={rq.columns.columnVisibility}
              columnOrder={rq.columns.columnOrder}
            />
          </div>
        )}

        {/* Pagination */}
        <Pagination
          pageNum={rq.pagination.pageNum}
          pageSize={rq.pagination.pageSize as PageSize}
          totalCount={rq.pagination.totalCount}
          totalPages={rq.pagination.totalPages}
          isFetching={rq.data.isFetching}
          onPageChange={rq.pagination.setPage}
          onPageSizeChange={rq.pagination.setPageSize}
        />
      </div>
      </ErrorBoundary>
      )}
    </div>
  )
}
