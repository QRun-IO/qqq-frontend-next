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
 * @file RecordListStep — renders a RECORD_LIST process step.
 *
 * Displays a paginated read-only table of the records that will be
 * affected by the process.  Columns are derived from `step.recordListFields`
 * when available, falling back to the keys of the first record.
 */
'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import type { QFrontendStepMetaData, QRecord, QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'
import { processRecords } from '@/lib/api/processes'

import { ProcessCancelDialog } from './ProcessCancelDialog'

/** Number of records shown per page in the record list table. */
const PAGE_SIZE = 10

/**
 * Props for the {@link RecordListStep} component.
 */
export interface RecordListStepProps {
  /** Active process identifiers used to load records from the backend. */
  processName?: string
  processUUID?: string
  /** Metadata for the current process step, including optional `recordListFields`. */
  step: QFrontendStepMetaData
  /** Current accumulated step values; an inline records array is used when no process identifiers are supplied. */
  stepValues: Record<string, unknown>
  /** Whether a submission is in progress; disables navigation controls while true. */
  isLoading: boolean
  /**
   * Called when the user confirms and advances past this step.
   *
   * @param values - The current step values passed through unchanged.
   */
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  /** Called when the user confirms cancellation of the process. */
  onCancel: () => void
  /** Called when the user clicks Back; only rendered if `canGoBack` is true. */
  onBack?: () => void
  /** Whether a previous step exists to navigate back to. */
  canGoBack: boolean
  /** Whether this is the final step in the process (controls button label). */
  isLastStep: boolean
}

/**
 * Returns the best available display value for a field in a record.
 *
 * Prefers `record.displayValues` (pre-formatted by the backend) over the raw
 * `record.values` entry.
 *
 * @param record - The QRecord to read from.
 * @param fieldName - The field's technical name.
 * @returns A string representation of the value, or an empty string if absent.
 */
function getDisplayValue(record: QRecord, fieldName: string): string {
  const display = record.displayValues?.[fieldName]
  if (display !== undefined) return display
  const raw = record.values?.[fieldName]
  if (raw === null || raw === undefined) return ''
  return String(raw)
}

/**
 * Extracts the records array from step values.
 *
 * @param stepValues - The current accumulated step values.
 * @returns The `records` array cast to `QRecord[]`, or an empty array if absent.
 */
function parseRecords(stepValues: Record<string, unknown>): QRecord[] {
  if (Array.isArray(stepValues.records)) {
    return stepValues.records as QRecord[]
  }
  return []
}

/**
 * Derives column definitions for the record list table.
 *
 * Uses `step.recordListFields` when declared; otherwise falls back to
 * synthesising minimal field metadata from the first record's value keys.
 *
 * @param step - The current step metadata.
 * @param records - The parsed record array used for fallback column inference.
 * @returns An array of {@link QFieldMetaData} objects to drive table columns.
 */
function parseColumns(
  step: QFrontendStepMetaData,
  records: QRecord[]
): QFieldMetaData[] {
  // Use step's recordListFields if available
  if (step.recordListFields && step.recordListFields.length > 0) {
    return step.recordListFields
  }
  // Fall back to deriving columns from the first record's keys
  if (records.length > 0) {
    return Object.keys(records[0].values ?? {}).map((key) => ({
      name: key,
      label: key,
      type: 'STRING' as const,
      isRequired: false,
      isEditable: false,
      isHeavy: false,
      isHidden: false,
      adornments: [],
    }))
  }
  return []
}

/**
 * Renders a RECORD_LIST process step.
 *
 * Dispatched from `ProcessRun` when `resolveStepType` returns `'RECORD_LIST'`.
 * Fetches the active process records with server pagination, or uses an inline
 * records array when no process identifiers are supplied. Columns derive from
 * metadata and each page contains at most {@link PAGE_SIZE} (10) rows.  Pagination controls only appear when
 * more than one page is needed.  The Confirm button passes step values through
 * unchanged; the process backend decides what to do with the acknowledged list.
 *
 * @param props - {@link RecordListStepProps}
 * @returns A `<div>` with a record-count summary, a scrollable table, optional
 *   pagination controls, and a sticky Cancel / Back / Next|Confirm & Submit bar.
 */
export function RecordListStep({
  processName,
  processUUID,
  step,
  stepValues,
  isLoading,
  onSubmit,
  onCancel,
  onBack,
  canGoBack,
  isLastStep,
}: RecordListStepProps) {
  const [page, setPage] = useState(0)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const remote = Boolean(processName && processUUID)
  const query = useQuery({
    queryKey: ['process-records', processName, processUUID, step.name, page],
    queryFn: () => processRecords(processName!, processUUID!, page * PAGE_SIZE, PAGE_SIZE),
    enabled: remote,
    retry: false,
  })
  const records = remote ? query.data?.records ?? [] : parseRecords(stepValues)
  const columns = parseColumns(step, records)
  const totalRecords = remote ? query.data?.totalRecords ?? 0 : records.length
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE)
  const pageRecords = remote ? records : records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (remote && query.isPending) return <p role="status">Loading process records...</p>
  if (remote && query.isError) {
    return (
      <div role="alert" className="space-y-3">
        <p>Failed to load process records. Review them before continuing.</p>
        <button type="button" onClick={() => query.refetch()} data-qqq-id="button-retry-process-records"
          className="rounded border px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-qqq-id={`process-record-list-step-${step.name}`}>
      {/* Record count summary */}
      <div className="text-sm text-muted-foreground">
        {totalRecords > 0 ? (
          <span>
            Showing <strong>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalRecords)}</strong> of{' '}
            <strong>{totalRecords}</strong> records
          </span>
        ) : (
          <span>No records to display</span>
        )}
      </div>

      {/* Table */}
      {columns.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table
            className="min-w-full divide-y divide-border"
            data-qqq-id="record-list-table"
          >
            <thead className="bg-muted">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                    data-qqq-id={`record-list-header-${col.name}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {pageRecords.length > 0 ? (
                pageRecords.map((record, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="hover:bg-accent"
                    data-qqq-id={`record-list-row-${page * PAGE_SIZE + rowIdx}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.name}
                        className="px-4 py-3 text-sm text-foreground"
                        data-qqq-id={`record-list-cell-${col.name}`}
                      >
                        {getDisplayValue(record, col.name)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
          No records to display for this step.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between" data-qqq-id="record-list-pagination">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            data-qqq-id="button-page-prev"
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
            data-qqq-id="button-page-next"
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-card px-6 py-3 md:relative md:bottom-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            disabled={isLoading}
            data-qqq-id="button-cancel"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors duration-150'
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {canGoBack && onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={isLoading}
                data-qqq-id="button-back"
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium',
                  'text-foreground bg-card hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'transition-colors duration-150'
                )}
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={() => onSubmit(stepValues)}
              disabled={isLoading}
              data-qqq-id="button-confirm"
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              {isLastStep ? 'Confirm & Submit' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <ProcessCancelDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={onCancel}
      />
    </div>
  )
}
