/** ExportButton — toolbar dropdown for exporting records to CSV. Supports exporting all matching records (up to 10,000), the current page, or only the selected records. */
'use client'

// ExportButton — exports records to CSV (or other formats)

import React, { useState } from 'react'
import { Download, ChevronDown } from 'lucide-react'

import type { QTableMetaData, QRecord, QQueryFilter } from '@/types'
import { queryRecords } from '@/lib/api/tables'
import { toast } from '@/lib/hooks/use-toast'

/**
 * Props for the ExportButton component.
 */
interface ExportButtonProps {
  /** Backend table name used in API calls and the generated file name. */
  tableName: string
  /** Table metadata providing the field list for CSV column headers. */
  tableMetaData: QTableMetaData
  /** The currently active filter, used for "all" and "page" export scopes. */
  currentFilter: QQueryFilter
  /** Map of field name → visibility; hidden columns are excluded from the export. */
  columnVisibility: Record<string, boolean>
  /** Ordered list of field names controlling the column order in the CSV. */
  columnOrder: string[]
  /** Selected record IDs; when non-empty, an additional "Selected (N)" export option is shown. */
  selectedRecordIds?: (string | number)[]
}

/**
 * Toolbar dropdown button for exporting table records to a CSV file.
 *
 * Offers three export scopes:
 * - **All records** — fetches up to 10,000 records matching the current filter.
 * - **Current page** — re-fetches the current page using the current filter.
 * - **Selected** — fetches only the checked records (visible only when `selectedRecordIds` is non-empty).
 *
 * The CSV is built in memory from visible fields (respecting `columnVisibility` and `columnOrder`),
 * then downloaded via a temporary anchor element. Errors are surfaced as a toast notification.
 *
 * @param tableName - Backend table name for API calls and file naming.
 * @param tableMetaData - Table metadata for field headers.
 * @param currentFilter - Active filter used in "all" and "page" export modes.
 * @param columnVisibility - Per-column visibility map.
 * @param columnOrder - Ordered field name list for CSV column order.
 * @param selectedRecordIds - IDs of checked rows; enables the "Selected" export option.
 */
export function ExportButton({
  tableName,
  tableMetaData,
  currentFilter,
  columnVisibility,
  columnOrder,
  selectedRecordIds = [],
}: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const visibleFields = Object.values(tableMetaData.fields)
    .filter((f) => !f.isHidden && columnVisibility[f.name] !== false)
    .sort((a, b) => {
      const orderMap: Record<string, number> = {}
      columnOrder.forEach((name, idx) => { orderMap[name] = idx })
      return (orderMap[a.name] ?? 9999) - (orderMap[b.name] ?? 9999)
    })

  /**
   * Fetches records for the given scope and triggers a CSV file download.
   *
   * - `'all'` — fetches up to 10,000 records matching the current filter.
   * - `'selected'` — fetches only the records whose IDs are in `selectedRecordIds`.
   * - `'page'` — re-fetches the current page using the unmodified `currentFilter`.
   *
   * Closes the dropdown before fetching. Shows a toast on error.
   *
   * @param scope - Which records to include in the export.
   */
  const exportToCSV = async (scope: 'all' | 'selected' | 'page') => {
    setExporting(true)
    setOpen(false)
    try {
      let records: QRecord[] = []

      if (scope === 'selected' && selectedRecordIds.length > 0) {
        // Build a filter for selected IDs
        const pk = tableMetaData.primaryKeyField
        const response = await queryRecords(tableName, {
          filter: {
            criteria: [{ fieldName: pk, operator: 'IN', values: selectedRecordIds.map(String) }],
            booleanOperator: 'AND',
            skip: 0,
            limit: selectedRecordIds.length,
          },
        })
        records = response.records
      } else if (scope === 'page') {
        // Export just the current page — re-use current filter as-is
        const response = await queryRecords(tableName, { filter: currentFilter })
        records = response.records
      } else {
        // Export all (up to 10,000)
        const exportFilter = { ...currentFilter, skip: 0, limit: 10000, orderBys: [] }
        const response = await queryRecords(tableName, { filter: exportFilter })
        records = response.records
      }

      // Build CSV content
      const headers = visibleFields.map((f) => `"${f.label.replace(/"/g, '""')}"`)
      const rows = records.map((record) =>
        visibleFields.map((f) => {
          const displayVal = record.displayValues?.[f.name] ?? record.values[f.name]
          const str = displayVal != null ? String(displayVal) : ''
          return `"${str.replace(/"/g, '""')}"`
        }).join(',')
      )

      const csv = [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tableName}-export-${new Date().toISOString().slice(0, 10)}.csv`
      // LOW-7: append to DOM before clicking for cross-browser reliability (Firefox),
      // then remove immediately after to avoid polluting the document.
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[ExportButton] Export failed:', err)
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative" data-qqq-id="export-button">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={exporting}
        className="flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Export records"
        aria-haspopup="true"
        aria-expanded={open}
        data-qqq-id="button-export"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {exporting ? 'Exporting...' : 'Export'}
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
            className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-border bg-popover shadow-sm"
            role="menu"
            aria-label="Export options"
          >
            <button
              type="button"
              onClick={() => exportToCSV('all')}
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-popover-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
              data-qqq-id="export-all"
            >
              All records (CSV)
            </button>
            <button
              type="button"
              onClick={() => exportToCSV('page')}
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-popover-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
              data-qqq-id="export-page"
            >
              Current page (CSV)
            </button>
            {selectedRecordIds.length > 0 && (
              <button
                type="button"
                onClick={() => exportToCSV('selected')}
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-popover-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
                data-qqq-id="export-selected"
              >
                Selected ({selectedRecordIds.length}) (CSV)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
