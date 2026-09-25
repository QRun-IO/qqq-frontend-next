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
 * @file Canonical QQQ table and multi-table widgets (`TableData`, `MultiTableData`).
 */
'use client'

import React, { useState } from 'react'

import type { QWidgetMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'
import type { QqqCompositeData, WidgetComponentProps } from './widget-types'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import { SafeHtml } from './SafeHtml'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { WidgetLink } from './QqqStatisticsWidgets'
import { QqqComposite } from './blocks/QqqComposite'

/** One `TableData.Column`. */
interface TableColumn {
  type?: string
  header?: string
  accessor?: string
  width?: string
  align?: string
  verticalAlign?: string
}

/** `TableData` payload. */
export interface QqqTablePayload {
  type?: string
  label?: string
  linkText?: string
  linkURL?: string
  noRowsFoundHTML?: string
  columns?: unknown
  rows?: unknown
  rowsPerPage?: number
  hidePaginationDropdown?: boolean
  fixedStickyLastRow?: boolean
  fixedHeight?: number
}

/** `MultiTableData` payload. */
export interface QqqMultiTablePayload {
  type?: string
  tableDataList?: unknown
}

/**
 * Renders one cell by column type: `html` as sanitized HTML, `block` as a QQQ
 * composite, anything else as text.
 *
 * @param column - Column metadata.
 * @param value - Cell value.
 * @param widgetMetaData - Widget metadata for nested blocks.
 * @returns The cell content.
 */
function renderCell(column: TableColumn, value: unknown, widgetMetaData: QWidgetMetaData) {
  if (value === null || value === undefined) return ''
  if (column.type === 'html') return <SafeHtml html={String(value)} as="span" />
  if (column.type === 'block' && isPlainObject(value)) {
    return <QqqComposite widgetMetaData={widgetMetaData} data={value as QqqCompositeData} />
  }
  return String(value)
}

/** Props for the table body renderer. */
interface TableBodyProps {
  widgetMetaData: QWidgetMetaData
  table: QqqTablePayload
  /** Distinguishes several tables of one multi-table widget. */
  suffix?: string
}

/**
 * Renders one `TableData`: headers, rows (paged by `rowsPerPage`), a totals-style
 * last row when `fixedStickyLastRow`, the header link, and the no-rows message.
 *
 * @param props - See {@link TableBodyProps}.
 * @returns The table, the empty message, or a payload notice.
 */
function QqqTable({ widgetMetaData, table, suffix = '' }: TableBodyProps) {
  const name = widgetMetaData.name
  const columns = asList<TableColumn>(table.columns)
  const rows = asList<Record<string, unknown>>(table.rows)
  const [page, setPage] = useState(0)
  if (!columns || !rows || columns.some((column) => !isPlainObject(column)) || rows.some((row) => !isPlainObject(row))) {
    return <WidgetPayloadNotice widgetName={name} message={payloadProblem('table', 'columns/rows')} />
  }
  const qqqId = `table-widget-${name}${suffix}`
  const header = (table.label || table.linkURL) ? (
    <div className="mb-2 flex items-baseline gap-2">
      {table.label && <h4 className="text-sm font-semibold text-foreground">{table.label}</h4>}
      {table.linkURL && <WidgetLink href={table.linkURL} className="text-sm text-primary">({table.linkText ?? table.linkURL})</WidgetLink>}
    </div>
  ) : null

  if (rows.length === 0) {
    return (
      <div data-qqq-id={qqqId}>
        {header}
        {table.noRowsFoundHTML
          ? <SafeHtml html={table.noRowsFoundHTML} className="py-4 text-center text-sm text-muted-foreground" qqqId={`widget-empty-${name}${suffix}`} />
          : <WidgetEmpty widgetName={`${name}${suffix}`}>No rows found</WidgetEmpty>}
      </div>
    )
  }

  const stickyLast = table.fixedStickyLastRow === true && rows.length > 1
  const bodyRows = stickyLast ? rows.slice(0, -1) : rows
  const perPage = table.rowsPerPage && table.rowsPerPage > 0 ? table.rowsPerPage : bodyRows.length
  const pageCount = Math.max(1, Math.ceil(bodyRows.length / perPage))
  const current = Math.min(page, pageCount - 1)
  const visible = bodyRows.slice(current * perPage, current * perPage + perPage)
  const cellClass = (column: TableColumn) => cn('px-3 py-2', column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left')

  return (
    <div data-qqq-id={qqqId}>
      {header}
      <div className="overflow-x-auto" style={table.fixedHeight ? { maxHeight: table.fixedHeight } : undefined}>
        <table className="w-full border-collapse text-sm" aria-label={table.label ?? widgetMetaData.label}>
          <thead>
            <tr className="border-b border-border">
              {columns.map((column, index) => (
                <th key={index} scope="col" className={cn(cellClass(column), 'font-semibold text-muted-foreground')} style={column.width ? { width: column.width.endsWith('fr') ? undefined : column.width } : undefined}>
                  {column.header ?? column.accessor}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/50" data-qqq-id={`table-row-${name}${suffix}-${current * perPage + rowIndex}`}>
                {columns.map((column, index) => <td key={index} className={cellClass(column)}>{renderCell(column, row[column.accessor ?? ''], widgetMetaData)}</td>)}
              </tr>
            ))}
          </tbody>
          {stickyLast && (
            <tfoot>
              <tr className="sticky bottom-0 border-t-2 border-border bg-card font-semibold" data-qqq-id={`table-total-row-${name}${suffix}`}>
                {columns.map((column, index) => <td key={index} className={cellClass(column)}>{renderCell(column, rows[rows.length - 1][column.accessor ?? ''], widgetMetaData)}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {pageCount > 1 && (
        <nav className="mt-2 flex items-center justify-end gap-2 text-sm" aria-label={`${widgetMetaData.label} pages`}>
          <button type="button" className="rounded border border-border px-2 py-1 disabled:opacity-50" disabled={current === 0} onClick={() => setPage(current - 1)} data-qqq-id={`button-table-previous-${name}${suffix}`}>Previous</button>
          <span data-qqq-id={`table-page-${name}${suffix}`}>Page {current + 1} of {pageCount}</span>
          <button type="button" className="rounded border border-border px-2 py-1 disabled:opacity-50" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)} data-qqq-id={`button-table-next-${name}${suffix}`}>Next</button>
        </nav>
      )}
    </div>
  )
}

/**
 * Renders a canonical QQQ `table` widget.
 *
 * @param props - Widget props.
 * @returns The table.
 */
export function QqqTableWidget({ widgetMetaData, data }: WidgetComponentProps<QqqTablePayload>) {
  return <QqqTable widgetMetaData={widgetMetaData} table={data} />
}

/**
 * Renders a canonical QQQ `multiTable` widget: each `TableData` in order.
 *
 * @param props - Widget props.
 * @returns The tables.
 */
export function QqqMultiTableWidget({ widgetMetaData, data }: WidgetComponentProps<QqqMultiTablePayload>) {
  const tables = asList<QqqTablePayload>(data.tableDataList)
  if (!tables || tables.some((table) => !isPlainObject(table))) {
    return <WidgetPayloadNotice widgetName={widgetMetaData.name} message={payloadProblem('multi-table', 'tableDataList')} />
  }
  if (tables.length === 0) {
    return <WidgetEmpty widgetName={widgetMetaData.name}>No tables to show</WidgetEmpty>
  }
  return (
    <div className="space-y-6" data-qqq-id={`multi-table-${widgetMetaData.name}`}>
      {tables.map((table, index) => <QqqTable key={index} widgetMetaData={widgetMetaData} table={table} suffix={`-${index}`} />)}
    </div>
  )
}
