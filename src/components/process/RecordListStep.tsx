'use client'

// RecordListStep — renders a RECORD_LIST step
// Shows a paginated read-only table of records that will be affected

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import type { QFrontendStepMetaData, QRecord, QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { ProcessCancelDialog } from './ProcessCancelDialog'

const PAGE_SIZE = 10

export interface RecordListStepProps {
  step: QFrontendStepMetaData
  stepValues: Record<string, unknown>
  isLoading: boolean
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  onBack?: () => void
  canGoBack: boolean
  isLastStep: boolean
}

function getDisplayValue(record: QRecord, fieldName: string): string {
  const display = record.displayValues?.[fieldName]
  if (display !== undefined) return display
  const raw = record.values?.[fieldName]
  if (raw === null || raw === undefined) return ''
  return String(raw)
}

function parseRecords(stepValues: Record<string, unknown>): QRecord[] {
  if (Array.isArray(stepValues.records)) {
    return stepValues.records as QRecord[]
  }
  return []
}

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

export function RecordListStep({
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

  const records = parseRecords(stepValues)
  const columns = parseColumns(step, records)
  const totalRecords = records.length
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE)
  const pageRecords = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-6" data-qqq-id={`process-record-list-step-${step.name}`}>
      {/* Record count summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
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
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table
            className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
            data-qqq-id="record-list-table"
          >
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    data-qqq-id={`record-list-header-${col.name}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {pageRecords.length > 0 ? (
                pageRecords.map((record, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                    data-qqq-id={`record-list-row-${page * PAGE_SIZE + rowIdx}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.name}
                        className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100"
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
                    className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    No records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
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
              'inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm',
              'text-gray-700 bg-white hover:bg-gray-50',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800'
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
            data-qqq-id="button-page-next"
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm',
              'text-gray-700 bg-white hover:bg-gray-50',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800'
            )}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            disabled={isLoading}
            data-qqq-id="button-cancel"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium',
              'text-gray-700 bg-white hover:bg-gray-50',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700',
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
                  'inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium',
                  'text-gray-700 bg-white hover:bg-gray-50',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700',
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
                'text-white bg-blue-600 hover:bg-blue-700',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
