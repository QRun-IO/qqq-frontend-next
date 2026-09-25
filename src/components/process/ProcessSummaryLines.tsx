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
 * @file ProcessSummaryLines — renders QQQ process summary lines
 * (`validationSummary` / `processResults` values): status icon, count and
 * message, an optional link to the affected records, record/filter links and
 * bullet text.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Check, Info, OctagonAlert, ExternalLink } from 'lucide-react'

import type { QQueryFilter, QTableMetaData } from '@/types'
import { serializeFilter } from '@/lib/utils/filter-utils'
import { cn } from '@/lib/utils/cn'

/** One process summary line as serialized by the backend (`ProcessSummaryLine` / `ProcessSummaryRecordLink`). */
export interface ProcessSummaryLineData {
  status?: 'OK' | 'INFO' | 'WARNING' | 'ERROR' | string
  count?: number | null
  message?: string | null
  primaryKeys?: unknown[] | null
  bulletsOfText?: unknown[] | null
  tableName?: string | null
  recordId?: unknown
  filter?: unknown
  linkPreText?: string | null
  linkText?: string | null
  linkPostText?: string | null
}

/**
 * Read a list of summary lines from a process value.
 * @param value - The `validationSummary` or `processResults` value.
 * @returns The lines (empty when absent or malformed).
 */
export function readSummaryLines(value: unknown): ProcessSummaryLineData[] {
  return Array.isArray(value) ? value.filter((line): line is ProcessSummaryLineData => Boolean(line) && typeof line === 'object') : []
}

const STATUS_STYLE: Record<string, { className: string; label: string }> = {
  OK: { className: 'text-green-600', label: 'OK' },
  INFO: { className: 'text-sky-600', label: 'Info' },
  WARNING: { className: 'text-amber-600', label: 'Warning' },
  ERROR: { className: 'text-destructive', label: 'Error' },
}

/**
 * The status icon for a line.
 * @param props - Line status, and whether this is the result screen (OK shows a check there, an arrow before processing).
 * @returns The icon element.
 */
function StatusIcon({ status, isResultScreen }: { status?: string; isResultScreen: boolean }) {
  const className = cn('mt-0.5 h-5 w-5 flex-shrink-0', STATUS_STYLE[status ?? '']?.className ?? 'text-muted-foreground')
  switch (status) {
    case 'OK': return isResultScreen ? <Check className={className} aria-hidden="true" /> : <ArrowRight className={className} aria-hidden="true" />
    case 'INFO': return <Info className={className} aria-hidden="true" />
    case 'WARNING': return <AlertTriangle className={className} aria-hidden="true" />
    case 'ERROR': return <OctagonAlert className={className} aria-hidden="true" />
    default: return <span className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
  }
}

/**
 * Link to the records a count line covers, when the table and keys allow it.
 * @param table - The table the keys belong to.
 * @param primaryKeys - Keys from the line.
 * @returns The query URL, or `null`.
 */
export function summaryRecordsHref(table: QTableMetaData | undefined, primaryKeys: unknown[] | null | undefined): string | null {
  const keys = (primaryKeys ?? []).filter((key) => key !== null && key !== undefined)
  if (!table?.primaryKeyField || keys.length === 0) return null
  const filter: QQueryFilter = {
    criteria: [{ fieldName: table.primaryKeyField, operator: 'IN', values: keys as QQueryFilter['criteria'][number]['values'] }],
    orderBys: [], subFilters: [], booleanOperator: 'AND', skip: 0, limit: 25,
  }
  const href = `/app/${encodeURIComponent(table.name)}?filter=${encodeURIComponent(serializeFilter(filter))}`
  return href.length > 2048 ? null : href
}

/** Props for {@link ProcessSummaryLines}. */
export interface ProcessSummaryLinesProps {
  lines: ProcessSummaryLineData[]
  /** Table the counted records belong to (the process's source table). */
  table?: QTableMetaData
  isResultScreen?: boolean
}

/**
 * Render a list of process summary lines.
 * @param props - {@link ProcessSummaryLinesProps}
 * @returns The list, or nothing when there are no lines.
 */
export function ProcessSummaryLines({ lines, table, isResultScreen = false }: ProcessSummaryLinesProps) {
  if (lines.length === 0) return null
  return (
    <ul className="space-y-3" data-qqq-id="process-summary-lines">
      {lines.map((line, index) => {
        const status = typeof line.status === 'string' ? line.status : undefined
        const statusLabel = STATUS_STYLE[status ?? '']?.label
        let body: React.ReactNode
        if (line.tableName && (line.recordId !== undefined && line.recordId !== null || line.filter)) {
          const href = line.recordId !== undefined && line.recordId !== null
            ? `/app/${encodeURIComponent(line.tableName)}/${encodeURIComponent(String(line.recordId))}`
            : `/app/${encodeURIComponent(line.tableName)}?filter=${encodeURIComponent(serializeFilter(line.filter as QQueryFilter))}`
          body = (
            <span>
              {line.linkPreText ?? ''}
              <Link href={href} className="text-primary underline hover:text-primary/80">{line.linkText ?? line.tableName}</Link>
              {line.linkPostText ?? ''}
            </span>
          )
        } else {
          const count = typeof line.count === 'number' ? `${line.count.toLocaleString('en-US')} ` : ''
          const recordsHref = summaryRecordsHref(table, line.primaryKeys)
          body = (
            <span>
              {`${count}${line.message ?? ''}`}
              {recordsHref && (
                <a
                  href={recordsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`See these ${table?.label ?? ''} records in a new tab`}
                  className="ml-1 inline-flex items-center justify-center align-middle text-primary hover:text-primary/80 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  data-qqq-id={`process-summary-records-link-${index}`}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
              {Array.isArray(line.bulletsOfText) && line.bulletsOfText.length > 0 && (
                <ul className="ml-6 mt-1 list-disc">
                  {line.bulletsOfText.map((bullet, bulletIndex) => <li key={bulletIndex}>{String(bullet)}</li>)}
                </ul>
              )}
            </span>
          )
        }
        return (
          <li key={index} className="flex items-start gap-2 text-sm text-foreground" data-qqq-id={`process-summary-line-${index}`} data-status={status}>
            <StatusIcon status={status} isResultScreen={isResultScreen} />
            {statusLabel && <span className="sr-only">{statusLabel}: </span>}
            {body}
          </li>
        )
      })}
    </ul>
  )
}
