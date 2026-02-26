'use client'

// BulkActionBar — shows when rows are selected; provides bulk actions

import React from 'react'
import { X, Trash2, Download, ChevronDown } from 'lucide-react'

import type { QTableMetaData } from '@/types'

interface BulkActionBarProps {
  tableMetaData: QTableMetaData
  selectedCount: number
  totalCount: number
  onClearSelection: () => void
  onDeleteSelected?: () => void
  onExportSelected?: () => void
  onRunProcess?: (processName: string) => void
}

export function BulkActionBar({
  tableMetaData,
  selectedCount,
  totalCount,
  onClearSelection,
  onDeleteSelected,
  onExportSelected,
  onRunProcess,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  // Get table-associated processes from global metadata (if available)
  const canDelete = tableMetaData.deletePermission

  return (
    <div
      className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-700 dark:bg-blue-950"
      role="region"
      aria-label="Bulk actions"
      aria-live="polite"
      data-qqq-id="bulk-action-bar"
    >
      {/* Selection info */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
          {selectedCount} of {totalCount.toLocaleString()} selected
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-blue-400"
          aria-label="Clear selection"
          data-qqq-id="bulk-clear-selection"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onExportSelected && (
          <button
            type="button"
            onClick={onExportSelected}
            className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            aria-label="Export selected records"
            data-qqq-id="bulk-export"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </button>
        )}

        {canDelete && onDeleteSelected && (
          <button
            type="button"
            onClick={onDeleteSelected}
            className="flex items-center gap-1.5 rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-red-700 dark:bg-gray-800"
            aria-label={`Delete ${selectedCount} selected record${selectedCount !== 1 ? 's' : ''}`}
            data-qqq-id="bulk-delete"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </button>
        )}

        {onRunProcess && (
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              aria-label="Run process on selected records"
              aria-haspopup="true"
              data-qqq-id="bulk-run-process"
            >
              Run Process
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
