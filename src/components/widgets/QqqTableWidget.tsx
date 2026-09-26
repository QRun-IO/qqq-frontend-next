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
 *
 * Parity reference: Material dashboard `DataTable.tsx`, `TableWidget.tsx`, `TableCard.tsx`
 * and `ImageCell.tsx`: typed cells (default numbers with thousands separators, html,
 * htmlAndTooltip, composite, block, image, hidden helper columns), expandable sub-rows,
 * `fr` column widths, a sticky header, column-header help, paging (10 rows unless the
 * payload says otherwise) with numbered pages or a jump-to-page input and an optional
 * entries-per-page select, and in a multi-table widget an export button and footer per table.
 */
'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import type { QHelpContent, QWidgetHelpContent, QWidgetMetaData } from '@/types'
import { useHelpHelpActive } from '@/lib/context/q-context'
import { cn } from '@/lib/utils/cn'
import { selectSlotHelpContent, WIDGET_HELP_ROLES } from '@/lib/utils/help-utils'
import { HelpContent } from '@/components/records/HelpContent'
import type { QqqCompositeData, WidgetComponentProps } from './widget-types'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import { HoverTooltip } from './HoverTooltip'
import { SafeHtml } from './SafeHtml'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { WidgetLink } from './QqqStatisticsWidgets'
import { QqqComposite } from './blocks/QqqComposite'
import { downloadText, widgetCsvToString, widgetExportFileName } from './widget-utils'
import {
  DEFAULT_TABLE_PAGE_SIZE, HIDDEN_COLUMN_TYPE, MAX_NUMBERED_PAGES, minTableWidth, pageSizeOptions, resolveColumnWidths, tableExportCsv,
} from './table-widget-utils'
import type { TableWidgetColumn } from './table-widget-utils'

/** A table row: accessor values, plus optional nested `subRows`. */
type TableRow = Record<string, unknown>

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
  footerHTML?: string
  csvData?: unknown
}

/** `MultiTableData` payload. */
export interface QqqMultiTablePayload {
  type?: string
  tableDataList?: unknown
}

/** Classes that make a table control a 44 x 44 px target on touch screens. */
const TOUCH = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11'

/**
 * The help entries a widget declares for one slot (the full-route slot map).
 *
 * @param helpContent - Widget metadata help content.
 * @param slot - Slot name, e.g. `columnHeader=name`.
 * @returns The slot's entries.
 */
function slotHelp(helpContent: QWidgetMetaData['helpContent'], slot: string): QHelpContent[] {
  if (!helpContent || 'content' in helpContent) return []
  const entries = (helpContent as Record<string, QWidgetHelpContent[]>)[slot]
  return Array.isArray(entries) ? entries : []
}

/**
 * Renders an `image` cell (Material `ImageCell`): the row's `imageUrl` at 50 px wide, its
 * `imageLabel`, and `imageTotal` (thousands separators, success color) with `imageTotalType`.
 *
 * @param props - Component properties.
 * @param props.row - The row, whose helper values drive the cell.
 * @returns The image cell.
 */
function ImageCell({ row }: { row: TableRow }) {
  const url = typeof row.imageUrl === 'string' ? row.imageUrl : ''
  const label = row.imageLabel === null || row.imageLabel === undefined ? '' : String(row.imageLabel)
  const total = row.imageTotal
  return (
    <span className="flex items-center gap-4 pr-4" data-qqq-id="table-image-cell">
      <span className="w-[50px] flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary backend-supplied URL, static export */}
        {url && <img src={url} alt={label} className="max-w-full" />}
      </span>
      <span className="flex flex-col">
        <span className="font-medium text-foreground">{label}</span>
        {total !== null && total !== undefined && total !== '' && total !== 0 && (
          <span className="text-muted-foreground">
            <span className="text-[var(--qqq-success-color,#2E7D32)]">{typeof total === 'number' ? total.toLocaleString() : String(total)}</span>
            {row.imageTotalType ? ` ${String(row.imageTotalType)}` : ''}
          </span>
        )}
      </span>
    </span>
  )
}

/**
 * Renders one cell by column type, as Material's `DataTable` does: `html` as sanitized HTML,
 * `htmlAndTooltip` as sanitized HTML with the row's `tooltip` HTML on hover, focus or tap,
 * `composite` and `block` as QQQ composites, `image` from the row's image helper values, and
 * anything else as text (numbers with thousands separators).
 *
 * @param props - Component properties.
 * @param props.column - Column metadata.
 * @param props.row - The row.
 * @param props.widgetMetaData - Widget metadata for nested blocks.
 * @param props.qqqId - `data-qqq-id` scope of the cell.
 * @returns The cell content.
 */
function CellContent({ column, row, widgetMetaData, qqqId }: { column: TableWidgetColumn; row: TableRow; widgetMetaData: QWidgetMetaData; qqqId: string }) {
  if (column.type === 'image') return <ImageCell row={row} />
  const value = row[column.accessor ?? '']
  if (value === null || value === undefined) return null
  if (column.type === 'html') return <SafeHtml html={String(value)} as="span" />
  if (column.type === 'htmlAndTooltip') {
    const tooltip = row.tooltip === null || row.tooltip === undefined ? '' : String(row.tooltip)
    const html = <SafeHtml html={String(value)} as="span" />
    return tooltip
      ? <HoverTooltip qqqId={`${qqqId}-tooltip`} content={<SafeHtml html={tooltip} as="span" />}>{html}</HoverTooltip>
      : html
  }
  if ((column.type === 'composite' || column.type === 'block') && isPlainObject(value)) {
    return <QqqComposite widgetMetaData={widgetMetaData} data={value as QqqCompositeData} />
  }
  if (isPlainObject(value) || Array.isArray(value)) return null
  return <>{typeof value === 'number' && value !== 0 ? value.toLocaleString() : String(value)}</>
}

/** Props for the table body renderer. */
interface TableBodyProps {
  widgetMetaData: QWidgetMetaData
  table: QqqTablePayload
  /** Distinguishes several tables of one multi-table widget. */
  suffix?: string
  /** Renders this table's own export button and footer (each table of a multi-table widget). */
  ownChrome?: boolean
}

/**
 * Renders one `TableData`: headers (with column-header help), rows paged by `rowsPerPage`
 * (10 when unset), expandable sub-rows, a totals-style last row when `fixedStickyLastRow`,
 * the header link, paging controls and the no-rows message.
 *
 * @param props - See {@link TableBodyProps}.
 * @returns The table, the empty message, or a payload notice.
 */
function QqqTable({ widgetMetaData, table, suffix = '', ownChrome = false }: TableBodyProps) {
  const name = widgetMetaData.name
  const allColumns = asList<TableWidgetColumn>(table.columns)
  const rows = asList<TableRow>(table.rows)
  const helpHelpActive = useHelpHelpActive()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number | null>(null)
  const [pageDraft, setPageDraft] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  if (!allColumns || !rows || allColumns.some((column) => !isPlainObject(column)) || rows.some((row) => !isPlainObject(row))) {
    return <WidgetPayloadNotice widgetName={name} message={payloadProblem('table', 'columns/rows')} />
  }
  const qqqId = `table-widget-${name}${suffix}`
  const tableLabel = table.label ?? widgetMetaData.label

  const handleExport = () => {
    const csvData = Array.isArray(table.csvData) && table.csvData.every((row) => Array.isArray(row)) ? table.csvData as unknown[][] : null
    if (!csvData && rows.length === 0) {
      setExportMessage('There is no data available to export.')
      return
    }
    setExportMessage(null)
    downloadText(widgetExportFileName(tableLabel), csvData ? widgetCsvToString(csvData) : tableExportCsv(allColumns, rows))
  }

  const header = (table.label || table.linkURL || (ownChrome && widgetMetaData.showExportButton)) ? (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {table.label && <h4 className="text-sm font-semibold text-foreground">{table.label}</h4>}
      {table.linkURL && <WidgetLink href={table.linkURL} className="text-sm text-primary">({table.linkText ?? table.linkURL})</WidgetLink>}
      {ownChrome && widgetMetaData.showExportButton && (
        <button
          type="button"
          onClick={handleExport}
          aria-label={`Export ${tableLabel}`}
          className={cn('ml-auto inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring', TOUCH)}
          data-qqq-id={`button-table-export-${name}${suffix}`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  ) : null
  const exportStatus = exportMessage && (
    <p role="status" className="mb-2 text-sm text-muted-foreground" data-qqq-id={`table-export-message-${name}${suffix}`}>{exportMessage}</p>
  )
  const footer = ownChrome && table.footerHTML
    ? <SafeHtml html={table.footerHTML} className="mt-2 text-sm text-muted-foreground" qqqId={`table-footer-${name}${suffix}`} />
    : null

  if (rows.length === 0) {
    return (
      <div data-qqq-id={qqqId}>
        {header}
        {exportStatus}
        {table.noRowsFoundHTML
          ? <SafeHtml html={table.noRowsFoundHTML} className="py-4 text-center text-sm text-muted-foreground" qqqId={`widget-empty-${name}${suffix}`} />
          : <WidgetEmpty widgetName={`${name}${suffix}`}>No rows found</WidgetEmpty>}
        {footer}
      </div>
    )
  }

  const columns = allColumns.filter((column) => column.type !== HIDDEN_COLUMN_TYPE)
  const hasSubRows = rows.some((row) => Array.isArray(row.subRows) && row.subRows.length > 0)
  // the 60px expander column (Material) is one of the fixed widths the fr columns share around
  const declaredWidths = [...columns.map((column) => column.width), ...(hasSubRows ? ['60px'] : [])]
  const widths = resolveColumnWidths(declaredWidths)
  const stickyLast = table.fixedStickyLastRow === true && rows.length > 1
  const bodyRows = stickyLast ? rows.slice(0, -1) : rows
  const perPage = pageSize ?? (table.rowsPerPage && table.rowsPerPage > 0 ? table.rowsPerPage : DEFAULT_TABLE_PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(bodyRows.length / perPage))
  const current = Math.min(page, pageCount - 1)
  const visible = bodyRows.slice(current * perPage, current * perPage + perPage)
  const showPageSize = table.hidePaginationDropdown === false
  const cellClass = (column: TableWidgetColumn) => cn('px-3 py-2', column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
    column.verticalAlign === 'top' ? 'align-top' : column.verticalAlign === 'bottom' ? 'align-bottom' : column.verticalAlign === 'middle' ? 'align-middle' : 'align-top')

  const toggle = (key: string) => setExpanded((previous) => {
    const next = new Set(previous)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  /**
   * Renders a row and, when it is expanded, its sub-rows (recursively), shaded as Material does.
   *
   * @param row - The row.
   * @param key - Stable key: the row's position path (e.g. `3` or `3.1`).
   * @param depth - Nesting depth (0 for a top-level row).
   * @returns The row elements.
   */
  const renderRow = (row: TableRow, key: string, depth: number): React.ReactNode => {
    const subRows = Array.isArray(row.subRows) ? (row.subRows as unknown[]).filter(isPlainObject) as TableRow[] : []
    const isExpanded = expanded.has(key)
    const shaded = depth > 0 || isExpanded
    const rowId = `${name}${suffix}-${key}`
    return (
      <React.Fragment key={key}>
        <tr
          className={cn('border-b border-border/50', shaded && 'bg-muted/40')}
          data-qqq-id={`table-row-${rowId}`}
          data-depth={depth}
        >
          {columns.map((column, index) => (
            <td key={index} className={cellClass(column)}>
              <CellContent column={column} row={row} widgetMetaData={widgetMetaData} qqqId={`table-cell-${rowId}-${index}`} />
            </td>
          ))}
          {hasSubRows && (
            <td className="w-[60px] px-1 py-1 text-right align-top">
              {subRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} row ${key.split('.').map((part) => Number(part) + 1).join('.')}`}
                  className={cn('inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring', TOUCH)}
                  data-qqq-id={`button-table-expand-${rowId}`}
                >
                  {isExpanded ? <ChevronDown className="h-5 w-5" aria-hidden="true" /> : <ChevronLeft className="h-5 w-5" aria-hidden="true" />}
                </button>
              )}
            </td>
          )}
        </tr>
        {isExpanded && subRows.map((subRow, index) => renderRow(subRow, `${key}.${index}`, depth + 1))}
      </React.Fragment>
    )
  }

  const pageButtons = Array.from({ length: pageCount }, (_, index) => index)
  const goTo = (index: number) => {
    setPage(index)
    setPageDraft(null)
  }

  return (
    <div data-qqq-id={qqqId}>
      {header}
      {exportStatus}
      {showPageSize && (
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <select
            value={perPage}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              goTo(0)
            }}
            aria-label="Entries per page"
            className={cn('rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring', TOUCH)}
            data-qqq-id={`select-table-page-size-${name}${suffix}`}
          >
            {pageSizeOptions(perPage).map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span aria-hidden="true">entries per page</span>
        </div>
      )}
      <div className="overflow-auto" style={table.fixedHeight ? { maxHeight: table.fixedHeight } : undefined}>
        <table
          className={cn('w-full border-collapse text-sm', widths && 'table-fixed')}
          style={widths ? { minWidth: minTableWidth(declaredWidths) } : undefined}
          aria-label={table.label ?? widgetMetaData.label}
        >
          {widths && (
            <colgroup>
              {widths.map((width, index) => <col key={index} style={{ width }} />)}
            </colgroup>
          )}
          <thead>
            <tr className="border-b border-border">
              {columns.map((column, index) => {
                // column-header help (Material TableWidget: the `columnHeader=<accessor>` slot)
                const slot = `columnHeader=${column.accessor ?? ''}`
                const help = selectSlotHelpContent(slotHelp(widgetMetaData.helpContent, slot), WIDGET_HELP_ROLES, `widget:${name};slot:${slot}`, helpHelpActive)
                const text = column.header ?? column.accessor
                return (
                  <th key={index} scope="col" className={cn(cellClass(column), 'sticky top-0 z-[1] bg-card align-bottom font-semibold text-muted-foreground')}>
                    {help
                      ? <HoverTooltip qqqId={`table-header-help-${name}${suffix}-${column.accessor ?? index}`} content={<HelpContent helpContent={help} />}>{text}</HoverTooltip>
                      : text}
                  </th>
                )
              })}
              {hasSubRows && <th scope="col" className="sticky top-0 z-[1] bg-card"><span className="sr-only">Details</span></th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => renderRow(row, String(current * perPage + rowIndex), 0))}
          </tbody>
          {stickyLast && (
            <tfoot>
              <tr className="sticky bottom-0 border-t-2 border-border bg-card font-semibold" data-qqq-id={`table-total-row-${name}${suffix}`}>
                {columns.map((column, index) => (
                  <td key={index} className={cellClass(column)}>
                    <CellContent column={column} row={rows[rows.length - 1]} widgetMetaData={widgetMetaData} qqqId={`table-total-cell-${name}${suffix}-${index}`} />
                  </td>
                ))}
                {hasSubRows && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {pageCount > 1 && (
        <nav className="mt-2 flex flex-wrap items-center justify-end gap-1 text-sm" aria-label={`${tableLabel} pages`} data-qqq-id={`table-pagination-${name}${suffix}`}>
          <span className="sr-only" aria-live="polite" data-qqq-id={`table-page-${name}${suffix}`}>Page {current + 1} of {pageCount}</span>
          {current > 0 && (
            <button type="button" onClick={() => goTo(current - 1)} aria-label="Previous page"
              className={cn('inline-flex items-center justify-center rounded-full border border-border p-1 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring', TOUCH)}
              data-qqq-id={`button-table-previous-${name}${suffix}`}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {pageCount > MAX_NUMBERED_PAGES ? (
            <input
              type="number"
              min={1}
              max={pageCount}
              value={pageDraft ?? String(current + 1)}
              onChange={(event) => {
                setPageDraft(event.target.value)
                const target = Number(event.target.value)
                if (Number.isInteger(target) && target >= 1 && target <= pageCount) setPage(target - 1)
              }}
              onBlur={() => setPageDraft(null)}
              aria-label={`Go to page (1 to ${pageCount})`}
              className={cn('w-20 rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring', TOUCH)}
              data-qqq-id={`input-table-page-${name}${suffix}`}
            />
          ) : pageButtons.map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Page ${index + 1}`}
              aria-current={index === current ? 'page' : undefined}
              className={cn('inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring', TOUCH,
                index === current ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent')}
              data-qqq-id={`button-table-page-${name}${suffix}-${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
          {current < pageCount - 1 && (
            <button type="button" onClick={() => goTo(current + 1)} aria-label="Next page"
              className={cn('inline-flex items-center justify-center rounded-full border border-border p-1 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring', TOUCH)}
              data-qqq-id={`button-table-next-${name}${suffix}`}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </nav>
      )}
      {footer}
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
 * Renders a canonical QQQ `multiTable` widget: each `TableData` in order, each with its own
 * label, link, export button (when the widget shows one) and footer, as Material renders one
 * full table widget per entry.
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
      {tables.map((table, index) => <QqqTable key={index} widgetMetaData={widgetMetaData} table={table} suffix={`-${index}`} ownChrome />)}
    </div>
  )
}
