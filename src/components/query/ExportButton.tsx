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
 * @file ExportButton — exports the query's matching records through the backend's streaming
 * export (CSV, XLSX or JSON) with the visible columns, in order, and the active filter and
 * sort, as the Material dashboard does.
 */

'use client'

import React, { useState } from 'react'
import { isAxiosError } from 'axios'
import { Download, ChevronDown } from 'lucide-react'

import type { QTableMetaData, QQueryFilter } from '@/types'
import { exportRecords, type ExportFormat, type TableVariant } from '@/lib/api/tables'
import { hasCapability } from '@/lib/utils/query-columns'
import { toast } from '@/lib/hooks/use-toast'

/**
 * Props for the ExportButton component.
 */
interface ExportButtonProps {
  /** Backend table name. */
  tableName: string
  /** Table metadata (label, capabilities). */
  tableMetaData: QTableMetaData
  /** Filter and sort of the rows to export (paging is ignored). */
  exportFilter: QQueryFilter
  /** Visible column names (including `joinTable.field`) in display order. */
  columnNames: string[]
  /** Number of matching records, or null when the table cannot count. */
  totalCount: number | null
  /** Variant for tables whose backend uses variants. */
  tableVariant?: TableVariant | null
}

const FORMATS: ExportFormat[] = ['csv', 'xlsx', 'json']

/**
 * Formats a date for export file names like Material ("2026-09-24 1512").
 *
 * @param date - The date.
 * @returns The formatted date.
 */
export function formatDateTimeForFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}${pad(date.getMinutes())}`
}

/**
 * Reads a readable error message from a failed export response.
 *
 * @param error - The thrown error.
 * @returns The message.
 */
async function exportErrorMessage(error: unknown): Promise<string> {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    const text = (await error.response.data.text()).trim()
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed.error) return parsed.error
    } catch {
      // not JSON
    }
    if (text) return text.replace(/^Error generating report: /, '')
  }
  return error instanceof Error ? error.message : 'Export failed.'
}

/**
 * Dropdown button offering CSV, XLSX and JSON exports of the query result.
 *
 * @param props - Component properties.
 * @returns The rendered export menu.
 */
export function ExportButton({ tableName, tableMetaData, exportFilter, columnNames, totalCount, tableVariant }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const allowed = hasCapability(tableMetaData, 'TABLE_EXPORT')
  const nothingToExport = totalCount === 0

  const runExport = async (format: ExportFormat) => {
    setOpen(false)
    setExporting(true)
    const filename = `${tableMetaData.label} Export ${formatDateTimeForFileName(new Date())}.${format}`
    try {
      const { skip: _skip, limit: _limit, ...filter } = exportFilter
      void _skip
      void _limit
      const blob = await exportRecords(tableName, filename, columnNames, filter, tableVariant ?? undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      toast.error(`Export failed: ${await exportErrorMessage(err)}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative" data-qqq-id="export-button">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={exporting || !allowed}
        title={allowed ? undefined : 'Exports are not allowed for this table.'}
        className="flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={allowed ? 'Export records' : 'Export records (exports are not allowed for this table)'}
        aria-haspopup="menu"
        aria-expanded={open}
        data-qqq-id="button-export"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {exporting ? 'Exporting...' : 'Export'}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border bg-popover py-1 shadow-sm" role="menu" aria-label="Export options">
            {FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                disabled={nothingToExport}
                onClick={() => runExport(format)}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-ring"
                data-qqq-id={`export-${format}`}
              >
                Export {format.toUpperCase()}
                {totalCount !== null && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {totalCount.toLocaleString()} record{totalCount === 1 ? '' : 's'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
