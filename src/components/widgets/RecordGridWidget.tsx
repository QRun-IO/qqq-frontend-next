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
 * @file RecordGridWidget — Read-only tabular record widget.
 *
 * Renders a scrollable HTML table of QQQ records using DataCell for
 * field-type-aware cell rendering. Accepts either full QFieldMetaData objects
 * or bare column name strings from the backend payload.
 */
'use client'

import React from 'react'
import { Inbox } from 'lucide-react'

import type { QFieldMetaData, QRecord } from '@/types'
import { DataCell } from '@/components/query/DataCell'

/** Wire-format payload for a record-grid widget returned by the backend API. */
export interface RecordGridWidgetPayload {
  /** Discriminator field identifying this as a record-grid widget. */
  type: 'recordGrid'
  /** Name of the QQQ table the records belong to, used for QRecord construction. */
  tableName?: string
  /** Ordered list of column names when full field metadata is not provided. */
  columns?: string[]
  /** Full QFieldMetaData objects; preferred over `columns` when present. */
  fields?: QFieldMetaData[]
  /** Array of raw record objects to display as table rows. */
  records: Array<{
    /** Raw field values keyed by field name. */
    values: Record<string, unknown>
    /** Pre-formatted display strings keyed by field name. */
    displayValues?: Record<string, string>
  }>
  /** Total number of records on the server; used to render a "showing X of Y" note. */
  totalCount?: number
}

/** Props accepted by the RecordGridWidget component. */
interface RecordGridWidgetProps {
  /** Typed payload from the widget API response. */
  data: RecordGridWidgetPayload
  /** Unique widget name used to scope data-qqq-id attributes. */
  widgetName: string
}

/** Maximum number of rows displayed inline; rows beyond this count are truncated. */
const MAX_DISPLAY_ROWS = 25

/**
 * Renders a horizontally scrollable, read-only data table of QQQ records.
 *
 * Dispatched by `WidgetRenderer` for `'recordGrid'`-type widgets.  Resolves
 * column headers from the provided `fields` metadata or, when absent, synthesizes
 * minimal `QFieldMetaData` stubs from bare `columns` name strings (using
 * `type: 'STRING'` and `label: colName`).  Uses `DataCell` for field-type-aware
 * value rendering.  Records from the payload are cast to `QRecord` shape before
 * being passed to `DataCell`.  Shows an empty-state illustration when no records
 * or columns are present.  Caps display at {@link MAX_DISPLAY_ROWS} rows and shows
 * a "View all" link to the full record-query page when the payload has more rows.
 * Also displays a "Showing X of Y records" footer when `data.totalCount` exceeds
 * the number of rows in the payload.
 *
 * @param props - Component properties; `data.fields` takes precedence over
 *   `data.columns` for column resolution; `data.records` must be non-empty for
 *   the table to render.
 * @returns A horizontally scrollable `<div>` containing a `<table>`, or an
 *   empty-state `<div>` with an inbox icon.
 */
export function RecordGridWidget({ data, widgetName }: RecordGridWidgetProps) {
  const { records, columns, fields, tableName = '' } = data

  // Build the field list for column headers + cell rendering
  // If full field metadata is provided, use it; otherwise create minimal metadata from column names
  const resolvedFields: QFieldMetaData[] = fields
    ? fields
    : (columns ?? []).map(
        (col): QFieldMetaData => ({
          name: col,
          label: col,
          type: 'STRING',
          isRequired: false,
          isEditable: false,
          isHeavy: false,
          isHidden: false,
          adornments: [],
        })
      )

  if (resolvedFields.length === 0 || records.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 py-8 text-center"
        data-qqq-id={`record-grid-empty-${widgetName}`}
      >
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">No records</p>
      </div>
    )
  }

  // Cap displayed rows to MAX_DISPLAY_ROWS to prevent oversized widget bodies
  const displayedRecords = records.slice(0, MAX_DISPLAY_ROWS)
  const hasMore = records.length > MAX_DISPLAY_ROWS

  // Cast records to QRecord shape — DataCell expects the full QRecord interface
  const qRecords: QRecord[] = displayedRecords.map((r, i) => ({
    tableName,
    recordLabel: String(r.values?.id ?? i),
    values: r.values as Record<string, unknown>,
    displayValues: (r.displayValues ?? {}) as Record<string, string>,
  }))

  return (
    <div
      className="w-full overflow-x-auto"
      data-qqq-id={`record-grid-${widgetName}`}
    >
      <table
        className="w-full border-collapse text-sm"
        aria-label={`${widgetName} record grid`}
      >
        <thead>
          <tr className="border-b border-border bg-muted">
            {resolvedFields.map((f) => (
              <th
                key={f.name}
                className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
                data-qqq-id={`widget-grid-header-${f.name}`}
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {qRecords.map((record, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-border transition-colors hover:bg-accent"
              data-qqq-id={`widget-grid-row-${widgetName}-${rowIdx}`}
            >
              {resolvedFields.map((field) => (
                <td
                  key={field.name}
                  className="px-3 py-2"
                  data-qqq-id={`widget-grid-cell-${widgetName}-${field.name}`}
                >
                  <DataCell
                    field={field}
                    value={record.values[field.name]}
                    displayValue={record.displayValues?.[field.name]}
                    record={record}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* "View all" link when rows are capped at MAX_DISPLAY_ROWS */}
      {hasMore && tableName && (
        <div className="mt-2 text-center" data-qqq-id={`widget-grid-view-all-${widgetName}`}>
          <a
            href={`/app/${tableName}`}
            className="text-sm text-primary underline hover:text-primary/80"
          >
            View all {records.length} records &rarr;
          </a>
        </div>
      )}

      {/* Server-side count footer when backend reports more records than were sent */}
      {data.totalCount !== undefined && data.totalCount > records.length && (
        <p
          className="mt-2 text-center text-xs text-muted-foreground"
          data-qqq-id={`widget-grid-more-${widgetName}`}
        >
          Showing {Math.min(displayedRecords.length, records.length)} of {data.totalCount.toLocaleString()} records
        </p>
      )}
    </div>
  )
}
