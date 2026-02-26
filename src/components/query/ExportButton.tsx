'use client'

// ExportButton — exports records to CSV (or other formats)

import React, { useState } from 'react'
import { Download, ChevronDown } from 'lucide-react'

import type { QTableMetaData, QRecord, QQueryFilter } from '@/types'
import { queryRecords } from '@/lib/api/tables'

interface ExportButtonProps {
  tableName: string
  tableMetaData: QTableMetaData
  currentFilter: QQueryFilter
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  selectedRecordIds?: (string | number)[]
}

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
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[ExportButton] Export failed:', err)
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
        className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
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
            className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
            role="menu"
            aria-label="Export options"
          >
            <button
              type="button"
              onClick={() => exportToCSV('all')}
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
              data-qqq-id="export-all"
            >
              All records (CSV)
            </button>
            <button
              type="button"
              onClick={() => exportToCSV('page')}
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
              data-qqq-id="export-page"
            >
              Current page (CSV)
            </button>
            {selectedRecordIds.length > 0 && (
              <button
                type="button"
                onClick={() => exportToCSV('selected')}
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
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
