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
 * @file ResultGrid — typed, sortable, paginated view of a workbench result. The first page comes
 * with the run; later pages and sorts are read from the server's cached copy of the result
 * (`GET /executions/{uuid}/rows`), so SQL never re-runs. Copies the page as TSV and links the
 * CSV / Excel / JSON exports of the whole (capped) result from an Export menu.
 */

'use client'

import React, { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'

import type { SqlColumn, SqlColumnKind, SqlExportFormat, SqlValue } from '@/types'
import { getSqlRows, sqlExportUrl } from '@/lib/api/sql-workbench'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { formatSqlValue, isBinaryValue, prettyJson, rowsToTsv } from '@/lib/utils/sql-workbench'
import { cn } from '@/lib/utils/cn'
import {
  ALERT_CLASS,
  buttonClass,
  MENU_CONTENT_CLASS,
  MENU_ITEM_CLASS,
} from '@/components/ui/controls'

/** Column kinds aligned right (as numbers are in the record grid). */
const RIGHT_ALIGNED = new Set<SqlColumnKind>(['number'])

/** Column kinds kept on one line. */
const NO_WRAP = new Set<SqlColumnKind>(['number', 'boolean', 'date', 'datetime', 'time'])

/** The export formats, with plain labels. */
const EXPORT_FORMATS: { format: SqlExportFormat; label: string }[] = [
  { format: 'csv', label: 'CSV' },
  { format: 'xlsx', label: 'Excel (XLSX)' },
  { format: 'json', label: 'JSON' },
]

/** Props for {@link ResultGrid}. */
export interface ResultGridProps {
  executionUuid: string
  columns: SqlColumn[]
  firstPage: SqlValue[][]
  rowCount: number
  pageSize: number
  truncated?: boolean
  truncatedReason?: 'ROWS' | 'BYTES' | null
  /** Hide paging/sort/export (pinned snapshots, which have no cached result). */
  staticRows?: boolean
}

/**
 * Renders one cell value by its column kind.
 *
 * @param props - Component props.
 * @param props.value - The value.
 * @param props.column - Its column.
 * @returns The cell content.
 */
export function SqlValueCell({ value, column }: { value: SqlValue; column: SqlColumn }) {
  if (value === null) return <span className="italic text-muted-foreground">NULL</span>
  if (isBinaryValue(value)) {
    return (
      <span
        className="text-muted-foreground"
        title={`0x${value.hexPreview}${value.length > value.hexPreview.length / 2 ? '…' : ''}`}
      >
        {formatSqlValue(value)}
      </span>
    )
  }
  if (column.kind === 'json' && typeof value === 'string') {
    return (
      <details>
        <summary className="max-w-xs cursor-pointer truncate font-mono text-xs text-foreground">
          {value}
        </summary>
        <pre className="mt-1 max-w-md whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-2 font-mono text-xs text-foreground">
          {prettyJson(value)}
        </pre>
      </details>
    )
  }
  if (column.kind === 'boolean') return <span className="font-mono">{String(value)}</span>
  return (
    <span
      className={cn(
        (column.kind === 'number' || NO_WRAP.has(column.kind)) && 'tabular-nums',
        column.kind === 'number' && 'font-mono'
      )}
    >
      {formatSqlValue(value)}
    </span>
  )
}

/**
 * Renders the grid.
 *
 * @param props - Component props.
 * @returns The table with paging and export controls.
 */
export function ResultGrid(props: ResultGridProps) {
  const {
    executionUuid,
    columns,
    firstPage,
    rowCount,
    pageSize,
    truncated,
    truncatedReason,
    staticRows = false,
  } = props
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ column: number; dir: 'asc' | 'desc' } | null>(null)
  const pages = Math.max(1, Math.ceil(rowCount / pageSize))
  const needsFetch = !staticRows && (page > 0 || sort !== null)

  const { data, isFetching, error } = useQuery({
    queryKey: [
      ...queryKeys.sqlWorkbench(),
      'rows',
      executionUuid,
      page,
      pageSize,
      sort?.column ?? null,
      sort?.dir ?? null,
    ],
    queryFn: () => getSqlRows(executionUuid, page * pageSize, pageSize, sort?.column, sort?.dir),
    enabled: needsFetch,
    meta: HANDLES_OWN_ERRORS,
  })
  const rows = needsFetch ? (data?.rows ?? []) : firstPage

  const toggleSort = (index: number) => {
    setPage(0)
    setSort((current) =>
      current?.column !== index
        ? { column: index, dir: 'asc' }
        : current.dir === 'asc'
          ? { column: index, dir: 'desc' }
          : null
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rowsToTsv(columns, rows))
      toast.success(`Copied ${rows.length} rows`)
    } catch {
      toast.error('Could not copy to the clipboard')
    }
  }

  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">The statement returned no rows.</p>
  }

  const from = rowCount === 0 ? 0 : page * pageSize + 1
  const to = Math.min(rowCount, (page + 1) * pageSize)

  // The record grid's look (DataGrid, standard density): muted header, bordered rows, row hover.
  // Only the grid scrolls sideways or down, inside its own box; the page never does.
  return (
    <div className="space-y-2">
      <div
        className="relative max-h-[32rem] w-full overflow-auto rounded-md border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="region"
        aria-label="Query result rows"
        data-qqq-id="grid-sql-result"
      >
        {isFetching && (
          <div className="sticky left-0 top-0 z-[4] h-0.5 w-full overflow-hidden bg-primary/20">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        )}
        <table
          className="w-full border-collapse text-sm"
          aria-label="Query result"
          aria-busy={isFetching}
        >
          <thead className="sticky top-0 z-[3]">
            <tr className="border-b border-border bg-muted">
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap bg-muted px-4 py-2 text-left align-top font-semibold text-foreground',
                    column.kind === 'number' && 'text-right'
                  )}
                  aria-sort={
                    staticRows
                      ? undefined
                      : sort?.column === index
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                  }
                >
                  {staticRows ? (
                    <span title={column.typeName}>{column.label}</span>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => toggleSort(index)}
                      title={`${column.typeName}: select to sort`}
                      data-qqq-id={`button-sql-sort-${index}`}
                    >
                      {column.label}
                      {sort?.column === index &&
                        (sort.dir === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-primary" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-primary" aria-hidden="true" />
                        ))}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr
                key={r}
                className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/50"
              >
                {columns.map((column, c) => (
                  <td
                    key={c}
                    className={cn(
                      'px-4 py-2 align-top text-foreground',
                      RIGHT_ALIGNED.has(column.kind) && 'text-right',
                      NO_WRAP.has(column.kind) && 'whitespace-nowrap'
                    )}
                  >
                    <SqlValueCell value={row[c] ?? null} column={column} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p className={ALERT_CLASS} role="alert">
          Could not load rows: {error instanceof Error ? error.message : 'error'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>
          Rows {from.toLocaleString()}–{to.toLocaleString()} of {rowCount.toLocaleString()}
          {truncated && (
            <span className="ml-1 font-medium text-amber-800 dark:text-amber-300">
              (capped by the {truncatedReason === 'BYTES' ? 'size' : 'row'} limit)
            </span>
          )}
        </span>
        {!staticRows && pages > 1 && (
          <span className="inline-flex items-center gap-2">
            <button
              type="button"
              className={buttonClass('secondary', 'sm')}
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              data-qqq-id="button-sql-page-prev"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </button>
            <span className="whitespace-nowrap">
              Page {page + 1} of {pages}
            </span>
            <button
              type="button"
              className={buttonClass('secondary', 'sm')}
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
              data-qqq-id="button-sql-page-next"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        )}
        <span className="inline-flex items-center gap-2 @lg:ml-auto">
          <button
            type="button"
            className={buttonClass('secondary', 'sm')}
            onClick={copy}
            data-qqq-id="button-sql-copy"
          >
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            Copy page
          </button>
          {!staticRows && (
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={buttonClass('secondary', 'sm')}
                  data-qqq-id="button-sql-export"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  collisionPadding={8}
                  className={MENU_CONTENT_CLASS}
                  aria-label="Export formats"
                >
                  {EXPORT_FORMATS.map(({ format, label }) => (
                    <DropdownMenu.Item key={format} asChild>
                      <a
                        href={sqlExportUrl(executionUuid, format)}
                        download
                        className={MENU_ITEM_CLASS}
                        data-qqq-id={`link-sql-export-${format}`}
                      >
                        {label}
                      </a>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </span>
      </div>
    </div>
  )
}
