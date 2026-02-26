'use client'

// RecordGridWidget — Read-only record table widget
// Uses DataCell from Package 2 for field-type-aware cell rendering

import React from 'react'
import { Inbox } from 'lucide-react'

import type { QFieldMetaData, QRecord } from '@/types'
import { DataCell } from '@/components/query/DataCell'

export interface RecordGridWidgetPayload {
  type: 'recordGrid'
  tableName?: string
  columns?: string[]
  // columns with full field metadata
  fields?: QFieldMetaData[]
  records: Array<{
    values: Record<string, unknown>
    displayValues?: Record<string, string>
  }>
  totalCount?: number
}

interface RecordGridWidgetProps {
  data: RecordGridWidgetPayload
  widgetName: string
}

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

  // Cast records to QRecord shape — DataCell expects the full QRecord interface
  const qRecords: QRecord[] = records.map((r, i) => ({
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

      {data.totalCount !== undefined && data.totalCount > records.length && (
        <p
          className="mt-2 text-center text-xs text-muted-foreground"
          data-qqq-id={`widget-grid-more-${widgetName}`}
        >
          Showing {records.length} of {data.totalCount.toLocaleString()} records
        </p>
      )}
    </div>
  )
}
