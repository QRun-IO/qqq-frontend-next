'use client'

// RecordQuery — orchestrator page component for the record query page
// Brings together DataGrid, FilterBuilder, Pagination, ColumnConfig, BulkActionBar, etc.

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  SlidersHorizontal,
  Columns,
  Search,
  X,
  ChevronDown,
  RefreshCw,
  Filter,
  LayoutList,
  LayoutGrid,
  Table2,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import type { QTableMetaData, QProcessMetaData } from '@/types'
import { useRecordQuery } from '@/lib/hooks/use-record-query'
import type { Density, PageSize } from '@/lib/hooks/use-record-query'
import { countActiveCriteria } from '@/lib/utils/filter-utils'
import { queryKeys } from '@/lib/query-client'

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

type ViewMode = 'grid' | 'card'

interface RecordQueryProps {
  tableName: string
  tableMetaData: QTableMetaData
  processes?: QProcessMetaData[]
}

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'comfortable', label: 'Comfortable' },
]

export function RecordQuery({ tableName, tableMetaData, processes }: RecordQueryProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const quickSearchRef = useRef<HTMLInputElement>(null)

  const rq = useRecordQuery({ tableName, tableMetaData })

  // Debounced quick search
  const [localSearchTerm, setLocalSearchTerm] = useState(rq.quickSearchTerm)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      rq.setQuickSearch(value)
    }, 400)
  }
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  const [densityOpen, setDensityOpen] = useState(false)
  const activeFilterCount = countActiveCriteria(rq.userFilter)

  // View mode: grid vs card — default to card on mobile
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'card'
    }
    return 'grid'
  })

  // Mobile filter bottom-sheet state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const canCreate = tableMetaData.insertPermission

  const handleCreateRecord = () => {
    router.push(`/app/${tableName}/create`)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableName) })
  }

  // Handle process navigation from the bulk action bar
  const handleRunProcess = useCallback(
    (processName: string) => {
      const params = new URLSearchParams()
      if (rq.selectedRecordIds.length > 0) {
        params.set('recordsParam', 'recordIds')
        params.set('recordIds', rq.selectedRecordIds.join(','))
      }
      const queryString = params.toString()
      router.push(`/app/${encodeURIComponent(processName)}${queryString ? `?${queryString}` : ''}`)
    },
    [router, rq.selectedRecordIds]
  )

  // Desktop filter toggle also opens mobile bottom-sheet on small screens
  const handleFilterToggle = useCallback(() => {
    // On mobile (below md), use bottom-sheet; on desktop, use inline panel
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileFilterOpen((o) => !o)
    } else {
      rq.toggleFilterPanel()
    }
  }, [rq])

  return (
    <div className="flex flex-col gap-3" data-qqq-id={`record-query-${tableName}`}>
      {/* ============================================================
          Toolbar
      ============================================================ */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Create button */}
        {canCreate && (
          <button
            type="button"
            onClick={handleCreateRecord}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
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
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            ref={quickSearchRef}
            id="quick-search"
            type="search"
            value={localSearchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={`Search ${tableMetaData.label}...`}
            className="w-full rounded border border-gray-300 bg-white py-1.5 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            aria-label={`Quick search ${tableMetaData.label}`}
            data-qqq-id="quick-search"
          />
          {localSearchTerm && (
            <button
              type="button"
              onClick={() => {
                setLocalSearchTerm('')
                rq.setQuickSearch('')
                quickSearchRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
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
          className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            rq.filterPanelOpen || mobileFilterOpen || activeFilterCount > 0
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}
          aria-label="Toggle advanced filter panel"
          aria-expanded={rq.filterPanelOpen || mobileFilterOpen}
          data-qqq-id="button-filter"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">
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
            selectedRecordIds={rq.selectedRecordIds}
            tableName={tableName}
            currentFilter={rq.effectiveFilter}
          />
        )}

        {/* Saved views */}
        <SavedViewsMenu
          savedViews={rq.savedViews}
          onSave={rq.saveView}
          onLoad={rq.loadView}
          onDelete={rq.deleteView}
        />

        {/* Export */}
        <ExportButton
          tableName={tableName}
          tableMetaData={tableMetaData}
          currentFilter={rq.effectiveFilter}
          columnVisibility={rq.columnVisibility}
          columnOrder={rq.columnOrder}
          selectedRecordIds={rq.selectedRecordIds}
        />

        {/* View mode toggle: grid / card */}
        <div className="flex items-center rounded border border-gray-300 dark:border-gray-600" data-qqq-id="view-mode-toggle">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex h-8 w-8 items-center justify-center rounded-l transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              viewMode === 'grid'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400'
            }`}
            aria-label="Table view"
            aria-pressed={viewMode === 'grid'}
            data-qqq-id="view-mode-grid"
          >
            <Table2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={`flex h-8 w-8 items-center justify-center rounded-r border-l border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 ${
              viewMode === 'card'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400'
            }`}
            aria-label="Card view"
            aria-pressed={viewMode === 'card'}
            data-qqq-id="view-mode-card"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Density selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDensityOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            aria-label="Select display density"
            aria-haspopup="listbox"
            aria-expanded={densityOpen}
            data-qqq-id="button-density"
          >
            <LayoutList className="h-4 w-4" aria-hidden="true" />
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {densityOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDensityOpen(false)}
                aria-hidden="true"
              />
              <div
                className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
                role="listbox"
                aria-label="Display density"
              >
                {DENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={rq.density === opt.value}
                    onClick={() => {
                      rq.setDensity(opt.value)
                      setDensityOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      rq.density === opt.value
                        ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-950'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
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

        {/* Column config toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={rq.toggleColumnConfig}
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              rq.columnConfigOpen
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
            aria-label="Configure columns"
            aria-expanded={rq.columnConfigOpen}
            data-qqq-id="button-column-config"
          >
            <Columns className="h-4 w-4" aria-hidden="true" />
          </button>

          {rq.columnConfigOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => rq.setColumnConfigOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 z-20 mt-1">
                <ColumnConfig
                  tableMetaData={tableMetaData}
                  columnVisibility={rq.columnVisibility}
                  columnOrder={rq.columnOrder}
                  onVisibilityChange={rq.setColumnVisibility}
                  onOrderChange={rq.setColumnOrder}
                  onClose={() => rq.setColumnConfigOpen(false)}
                />
              </div>
            </>
          )}
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={handleRefresh}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
          aria-label="Refresh data"
          data-qqq-id="button-refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${rq.isFetching ? 'animate-spin text-blue-600' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* Settings / more */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
          aria-label="More options"
          data-qqq-id="button-more-options"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* ============================================================
          Filter Panel (advanced) — desktop inline
      ============================================================ */}
      {rq.filterPanelOpen && (
        <div className="hidden md:block rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-950">
          <div className="flex items-center justify-between border-b border-blue-200 px-4 py-2 dark:border-blue-700">
            <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              Advanced Filters
            </span>
            <button
              type="button"
              onClick={rq.toggleFilterPanel}
              className="text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Close filter panel"
              data-qqq-id="filter-panel-close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <FilterBuilder
            tableMetaData={tableMetaData}
            filter={rq.userFilter}
            onChange={(f) => rq.setUserFilter(f)}
            onClose={rq.toggleFilterPanel}
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
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
            role="dialog"
            aria-modal="true"
            aria-label="Filter panel"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Advanced Filters
              </span>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-800"
                aria-label="Close filter panel"
                data-qqq-id="mobile-filter-close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {/* Drag indicator */}
            <div className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
            <FilterBuilder
              tableMetaData={tableMetaData}
              filter={rq.userFilter}
              onChange={(f) => rq.setUserFilter(f)}
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
        selectedCount={rq.selectedRecordIds.length}
        totalCount={rq.totalCount}
        onClearSelection={rq.clearRowSelection}
        onRunProcess={processes && processes.length > 0 ? handleRunProcess : undefined}
        processes={processes}
        selectedRecordIds={rq.selectedRecordIds}
        currentFilter={rq.effectiveFilter}
      />

      {/* ============================================================
          Error state
      ============================================================ */}
      {rq.isError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
          role="alert"
          data-qqq-id="grid-error"
        >
          <p className="font-medium">Failed to load records</p>
          <p className="mt-1 text-xs">
            {rq.error instanceof Error ? rq.error.message : 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => rq.setPage(rq.pageNum)} // retrigger
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
      {!rq.isLoading && !rq.isError && rq.records.length === 0 && (
        <EmptyState
          title="No records found"
          description="Try adjusting your filters or search term."
          action={
            activeFilterCount > 0 || rq.quickSearchTerm
              ? { label: 'Clear Filters', onClick: rq.resetFilter }
              : undefined
          }
        />
      )}

      {/* ============================================================
          Data Grid / Card View
      ============================================================ */}
      {(rq.isLoading || rq.records.length > 0) && (
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        {/* DataGrid: shown when viewMode is 'grid' */}
        {viewMode === 'grid' && (
          <DataGrid
            tableName={tableName}
            tableMetaData={tableMetaData}
            records={rq.records}
            totalCount={rq.totalCount}
            isLoading={rq.isLoading}
            isFetching={rq.isFetching}
            sortOrder={rq.sortOrder}
            onSortChange={rq.setSort}
            rowSelection={rq.rowSelection}
            onRowSelectionChange={rq.setRowSelection}
            columnVisibility={rq.columnVisibility}
            columnOrder={rq.columnOrder}
            columnWidths={rq.columnWidths}
            onColumnWidthChange={rq.setColumnWidth}
            density={rq.density}
            pageSize={rq.pageSize}
            onResetFilter={rq.resetFilter}
          />
        )}

        {/* Card view: shown when viewMode is 'card' */}
        {viewMode === 'card' && (
          <div className="p-3">
            <RecordCardView
              tableName={tableName}
              tableMetaData={tableMetaData}
              records={rq.records}
              rowSelection={rq.rowSelection}
              onRowSelectionChange={rq.setRowSelection}
              columnVisibility={rq.columnVisibility}
              columnOrder={rq.columnOrder}
            />
          </div>
        )}

        {/* Pagination */}
        <Pagination
          pageNum={rq.pageNum}
          pageSize={rq.pageSize as PageSize}
          totalCount={rq.totalCount}
          totalPages={rq.totalPages}
          isFetching={rq.isFetching}
          onPageChange={rq.setPage}
          onPageSizeChange={rq.setPageSize}
        />
      </div>
      )}
    </div>
  )
}
