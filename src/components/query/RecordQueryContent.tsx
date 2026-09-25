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
 * @file RecordQueryContent — data grid / card view, pagination, empty state, and error state for the RecordQuery page.
 */

'use client'

import { useQueryClient } from '@tanstack/react-query'

import type { QTableMetaData, QRecord, QQueryFilter, QFilterOrderBy } from '@/types'
import type { Density, PageSize } from '@/lib/hooks/use-record-query'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { queryKeys } from '@/lib/query-client'

import { DataGrid } from './DataGrid'
import { Pagination } from './Pagination'
import { RecordCardView } from './RecordCardView'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'

/** Display mode for the record list — either a tabular grid or a card layout. */
type ViewMode = 'grid' | 'card'

/**
 * Props for the RecordQueryContent component.
 */
export interface RecordQueryContentProps {
  /** The backend table name used in API calls and URL routing. */
  tableName: string
  /** Full table metadata from the QQQ backend. */
  tableMetaData: QTableMetaData
  /** Currently active view mode (grid or card). */
  viewMode: ViewMode
  /** Number of active filter criteria (used by the empty-state clear action). */
  activeFilterCount: number

  // Data
  /** Records returned by the current page query. */
  records: QRecord[]
  /** Whether the records or count query is in its initial loading state. */
  isLoading: boolean
  /** Whether any fetch (including background refetch) is in progress. */
  isFetching: boolean
  /** Whether the records query encountered an error. */
  isError: boolean
  /** The error thrown by the records query, or null. */
  error: Error | null

  // Filter / sort
  /** Active sort order applied to the data fetch. */
  sortOrder: QFilterOrderBy[]
  /** Callback to update the sort order. */
  onSortChange: (order: QFilterOrderBy[]) => void
  /** Callback to clear all active filters and quick-search. */
  onResetFilter: () => void
  /** Current quick-search term (used by the empty-state clear action). */
  quickSearchTerm: string

  // Selection
  /** Map of row PK string → selected boolean managed by TanStack Table. */
  rowSelection: Record<string, boolean>
  /** Callback to update the row selection map. */
  onRowSelectionChange: (selection: Record<string, boolean>) => void

  // Columns
  /** Map of fieldName → visible. */
  columnVisibility: Record<string, boolean>
  /** Ordered list of column field names. */
  columnOrder: string[]
  /** Map of fieldName → pixel width for resized columns. */
  columnWidths: Record<string, number>
  /** Callback to record a resized column's new pixel width. */
  onColumnWidthChange: (fieldName: string, width: number) => void

  // Density + pagination
  /** Currently active row density for the data grid. */
  density: Density
  /** Current 1-based page number. */
  pageNum: number
  /** Number of records per page. */
  pageSize: PageSize
  /** Total number of records matching the active filter, or null when the table cannot count. */
  totalCount: number | null
  /** Distinct base records when a many-side join repeats rows. */
  distinctCount?: number | null
  /** Reports whether a page row is covered by an all/first-N selection. */
  isRowSelectedByQuery?: (rowIndex: number) => boolean
  /** Opens column statistics for a column (only when the table supports them). */
  onColumnStats?: (columnName: string, columnLabel: string) => void
  /** Total number of pages. */
  totalPages: number
  /** Callback to navigate to a specific page. */
  onPageChange: (pageNum: number) => void
  /** Callback to change the number of rows per page. */
  onPageSizeChange: (pageSize: PageSize) => void
}

/**
 * Content area for the RecordQuery page.
 *
 * Renders the error state, empty state, DataGrid (or RecordCardView), and Pagination.
 * All state is passed in as props — this component holds no state of its own.
 *
 * @param props - Component properties.
 * @returns The rendered content area with data grid or card view and pagination.
 */
export function RecordQueryContent({
  tableName,
  tableMetaData,
  viewMode,
  activeFilterCount,
  records,
  isLoading,
  isFetching,
  isError,
  error,
  sortOrder,
  onSortChange,
  onResetFilter,
  quickSearchTerm,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  columnOrder,
  columnWidths,
  onColumnWidthChange,
  density,
  pageNum,
  pageSize,
  totalCount,
  distinctCount = null,
  isRowSelectedByQuery,
  onColumnStats,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: RecordQueryContentProps) {
  const queryClient = useQueryClient()

  return (
    <>
      {/* ============================================================
          Error state
      ============================================================ */}
      {isError && (
        <div
          className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
          data-qqq-id="grid-error"
        >
          <p className="font-medium">
            {getErrorStatusCode(error) === 403
              ? 'You do not have permission to view these records.'
              : getErrorStatusCode(error) === 404
                ? 'This table could not be found.'
                : 'Failed to load records.'}
          </p>
          <p className="mt-1 text-xs">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
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
      {!isLoading && !isError && records.length === 0 && (
        <EmptyState
          title="No records found"
          description="Try adjusting your filters or search term."
          action={
            activeFilterCount > 0 || quickSearchTerm
              ? { label: 'Clear Filters', onClick: onResetFilter }
              : undefined
          }
        />
      )}

      {/* ============================================================
          Data Grid / Card View
      ============================================================ */}
      {(isLoading || records.length > 0) && (
        <ErrorBoundary className="rounded-xl">
          <div className="overflow-hidden rounded-xl border border-border">
            {/* DataGrid: shown when viewMode is 'grid' */}
            {viewMode === 'grid' && (
              <DataGrid
                tableName={tableName}
                tableMetaData={tableMetaData}
                records={records}
                totalCount={totalCount ?? records.length}
                isLoading={isLoading}
                isFetching={isFetching}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
                rowSelection={rowSelection}
                onRowSelectionChange={onRowSelectionChange}
                columnVisibility={columnVisibility}
                columnOrder={columnOrder}
                columnWidths={columnWidths}
                onColumnWidthChange={onColumnWidthChange}
                density={density}
                pageSize={pageSize}
                onResetFilter={onResetFilter}
                isRowSelectedByQuery={isRowSelectedByQuery}
                onColumnStats={onColumnStats}
              />
            )}

            {/* Card view: shown when viewMode is 'card' */}
            {viewMode === 'card' && (
              <div className="p-3">
                <RecordCardView
                  tableName={tableName}
                  tableMetaData={tableMetaData}
                  records={records}
                  rowSelection={rowSelection}
                  onRowSelectionChange={onRowSelectionChange}
                  columnVisibility={columnVisibility}
                  columnOrder={columnOrder}
                />
              </div>
            )}

            {/* Pagination */}
            <Pagination
              pageNum={pageNum}
              pageSize={pageSize}
              totalCount={totalCount}
              distinctCount={distinctCount}
              pageRowCount={records.length}
              totalPages={totalPages}
              isFetching={isFetching}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        </ErrorBoundary>
      )}
    </>
  )
}
