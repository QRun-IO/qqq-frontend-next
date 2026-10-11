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
 * CSV / XLSX / JSON exports of the whole (capped) result.
 */

'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { SqlColumn, SqlValue } from '@/types'
import { getSqlRows, sqlExportUrl } from '@/lib/api/sql-workbench'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { formatSqlValue, isBinaryValue, prettyJson, rowsToTsv } from '@/lib/utils/sql-workbench'
import { cn } from '@/lib/utils/cn'

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
        <summary className="max-w-xs cursor-pointer truncate font-mono text-xs">{value}</summary>
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
          {prettyJson(value)}
        </pre>
      </details>
    )
  }
  if (column.kind === 'boolean') return <span className="font-mono">{String(value)}</span>
  return (
    <span className={cn(column.kind === 'number' && 'font-mono tabular-nums')}>
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

  return (
    <div className="space-y-2">
      <div className="max-h-[28rem] overflow-auto rounded-md border">
        <table
          className="w-full border-collapse text-sm"
          aria-label="Query result"
          aria-busy={isFetching}
        >
          <thead className="sticky top-0 bg-muted">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className="whitespace-nowrap border-b px-2 py-1 text-left font-medium"
                  aria-sort={
                    sort?.column === index
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
                      className="inline-flex items-center gap-1 hover:underline"
                      onClick={() => toggleSort(index)}
                      title={`${column.typeName} — sort`}
                      data-qqq-id={`button-sql-sort-${index}`}
                    >
                      {column.label}
                      {sort?.column === index &&
                        (sort.dir === 'asc' ? (
                          <span aria-hidden>▲</span>
                        ) : (
                          <span aria-hidden>▼</span>
                        ))}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="odd:bg-background even:bg-muted/30">
                {columns.map((column, c) => (
                  <td
                    key={c}
                    className={cn(
                      'border-b px-2 py-1 align-top',
                      column.kind === 'number' && 'text-right'
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
        <p className="text-sm text-destructive" role="alert">
          Could not load rows: {error instanceof Error ? error.message : 'error'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Rows {from}–{to} of {rowCount}
          {truncated && (
            <span className="ml-1 text-amber-600">
              (capped by the {truncatedReason === 'BYTES' ? 'size' : 'row'} limit)
            </span>
          )}
        </span>
        {!staticRows && pages > 1 && (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              className="rounded border px-2 py-0.5 disabled:opacity-50"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              data-qqq-id="button-sql-page-prev"
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <button
              type="button"
              className="rounded border px-2 py-0.5 disabled:opacity-50"
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
              data-qqq-id="button-sql-page-next"
            >
              Next
            </button>
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border px-2 py-0.5"
            onClick={copy}
            data-qqq-id="button-sql-copy"
          >
            Copy page
          </button>
          {!staticRows &&
            (['csv', 'xlsx', 'json'] as const).map((format) => (
              <a
                key={format}
                href={sqlExportUrl(executionUuid, format)}
                download
                className="inline-flex items-center gap-1 rounded border px-2 py-0.5"
                data-qqq-id={`link-sql-export-${format}`}
              >
                {format.toUpperCase()}
              </a>
            ))}
        </span>
      </div>
    </div>
  )
}
