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
 * @file DataGrid — TanStack Table v8 data grid for the QQQ Record Query page. Renders sortable, resizable columns with row selection and density support.
 */

'use client'

import React, { useMemo, useRef, useCallback, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown, BarChart3, Inbox } from 'lucide-react'
import { useRouter } from 'next/navigation'

import type { QTableMetaData, QRecord, QFilterOrderBy } from '@/types'
import type { Density } from '@/lib/hooks/use-record-query'
import { sizeWidth } from '@/lib/utils/adornment-utils'
import { getQueryColumns, orderColumns } from '@/lib/utils/query-columns'
import { isColumnVisible } from '@/lib/utils/saved-view-utils'
import { DataCell } from './DataCell'

/**
 * Props for the DataGrid component.
 */
interface DataGridProps {
  /** The backend table name, used in data-qqq-id attributes and row navigation URLs. */
  tableName: string
  /** Full table metadata from the QQQ backend. */
  tableMetaData: QTableMetaData
  /** The current page of records to display. */
  records: QRecord[]
  /** Total number of records matching the active filter (across all pages). */
  totalCount: number
  /** Whether the initial data load is in progress (shows skeleton). */
  isLoading: boolean
  /** Whether a background refetch is in progress (shows progress bar). */
  isFetching: boolean
  /**
   * Active sort order passed to the server; derived from `QFilterOrderBy[]`.
   *
   * The grid operates in **manual sorting mode** (`manualSorting: true`):
   * clicking a column header fires `onSortChange` with the new sort descriptor,
   * and the parent is responsible for re-fetching from the API with the updated
   * sort. The table does NOT sort rows locally — all ordering is server-side.
   */
  sortOrder: QFilterOrderBy[]
  /** Callback invoked when the user clicks a sortable column header. */
  onSortChange: (sort: QFilterOrderBy[]) => void
  /** TanStack Table row selection state (map of row id → selected boolean). */
  rowSelection: RowSelectionState
  /** Callback invoked when row selection changes. */
  onRowSelectionChange: (selection: RowSelectionState) => void
  /** Map of field name → visibility; `false` means the column is hidden. */
  columnVisibility: Record<string, boolean>
  /** Ordered list of field names controlling column display order. */
  columnOrder: string[]
  /** Map of field name → pixel width for user-resized columns. */
  columnWidths: Record<string, number>
  /** Callback invoked when the user drags a column resize handle. */
  onColumnWidthChange: (fieldName: string, width: number) => void
  /** Row height density variant: compact, standard, or comfortable. */
  density: Density
  /** Current page size, used to determine the number of skeleton rows during loading. */
  pageSize: number
  /** Callback invoked when the user clicks "Clear filters" in the empty state. */
  onResetFilter: () => void
  /**
   * When the selection is "all matching" or "first N" (not individual rows), reports whether
   * the row at a page index is covered, so its checkbox shows as checked.
   */
  isRowSelectedByQuery?: (rowIndex: number) => boolean
  /** When provided, each header offers column statistics for its column. */
  onColumnStats?: (columnName: string, columnLabel: string) => void
}

/** Tailwind height classes for each row density variant. */
const DENSITY_ROW_CLASS: Record<Density, string> = {
  compact: 'h-8',
  standard: 'h-12',
  comfortable: 'h-16',
}

/** Tailwind padding and text-size classes for table cells at each density variant. */
const DENSITY_CELL_CLASS: Record<Density, string> = {
  compact: 'px-3 py-1 text-xs',
  standard: 'px-4 py-2 text-sm',
  comfortable: 'px-4 py-3 text-sm',
}

/**
 * TanStack Table v8 data grid component for the QQQ Record Query page.
 *
 * Renders a sortable, column-resizable HTML table with row selection checkboxes,
 * density variants (compact / standard / comfortable), and arrow-key cell
 * navigation. Clicking a data row navigates to the record detail view.
 *
 * Return value depends on the current loading and data state:
 * - **`isLoading` is true** — returns a skeleton table (animated pulse rows
 *   matching `pageSize` up to a cap of 10) to preserve layout during initial fetch.
 * - **`records` is empty** — returns an empty-state panel (inbox icon + message +
 *   "Clear filters" button that calls `onResetFilter`).
 * - **`isFetching` is true (background refetch)** — returns the full data grid
 *   with an animated progress bar along the top edge.
 * - **Otherwise** — returns the full, interactive data grid.
 *
 * @param props - Component properties.
 * @returns The rendered data grid, skeleton, or empty-state panel.
 */
export function DataGrid({
  tableName,
  tableMetaData,
  records,
  totalCount,
  isLoading,
  isFetching,
  sortOrder,
  onSortChange,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  columnOrder,
  columnWidths,
  onColumnWidthChange,
  density,
  pageSize,
  onResetFilter,
  isRowSelectedByQuery,
  onColumnStats,
}: DataGridProps) {
  const router = useRouter()
  const resizeRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null)
  // MED-12: track active resize handlers so they can be removed if the component unmounts mid-drag
  const activeResizeRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null)
  // MED-27: ref to the <table> element for arrow-key cell navigation
  const tableRef = useRef<HTMLTableElement>(null)

  /**
   * Computes the ordered list of visible fields by filtering out hidden fields, applying
   * `columnVisibility`, and sorting by `columnOrder`.
   */
  // Build sorted column list (base and exposed-join fields) respecting columnOrder + visibility
  const visibleFields = useMemo(
    () => orderColumns(getQueryColumns(tableMetaData), columnOrder).filter((c) => isColumnVisible(c.name, columnVisibility)),
    [tableMetaData, columnVisibility, columnOrder]
  )

  // Row ids must be unique; a many-side join can repeat a primary key, so repeats get "#n"
  const rowIds = useMemo(() => {
    const seen = new Map<string, number>()
    return records.map((record, index) => {
      const pk = record.values[tableMetaData.primaryKeyField]
      if (pk == null) return `row-${index}`
      const key = String(pk)
      const n = seen.get(key) ?? 0
      seen.set(key, n + 1)
      return n === 0 ? key : `${key}#${n}`
    })
  }, [records, tableMetaData.primaryKeyField])
  const rowIdByRecord = useMemo(() => new Map(records.map((record, index) => [record, rowIds[index]])), [records, rowIds])

  /**
   * Converts the server-side `QFilterOrderBy[]` sort order into the `SortingState`
   * format expected by TanStack Table (for aria-sort and icon rendering only —
   * actual sorting is handled server-side via `manualSorting: true`).
   */
  // TanStack sorting state derived from QFilterOrderBy[]
  const tanstackSorting: SortingState = useMemo(
    () =>
      sortOrder.map((s) => ({
        id: s.fieldName,
        desc: !s.isAscending,
      })),
    [sortOrder]
  )

  /**
   * Cycles the sort state for a column: unsorted → ascending → descending → unsorted.
   *
   * @param fieldName - The backend field name of the column header that was clicked.
   */
  const handleSortColumn = useCallback(
    (fieldName: string) => {
      const existing = sortOrder.find((s) => s.fieldName === fieldName)
      if (!existing) {
        onSortChange([{ fieldName, isAscending: true }])
      } else if (existing.isAscending) {
        onSortChange([{ fieldName, isAscending: false }])
      } else {
        onSortChange([])
      }
    },
    [sortOrder, onSortChange]
  )

  /**
   * Builds TanStack Table column definitions from the visible fields plus a leading
   * checkbox selection column. Memoized so column objects are stable between renders.
   */
  // Column definitions
  const columns = useMemo<ColumnDef<QRecord>[]>(() => {
    // Checkbox selection column
    const selectColumn: ColumnDef<QRecord> = {
      id: '_select',
      size: 44,
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={isRowSelectedByQuery ? records.length > 0 && records.every((_, i) => isRowSelectedByQuery(i)) : table.getIsAllRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = !isRowSelectedByQuery && table.getIsSomeRowsSelected()
          }}
          onChange={isRowSelectedByQuery ? () => onRowSelectionChange({}) : table.getToggleAllRowsSelectedHandler()}
          aria-label="Select all rows on this page"
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
          data-qqq-id="grid-select-all"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={isRowSelectedByQuery ? isRowSelectedByQuery(row.index) : row.getIsSelected()}
          onChange={isRowSelectedByQuery
            ? () => onRowSelectionChange(Object.fromEntries(rowIds.filter((id, i) => i !== row.index && isRowSelectedByQuery(i)).map((id) => [id, true])))
            : row.getToggleSelectedHandler()}
          aria-label={`Select ${row.original.recordLabel ?? 'record'}`}
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
          data-qqq-id={`grid-select-row-${row.index}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    }

    // MED-3: pre-build a Map for O(1) sort lookups instead of O(n) find per column
    const sortMap = new Map(sortOrder.map((s) => [s.fieldName, s]))

    const fieldColumns: ColumnDef<QRecord>[] = visibleFields.map((column) => {
      const field = column.field
      const sortInfo = sortMap.get(column.name)
      // A user-resized width wins; otherwise the field's SIZE adornment suggests one.
      const defaultWidth = columnWidths[column.name] ?? sizeWidth(field) ?? 150

      return {
        id: column.name,
        size: defaultWidth,
        enableSorting: true,
        header: () => {
          const isSorted = sortInfo != null
          return (
            <div className="flex w-full items-center gap-1">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1 font-semibold text-left focus:outline-none focus:ring-1 focus:ring-ring"
              onClick={() => handleSortColumn(column.name)}
              aria-label={`Sort by ${column.label}`}
              data-qqq-id={`grid-header-${column.name}`}
            >
              <span className="truncate">{column.label}</span>
              {isSorted ? (
                sortInfo.isAscending ? (
                  <ArrowUp className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                )
              ) : (
                <ArrowUpDown className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden="true" />
              )}
            </button>
            {onColumnStats && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onColumnStats(column.name, column.label) }}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring group-hover:opacity-100"
                aria-label={`Column statistics for ${column.label}`}
                data-qqq-id={`grid-column-stats-${column.name}`}
              >
                <BarChart3 className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
            </div>
          )
        },
        cell: ({ row }) => (
          <DataCell
            field={field}
            value={row.original.values[column.name]}
            displayValue={row.original.displayValues?.[column.name]}
            record={row.original}
          />
        ),
      }
    })

    return [selectColumn, ...fieldColumns]
  }, [visibleFields, sortOrder, columnWidths, handleSortColumn, isRowSelectedByQuery, records, rowIds, onRowSelectionChange, onColumnStats])

  const table = useReactTable<QRecord>({
    data: records,
    columns,
    state: {
      rowSelection,
      sorting: tanstackSorting,
    },
    enableRowSelection: true,
    enableMultiRowSelection: true,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(rowSelection) : updater
      onRowSelectionChange(next)
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: totalCount,
    manualSorting: true,
    getRowId: (row, index) => rowIdByRecord.get(row) ?? `row-${index}`,
  })

  // ------------------------------------------------------------------
  // Column resize handlers
  // ------------------------------------------------------------------
  /**
   * Initiates a column resize drag operation on mousedown.
   *
   * Attaches `mousemove` and `mouseup` listeners to the document so the drag
   * continues even when the pointer leaves the resize handle. Cleans up listeners
   * in the matching `mouseup` handler and in the component-unmount effect.
   *
   * @param e - The mousedown event from the resize handle.
   * @param colId - The column id (field name) being resized.
   * @param currentWidth - The column's pixel width at the start of the drag.
   */
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, colId: string, currentWidth: number) => {
      e.preventDefault()
      e.stopPropagation()
      resizeRef.current = { colId, startX: e.clientX, startWidth: currentWidth }

      const handleMouseMove = (me: MouseEvent) => {
        if (!resizeRef.current) return
        const delta = me.clientX - resizeRef.current.startX
        const newWidth = Math.max(60, resizeRef.current.startWidth + delta)
        onColumnWidthChange(resizeRef.current.colId, newWidth)
      }

      const handleMouseUp = () => {
        resizeRef.current = null
        activeResizeRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      activeResizeRef.current = { move: handleMouseMove, up: handleMouseUp }
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [onColumnWidthChange]
  )

  /**
   * Adjusts column width by ±10 px when the user presses ArrowLeft or ArrowRight
   * while a resize handle is focused. Prevents default scroll behavior.
   *
   * @param e - The keyboard event fired on the resize handle element.
   * @param colId - The column id (field name) being resized.
   * @param currentWidth - The column's current pixel width.
   */
  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent, colId: string, currentWidth: number) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const delta = e.key === 'ArrowRight' ? 10 : -10
      const newWidth = Math.max(60, currentWidth + delta)
      onColumnWidthChange(colId, newWidth)
    },
    [onColumnWidthChange]
  )

  // Remove any lingering resize listeners if the component unmounts during a drag
  useEffect(() => {
    return () => {
      const h = activeResizeRef.current
      if (h) {
        document.removeEventListener('mousemove', h.move)
        document.removeEventListener('mouseup', h.up)
      }
    }
  }, [])

  // ------------------------------------------------------------------
  // Row click handler
  // ------------------------------------------------------------------
  /**
   * Navigates to the record detail view when a table row is clicked.
   *
   * Uses the table's primary key field to construct the URL. Rows without a
   * resolvable primary key value are silently ignored.
   *
   * @param record - The QRecord whose row was clicked.
   */
  const handleRowClick = useCallback(
    (record: QRecord) => {
      const primaryKey = tableMetaData.primaryKeyField
      const id = record.values[primaryKey]
      if (id != null) {
        router.push(`/app/${tableName}/${id}`)
      }
    },
    [router, tableName, tableMetaData.primaryKeyField]
  )

  // ------------------------------------------------------------------
  // MED-27: Arrow-key keyboard navigation between cells
  // ------------------------------------------------------------------
  /**
   * Handles ArrowUp/ArrowDown/ArrowLeft/ArrowRight key events on table cells.
   *
   * Queries all body `<td>` elements via the table ref and moves focus to the
   * adjacent cell in the pressed direction. Cells are ordered row-by-row so that
   * column index can be derived from `cellIndex % columnCount`.
   *
   * @param e - The keyboard event fired on a focused `<td>`.
   */
  const handleCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLTableCellElement>) => {
    const { key } = e
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return

    const table = tableRef.current
    if (!table) return

    const cells = Array.from(table.querySelectorAll<HTMLTableCellElement>('tbody td'))
    if (cells.length === 0) return

    const focused = e.currentTarget
    const currentIdx = cells.indexOf(focused)
    if (currentIdx === -1) return

    // Determine column count from the first tbody row
    const firstRow = table.querySelector('tbody tr')
    const columnCount = firstRow ? firstRow.querySelectorAll('td').length : 1

    let nextIdx: number | null = null
    if (key === 'ArrowDown') {
      nextIdx = currentIdx + columnCount
    } else if (key === 'ArrowUp') {
      nextIdx = currentIdx - columnCount
    } else if (key === 'ArrowRight') {
      // Stay within the same row — wrap only if not at the last column
      const isLastInRow = (currentIdx + 1) % columnCount === 0
      if (!isLastInRow) nextIdx = currentIdx + 1
    } else if (key === 'ArrowLeft') {
      // Stay within the same row — wrap only if not at the first column
      const isFirstInRow = currentIdx % columnCount === 0
      if (!isFirstInRow) nextIdx = currentIdx - 1
    }

    if (nextIdx !== null && nextIdx >= 0 && nextIdx < cells.length) {
      e.preventDefault()
      cells[nextIdx].focus()
    }
  }, [])

  const cellClass = DENSITY_CELL_CLASS[density]
  const rowClass = DENSITY_ROW_CLASS[density]

  // ------------------------------------------------------------------
  // Skeleton loading state
  // ------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="w-full overflow-x-auto" data-qqq-id="grid-loading">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted">
              {[...Array(5)].map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(pageSize > 10 ? 10 : pageSize)].map((_, i) => (
              <tr key={i} className="border-b border-border">
                {[...Array(5)].map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div
                      className="h-4 bg-muted rounded animate-pulse"
                      style={{ width: `${60 + (j * 20) % 40}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Empty state
  // ------------------------------------------------------------------
  if (!isLoading && records.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        data-qqq-id="grid-empty"
      >
        <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 text-lg font-medium text-muted-foreground">No records found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters or clearing the search.
        </p>
        <button
          type="button"
          onClick={onResetFilter}
          className="mt-4 text-sm text-primary underline hover:text-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id="button-clear-filters"
        >
          Clear filters
        </button>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Main grid
  // ------------------------------------------------------------------
  return (
    <div className="relative w-full overflow-x-auto" data-qqq-id={`grid-${tableName}`}>
      {/* D-Q-6: SR announcement for background refetches */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isFetching ? 'Loading results' : ''}
      </div>

      {isFetching && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/20 overflow-hidden z-10">
          <div className="h-full bg-primary animate-[slideRight_1s_ease-in-out_infinite]" />
        </div>
      )}

      <table ref={tableRef} className="w-full border-collapse table-fixed min-w-[600px]" role="grid" aria-label={`${tableMetaData.label} records`}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b border-border bg-muted"
            >
              {headerGroup.headers.map((header, colIndex) => {
                // Compute aria-sort for sortable columns
                const isSelectCol = header.id === '_select'
                const sortInfo = !isSelectCol
                  ? sortOrder.find((s) => s.fieldName === header.id)
                  : undefined
                const isSortable = !isSelectCol
                const ariaSortValue: 'ascending' | 'descending' | 'none' | undefined = !isSortable
                  ? undefined
                  : sortInfo
                    ? sortInfo.isAscending
                      ? 'ascending'
                      : 'descending'
                    : 'none'

                // D-Q-8: sticky columns — checkbox col (index 0) and first data col (index 1)
                const stickyClass =
                  colIndex === 0
                    ? 'sticky left-0 z-[1] bg-muted'
                    : colIndex === 1
                      ? 'sticky left-[44px] z-[1] bg-muted'
                      : ''

                return (
                  <th
                    key={header.id}
                    scope="col"
                    className={`group relative text-left font-semibold text-foreground select-none ${cellClass} ${stickyClass}`}
                    style={{ width: `${header.getSize()}px` }}
                    aria-sort={ariaSortValue}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}

                    {/* Column resize handle */}
                    {!isSelectCol && (() => {
                      const fieldLabel = visibleFields.find(f => f.name === header.id)?.label ?? header.id
                      return (
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/40 active:bg-primary focus:outline-none focus-visible:bg-primary/60"
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${fieldLabel} column`}
                          aria-valuenow={Math.round(header.getSize())}
                          aria-valuemin={60}
                          aria-valuemax={2000}
                          tabIndex={0}
                          onMouseDown={(e) =>
                            handleResizeMouseDown(e, header.id, header.getSize())
                          }
                          onKeyDown={(e) =>
                            handleResizeKeyDown(e, header.id, header.getSize())
                          }
                        />
                      )
                    })()}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-border transition-colors hover:bg-muted/50 cursor-pointer ${rowClass} ${row.getIsSelected() ? 'bg-primary/5' : ''}`}
              onClick={() => handleRowClick(row.original)}
              data-qqq-id={`grid-row-${row.index}`}
            >
              {row.getVisibleCells().map((cell, colIndex) => {
                // D-Q-8: sticky columns — checkbox col (index 0) and first data col (index 1)
                const cellStickyClass =
                  colIndex === 0
                    ? 'sticky left-0 z-[1] bg-card'
                    : colIndex === 1
                      ? 'sticky left-[44px] z-[1] bg-card'
                      : ''

                return (
                  <td
                    key={cell.id}
                    className={`overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${cellClass} ${cellStickyClass}`}
                    style={{ width: `${cell.column.getSize()}px` }}
                    data-qqq-id={`grid-cell-${cell.column.id}`}
                    tabIndex={0}
                    onKeyDown={handleCellKeyDown}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
