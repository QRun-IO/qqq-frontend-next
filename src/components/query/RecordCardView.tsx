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

'use client'

// RecordCardView — card-based rendering of records for mobile viewports
// Displays each record as a card with key-value pairs, selection checkbox, and click-to-navigate

import React, { useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { RowSelectionState } from '@tanstack/react-table'
import { Inbox } from 'lucide-react'

import type { QTableMetaData, QRecord, QFieldMetaData } from '@/types'

interface RecordCardViewProps {
  tableName: string
  tableMetaData: QTableMetaData
  records: QRecord[]
  rowSelection: RowSelectionState
  onRowSelectionChange: (selection: RowSelectionState) => void
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  maxFieldsPerCard?: number
}

const MAX_VISIBLE_FIELDS = 5

export function RecordCardView({
  tableName,
  tableMetaData,
  records,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  columnOrder,
  maxFieldsPerCard = MAX_VISIBLE_FIELDS,
}: RecordCardViewProps) {
  const router = useRouter()

  // Build a list of visible fields respecting column order and visibility
  const visibleFields = useMemo<QFieldMetaData[]>(() => {
    const allFields = Object.values(tableMetaData.fields).filter(
      (f) => !f.isHidden && !f.isHeavy
    )

    const visible = allFields.filter((f) => columnVisibility[f.name] !== false)

    if (columnOrder.length > 0) {
      const orderMap: Record<string, number> = {}
      columnOrder.forEach((name, idx) => {
        orderMap[name] = idx
      })
      visible.sort((a, b) => {
        const ia = orderMap[a.name] ?? 9999
        const ib = orderMap[b.name] ?? 9999
        return ia - ib
      })
    }

    return visible.slice(0, maxFieldsPerCard)
  }, [tableMetaData.fields, columnVisibility, columnOrder, maxFieldsPerCard])

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
    (recordId: string) => {
      const next = { ...rowSelection }
      if (next[recordId]) {
        delete next[recordId]
      } else {
        next[recordId] = true
      }
      onRowSelectionChange(next)
    },
    [rowSelection, onRowSelectionChange]
  )

  const getDisplayValue = (record: QRecord, field: QFieldMetaData): string => {
    const displayVal = record.displayValues?.[field.name]
    if (displayVal != null && displayVal !== '') return displayVal
    const rawVal = record.values[field.name]
    if (rawVal == null || rawVal === '') return '\u2014'
    if (field.type === 'BOOLEAN') {
      return rawVal === true || rawVal === 'true' || rawVal === 1 ? 'Yes' : 'No'
    }
    return String(rawVal)
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
        const isSelected = Boolean(rowSelection[recordId])
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
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation()
                  handleSelectionToggle(recordId)
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${recordLabel}`}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-ring cursor-pointer"
                data-qqq-id={`card-select-${recordId}`}
              />
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
                  <div key={field.name} className="flex items-baseline gap-2 text-sm">
                    <dt className="shrink-0 text-muted-foreground">
                      {field.label}:
                    </dt>
                    <dd className="min-w-0 truncate text-card-foreground">
                      {getDisplayValue(record, field)}
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
