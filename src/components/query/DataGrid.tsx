'use client'

// DataGrid — TanStack Table v8 data grid for QQQ Record Query

import React, { useMemo, useRef, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown, Inbox } from 'lucide-react'
import { useRouter } from 'next/navigation'

import type { QTableMetaData, QRecord, QFilterOrderBy } from '@/types'
import { DataCell } from './DataCell'
import type { Density } from '@/lib/hooks/use-record-query'

interface DataGridProps {
  tableName: string
  tableMetaData: QTableMetaData
  records: QRecord[]
  totalCount: number
  isLoading: boolean
  isFetching: boolean
  sortOrder: QFilterOrderBy[]
  onSortChange: (sort: QFilterOrderBy[]) => void
  rowSelection: RowSelectionState
  onRowSelectionChange: (selection: RowSelectionState) => void
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  columnWidths: Record<string, number>
  onColumnWidthChange: (fieldName: string, width: number) => void
  density: Density
  pageSize: number
  onResetFilter: () => void
}

const DENSITY_ROW_CLASS: Record<Density, string> = {
  compact: 'h-8',
  standard: 'h-12',
  comfortable: 'h-16',
}

const DENSITY_CELL_CLASS: Record<Density, string> = {
  compact: 'px-3 py-1 text-xs',
  standard: 'px-4 py-2 text-sm',
  comfortable: 'px-4 py-3 text-sm',
}

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
}: DataGridProps) {
  const router = useRouter()
  const resizeRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null)

  // Build sorted field list respecting columnOrder + visibility
  const visibleFields = useMemo(() => {
    const allFields = Object.values(tableMetaData.fields).filter(
      (f) => !f.isHidden
    )

    // Apply column visibility
    const visible = allFields.filter((f) => columnVisibility[f.name] !== false)

    // Sort by columnOrder (if provided)
    if (columnOrder.length > 0) {
      const orderMap: Record<string, number> = {}
      columnOrder.forEach((name, idx) => {
        orderMap[name] = idx
      })
      visible.sort((a, b) => {
        const ia = orderMap[a.name] ?? 9999
        const ib = orderMap[b.name] ?? 9999
        return ia - ib
      })
    }

    return visible
  }, [tableMetaData.fields, columnVisibility, columnOrder])

  // TanStack sorting state derived from QFilterOrderBy[]
  const tanstackSorting: SortingState = useMemo(
    () =>
      sortOrder.map((s) => ({
        id: s.fieldName,
        desc: !s.isAscending,
      })),
    [sortOrder]
  )

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
          checked={table.getIsAllRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomeRowsSelected()
          }}
          onChange={table.getToggleAllRowsSelectedHandler()}
          aria-label="Select all rows on this page"
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
          data-qqq-id="grid-select-all"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          aria-label={`Select ${row.original.recordLabel ?? 'record'}`}
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
          data-qqq-id={`grid-select-row-${row.index}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    }

    const fieldColumns: ColumnDef<QRecord>[] = visibleFields.map((field) => {
      const sortInfo = sortOrder.find((s) => s.fieldName === field.name)
      const defaultWidth = columnWidths[field.name] ?? 150

      return {
        id: field.name,
        size: defaultWidth,
        enableSorting: true,
        header: () => {
          const isSorted = sortInfo != null
          return (
            <button
              type="button"
              className="flex w-full items-center gap-1 font-semibold text-left focus:outline-none focus:ring-1 focus:ring-ring"
              onClick={() => handleSortColumn(field.name)}
              aria-label={`Sort by ${field.label}`}
              data-qqq-id={`grid-header-${field.name}`}
            >
              <span className="truncate">{field.label}</span>
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
          )
        },
        cell: ({ row }) => (
          <DataCell
            field={field}
            value={row.original.values[field.name]}
            displayValue={row.original.displayValues?.[field.name]}
            record={row.original}
          />
        ),
      }
    })

    return [selectColumn, ...fieldColumns]
  }, [visibleFields, sortOrder, columnWidths, handleSortColumn])

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
    getRowId: (row, index) => {
      const pk = tableMetaData.primaryKeyField
      return row.values[pk] != null ? String(row.values[pk]) : `row-${index}`
    },
  })

  // ------------------------------------------------------------------
  // Column resize handlers
  // ------------------------------------------------------------------
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
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [onColumnWidthChange]
  )

  // ------------------------------------------------------------------
  // Row click handler
  // ------------------------------------------------------------------
  const handleRowClick = useCallback(
    (record: QRecord) => {
      const pk = tableMetaData.primaryKeyField
      const id = record.values[pk]
      if (id != null) {
        router.push(`/app/${tableName}/${id}`)
      }
    },
    [router, tableName, tableMetaData.primaryKeyField]
  )

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
      {isFetching && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/20 overflow-hidden z-10">
          <div className="h-full bg-primary animate-[slideRight_1s_ease-in-out_infinite]" />
        </div>
      )}

      <table className="w-full border-collapse table-fixed min-w-[600px]" role="grid" aria-label={`${tableMetaData.label} records`}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b border-border bg-muted"
            >
              {headerGroup.headers.map((header) => {
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

                return (
                  <th
                    key={header.id}
                    scope="col"
                    className={`group relative text-left font-semibold text-foreground select-none ${cellClass}`}
                    style={{ width: `${header.getSize()}px` }}
                    aria-sort={ariaSortValue}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}

                    {/* Column resize handle */}
                    {!isSelectCol && (
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/40 active:bg-primary"
                        onMouseDown={(e) =>
                          handleResizeMouseDown(e, header.id, header.getSize())
                        }
                        aria-hidden="true"
                      />
                    )}
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
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`overflow-hidden ${cellClass}`}
                  style={{ width: `${cell.column.getSize()}px` }}
                  data-qqq-id={`grid-cell-${cell.column.id}`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
