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
 * @file RecordListComponent — renders a RECORD_LIST process component: the
 * records held in the process run's state, paged from the process records
 * route, with the step's record-list fields as columns.
 */

'use client'

import React, { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { QFieldMetaData, QRecord } from '@/types'
import { processRecords } from '@/lib/api/processes'

import { useProcessStep } from './ProcessStepContext'
import { formatProcessValue } from './process-values'

const PAGE_SIZES = [10, 25, 50] as const

/** Props for {@link RecordListComponent}. */
export interface RecordListComponentProps {
  index: number
}

/**
 * Text for one cell: the backend display value when present, else the formatted raw value.
 * @param record - Process record.
 * @param field - Column field.
 * @returns Cell text.
 */
export function recordCellText(record: QRecord, field: QFieldMetaData): string {
  const display = record.displayValues?.[field.name]
  if (display !== undefined && display !== null) return String(display)
  return formatProcessValue(field, record.values?.[field.name])
}

/**
 * Render a RECORD_LIST component.
 * @param props - {@link RecordListComponentProps}
 * @returns The paged record table.
 */
export function RecordListComponent({ index }: RecordListComponentProps) {
  const { step, processName, processUUID } = useProcessStep()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0])
  const headingId = useId()
  const fields = step.recordListFields ?? []

  const query = useQuery({
    queryKey: ['qqq', 'processRecords', processName, processUUID, step.name, page, pageSize],
    queryFn: () => processRecords(processName, processUUID!, page * pageSize, pageSize),
    enabled: Boolean(processUUID),
    retry: false,
  })

  if (fields.length === 0) return null
  const total = query.data?.totalRecords ?? 0
  const records = query.data?.records ?? []
  const first = total === 0 ? 0 : page * pageSize + 1
  const last = Math.min(total, (page + 1) * pageSize)

  return (
    <section aria-labelledby={headingId} className="space-y-2" data-qqq-id={`process-record-list-${index}`}>
      <h4 id={headingId} className="text-sm font-semibold text-foreground">Records</h4>
      {query.isError ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>Failed to load the process records.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-qqq-id="button-retry-process-records"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border text-sm" aria-labelledby={headingId} data-qqq-id="process-record-list-table">
              <thead className="bg-muted">
                <tr>
                  {fields.map((field) => (
                    <th key={field.name} scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {query.isPending ? (
                  <tr><td colSpan={fields.length} className="px-3 py-6 text-center text-muted-foreground" role="status">Loading records...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={fields.length} className="px-3 py-6 text-center text-muted-foreground">No records</td></tr>
                ) : records.map((record, rowIndex) => (
                  <tr key={rowIndex} data-qqq-id={`process-record-row-${page * pageSize + rowIndex}`}>
                    {fields.map((field) => (
                      <td key={field.name} className="px-3 py-2 text-foreground">{recordCellText(record, field)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground" data-qqq-id="process-record-list-pagination">
            <label className="flex items-center gap-2">
              Rows per page
              <select
                value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}
                className="rounded-md border border-border bg-card px-2 py-1 text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-qqq-id="select-process-record-page-size"
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <span data-qqq-id="process-record-list-range">{`${first}–${last} of ${total}`}</span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page === 0}
              aria-label="Previous page of records"
              className="rounded-md border border-border p-1 text-foreground hover:bg-accent disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-qqq-id="button-process-records-previous"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={last >= total}
              aria-label="Next page of records"
              className="rounded-md border border-border p-1 text-foreground hover:bg-accent disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-qqq-id="button-process-records-next"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </section>
  )
}
