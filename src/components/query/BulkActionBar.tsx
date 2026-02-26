'use client'

// BulkActionBar — shows when rows are selected; provides bulk actions including process launcher

import React from 'react'
import { X, Trash2, Download } from 'lucide-react'

import type { QTableMetaData, QProcessMetaData, QQueryFilter } from '@/types'
import { ProcessLauncherMenu } from './ProcessLauncherMenu'

interface BulkActionBarProps {
  tableMetaData: QTableMetaData
  selectedCount: number
  totalCount: number
  onClearSelection: () => void
  onDeleteSelected?: () => void
  onExportSelected?: () => void
  onRunProcess?: (processName: string) => void
  processes?: QProcessMetaData[]
  selectedRecordIds?: (string | number)[]
  currentFilter?: QQueryFilter
}

export function BulkActionBar({
  tableMetaData,
  selectedCount,
  totalCount,
  onClearSelection,
  onDeleteSelected,
  onExportSelected,
  onRunProcess,
  processes,
  selectedRecordIds,
  currentFilter,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  const canDelete = tableMetaData.deletePermission
  const hasProcesses = processes && processes.length > 0

  return (
    <div
      className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-2"
      role="region"
      aria-label="Bulk actions"
      aria-live="polite"
      data-qqq-id="bulk-action-bar"
    >
      {/* Selection info */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-primary">
          {selectedCount} of {totalCount.toLocaleString()} selected
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/90 focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="flex items-center gap-1.5 rounded border border-destructive bg-background px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive"
            aria-label={`Delete ${selectedCount} selected record${selectedCount !== 1 ? 's' : ''}`}
            data-qqq-id="bulk-delete"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </button>
        )}

        {/* Process launcher in bulk action bar */}
        {hasProcesses && selectedRecordIds && currentFilter && (
          <ProcessLauncherMenu
            processes={processes}
            selectedRecordIds={selectedRecordIds}
            tableName={tableMetaData.name}
            currentFilter={currentFilter}
          />
        )}
      </div>
    </div>
  )
}
