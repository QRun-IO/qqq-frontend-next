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
 * @file ColumnStatsDialog — Material's "Column Statistics" for one column of the current query:
 * aggregate statistics (count, distinct, sum, average, min, max) and the value distribution,
 * computed by the backend `columnStats` process over the active filter.
 */

'use client'

import React, { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Loader2, RefreshCw, X } from 'lucide-react'

import type { QQueryFilter } from '@/types'
import { processInit } from '@/lib/api/processes'
import { queryKeys } from '@/lib/query-client'

/** Name of the backend process that computes column statistics. */
export const COLUMN_STATS_PROCESS = 'columnStats'

/** A record in the process output (`{values, displayValues}`). */
interface StatsRecord {
  values?: Record<string, unknown>
  displayValues?: Record<string, string | null>
}

/** Parsed `columnStats` output. */
interface ColumnStatsResult {
  fields: { name: string; label: string }[]
  stats: StatsRecord
  valueCounts: StatsRecord[]
}

/**
 * Runs the column statistics process.
 *
 * @param tableName - Table queried.
 * @param fieldName - Column (`field` or `joinTable.field`).
 * @param filter - Active filter (criteria and sub-filters).
 * @param orderBy - Distribution order, e.g. `count.desc`.
 * @returns The parsed statistics.
 */
async function loadColumnStats(tableName: string, fieldName: string, filter: Partial<QQueryFilter>, orderBy: string): Promise<ColumnStatsResult> {
  const response = await processInit(COLUMN_STATS_PROCESS, {
    values: { tableName, fieldName, filterJSON: JSON.stringify(filter), orderBy },
    stepTimeoutMillis: 60 * 1000,
  })
  if ('error' in response && response.error) throw new Error(response.userFacingError ?? response.error)
  if (!('values' in response)) throw new Error('Column statistics did not complete.')
  const values = response.values ?? {}
  return {
    fields: ((values.statsFields as { name: string; label: string }[] | undefined) ?? []).filter((f) => f && f.name),
    stats: (values.statsRecord as StatsRecord | undefined) ?? {},
    valueCounts: (values.valueCounts as StatsRecord[] | undefined) ?? [],
  }
}

/**
 * Props for ColumnStatsDialog.
 */
interface ColumnStatsDialogProps {
  /** Table queried. */
  tableName: string
  /** Column name, or null when closed. */
  fieldName: string | null
  /** Column label. */
  fieldLabel: string
  /** The query's filter (paging ignored). */
  filter: QQueryFilter
  /** Closes the dialog. */
  onClose: () => void
}

/**
 * Column statistics dialog.
 *
 * @param props - Component properties.
 * @returns The dialog.
 */
export function ColumnStatsDialog({ tableName, fieldName, fieldLabel, filter, onClose }: ColumnStatsDialogProps) {
  const [orderBy, setOrderBy] = useState('count.desc')
  const { skip: _skip, limit: _limit, orderBys: _orderBys, ...criteria } = filter
  void _skip
  void _limit
  void _orderBys
  const statsQuery = useQuery({
    queryKey: [...queryKeys.tableRecords(tableName), 'columnStats', fieldName, JSON.stringify(criteria), orderBy],
    queryFn: () => loadColumnStats(tableName, fieldName!, criteria, orderBy),
    enabled: fieldName !== null,
    retry: false,
    staleTime: 0,
  })
  const data = statsQuery.data
  const statsFields = data?.fields ?? []
  const distinct = Number(data?.stats.values?.countDistinct ?? NaN)
  const rows = data?.valueCounts ?? []
  const sortBy = (column: 'count' | 'value') => {
    const key = column === 'count' ? 'count' : fieldName
    setOrderBy((current) => (current === `${key}.desc` ? `${key}.asc` : `${key}.desc`))
  }
  const arrow = (key: string | null) => (orderBy === `${key}.asc` ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : orderBy === `${key}.desc` ? <ArrowDown className="h-3 w-3" aria-hidden="true" /> : null)

  return (
    <DialogPrimitive.Root open={fieldName !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content aria-describedby={undefined} data-qqq-id="dialog-column-stats"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card shadow-lg focus:outline-none">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">Column Statistics for {fieldLabel}</DialogPrimitive.Title>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => statsQuery.refetch()} disabled={statsQuery.isFetching} data-qqq-id="button-column-stats-refresh"
                className="flex items-center gap-1 rounded border border-input px-2 py-1 text-sm hover:bg-accent disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
              </button>
              <DialogPrimitive.Close className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {statsQuery.isFetching && !data && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Calculating statistics...</p>
            )}
            {statsQuery.isError && (
              <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {statsQuery.error instanceof Error ? statsQuery.error.message : 'Column statistics could not be calculated.'}
              </p>
            )}
            {data && (
              <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
                <div>
                  <table className="w-full text-sm" aria-label={`${fieldLabel} values`}>
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th scope="col" className="py-2">
                          <button type="button" onClick={() => sortBy('value')} className="flex items-center gap-1 font-semibold focus:outline-none focus:ring-1 focus:ring-ring">{fieldLabel}{arrow(fieldName)}</button>
                        </th>
                        <th scope="col" className="py-2 text-right">
                          <button type="button" onClick={() => sortBy('count')} className="ml-auto flex items-center gap-1 font-semibold focus:outline-none focus:ring-1 focus:ring-ring">Count{arrow('count')}</button>
                        </th>
                        <th scope="col" className="py-2 text-right font-semibold">Percent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-b border-border" data-qqq-id="column-stats-row">
                          <td className="py-1.5" data-qqq-id="column-stats-value">{(row.displayValues?.[fieldName!] ?? String(row.values?.[fieldName!] ?? '')) || '—'}</td>
                          <td className="py-1.5 text-right tabular-nums" data-qqq-id="column-stats-count">{String(row.values?.count ?? '')}</td>
                          <td className="py-1.5 text-right tabular-nums" data-qqq-id="column-stats-percent">{row.displayValues?.percent ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-muted-foreground" data-qqq-id="column-stats-summary">
                    {Number.isFinite(distinct) && rows.length < distinct
                      ? `Showing the first ${rows.length.toLocaleString()} of ${distinct.toLocaleString()} values`
                      : rows.length === 1 ? 'Showing the only value' : `Showing all ${rows.length.toLocaleString()} values`}
                  </p>
                </div>
                <dl className="space-y-2 text-sm" aria-label="Statistics" data-qqq-id="column-stats-summary-values">
                  {statsFields.map((f) => (
                    <div key={f.name} className="flex justify-between gap-4 border-b border-border pb-1">
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd className="font-medium tabular-nums" data-qqq-id={`column-stats-stat-${f.name}`}>{data.stats.displayValues?.[f.name] ?? String(data.stats.values?.[f.name] ?? '')}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
