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
 * @file RecordCardView — card-based rendering of records for mobile viewports.
 * Displays each record as a card with key-value pairs, selection checkbox, and click-to-navigate.
 */

'use client'

// RecordCardView — card-based rendering of records for mobile viewports
// Displays each record as a card with key-value pairs, selection checkbox, and click-to-navigate

import React, { useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { RowSelectionState } from '@tanstack/react-table'
import { Inbox } from 'lucide-react'

import type { QTableMetaData, QRecord, QFieldMetaData } from '@/types'
import { getQueryColumns, orderColumns } from '@/lib/utils/query-columns'
import { isColumnVisible } from '@/lib/utils/saved-view-utils'

import { DataCell } from './DataCell'

interface RecordCardViewProps {
  tableName: string
  tableMetaData: QTableMetaData
  records: QRecord[]
  rowSelection: RowSelectionState
  onRowSelectionChange: (selection: RowSelectionState) => void
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  maxFieldsPerCard?: number
  /** True while the first page of records loads; shows placeholder cards instead of the empty state. */
  isLoading?: boolean
  /** Reports whether a card at a page index is covered by an all/first-N selection. */
  isRowSelectedByQuery?: (rowIndex: number) => boolean
}

const MAX_VISIBLE_FIELDS = 5

/**
 * Card-based record list for mobile viewports.
 *
 * Renders each record as a clickable card with a selection checkbox, the record label
 * as a heading, and key-value pairs for visible fields. Clicking a card navigates to
 * the record detail view.
 *
 * @param props - Component properties.
 * @returns The rendered card list, placeholder cards while loading, or an empty state when no
 *   records are present.
 */
export function RecordCardView({
  tableName,
  tableMetaData,
  records,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  columnOrder,
  maxFieldsPerCard = MAX_VISIBLE_FIELDS,
  isLoading = false,
  isRowSelectedByQuery,
}: RecordCardViewProps) {
  const router = useRouter()

  // Build a list of visible fields respecting column order and visibility
  // The grid's columns (sections order, user order and visibility), so cards and grid agree
  const visibleFields = useMemo<QFieldMetaData[]>(
    () => orderColumns(getQueryColumns(tableMetaData), columnOrder)
      .filter((column) => isColumnVisible(column.name, columnVisibility))
      .slice(0, maxFieldsPerCard)
      .map((column) => ({ ...column.field, name: column.name, label: column.label })),
    [tableMetaData, columnVisibility, columnOrder, maxFieldsPerCard]
  )

  const getRecordId = useCallback(
    (record: QRecord, index: number): string => {
      const pk = tableMetaData.primaryKeyField
      const pkVal = record.values[pk]
      return pkVal != null ? String(pkVal) : String(index)
    },
    [tableMetaData.primaryKeyField]
  )

  const handleCardClick = useCallback(
    (record: QRecord) => {
      const pk = tableMetaData.primaryKeyField
      const id = record.values[pk]
      if (id != null) {
        router.push(`/app/${tableName}/${id}`)
      }
    },
    [router, tableName, tableMetaData.primaryKeyField]
  )

  const handleSelectionToggle = useCallback(
    (recordId: string, index: number) => {
      // Unchecking a card under an all/first-N selection keeps the other covered cards (as the grid does)
      if (isRowSelectedByQuery) {
        onRowSelectionChange(Object.fromEntries(records
          .map((r, i) => [getRecordId(r, i), i] as const)
          .filter(([, i]) => i !== index && isRowSelectedByQuery(i))
          .map(([id]) => [id, true])))
        return
      }
      const next = { ...rowSelection }
      if (next[recordId]) {
        delete next[recordId]
      } else {
        next[recordId] = true
      }
      onRowSelectionChange(next)
    },
    [rowSelection, onRowSelectionChange, isRowSelectedByQuery, records, getRecordId]
  )

  // Loading: placeholder cards, like the grid's skeleton rows (QRun-IO/qqq#694)
  if (isLoading && records.length === 0) {
    return (
      <div
        className="flex flex-col gap-3"
        role="status"
        aria-busy="true"
        aria-label={`Loading ${tableMetaData.label} records`}
        data-qqq-id={`record-card-view-loading-${tableName}`}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border p-4" aria-hidden="true">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center"
        data-qqq-id={`record-card-view-empty-${tableName}`}
      >
        <Inbox className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          No records found
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-3"
      role="list"
      aria-label={`${tableMetaData.label} records`}
      data-qqq-id={`record-card-view-${tableName}`}
    >
      {records.map((record, index) => {
        const recordId = getRecordId(record, index)
        const isSelected = isRowSelectedByQuery ? isRowSelectedByQuery(index) : Boolean(rowSelection[recordId])
        const recordLabel = record.recordLabel || recordId

        return (
          <div
            key={recordId}
            role="listitem"
            tabIndex={0}
            onClick={() => handleCardClick(record)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleCardClick(record)
              }
            }}
            className={`cursor-pointer rounded-xl border p-4 transition-colors hover:border-primary/30 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card'
            }`}
            data-qqq-id={`record-card-${recordId}`}
          >
            {/* Card header: checkbox + record label */}
            <div className="flex items-start gap-3 pointer-coarse:items-center">
              {/* The label is the checkbox's touch target (44 px on coarse pointers, globals.css) */}
              <label
                className="inline-flex shrink-0 cursor-pointer items-center justify-center pointer-coarse:-my-2.5 pointer-coarse:-ml-3"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation()
                    handleSelectionToggle(recordId, index)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${recordLabel}`}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-ring cursor-pointer pointer-coarse:mt-0 pointer-coarse:h-5 pointer-coarse:w-5"
                  data-qqq-id={`card-select-${recordId}`}
                />
              </label>
              <div className="min-w-0 flex-1">
                <h3
                  className="truncate text-sm font-semibold text-card-foreground"
                  data-qqq-id={`card-title-${recordId}`}
                >
                  {recordLabel}
                </h3>
              </div>
            </div>

            {/* Card body: field key-value pairs */}
            <dl className="mt-3 grid grid-cols-1 gap-1.5">
              {visibleFields.map((field) => {
                // Skip the primary key if it is the same as recordLabel
                if (field.name === tableMetaData.primaryKeyField && recordLabel === String(record.values[field.name])) {
                  return null
                }

                return (
                  <div key={field.name} className="flex items-baseline gap-2 text-sm" data-qqq-id={`card-field-${field.name}`}>
                    <dt className="shrink-0 text-muted-foreground">
                      {field.label}:
                    </dt>
                    <dd className="min-w-0 break-words text-card-foreground">
                      {/* Formatted exactly like the grid cell (dates, money, possible-value links) */}
                      <DataCell field={field} value={record.values[field.name]} displayValue={record.displayValues?.[field.name]} record={record} />
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        )
      })}
    </div>
  )
}
