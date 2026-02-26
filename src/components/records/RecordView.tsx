'use client'

// RecordView — displays a single record with sections, field values, and related records
// Metadata-driven: renders entirely from QTableMetaData + QRecord

import React from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'

import type { QTableMetaData, QRecord } from '@/types'
import { cn } from '@/lib/utils/cn'

import { RecordViewSection } from './RecordViewSection'
import { RecordActions } from './RecordActions'
import { AssociatedRecords } from './AssociatedRecords'
import { FieldValue } from './FieldValue'

interface RecordViewProps {
  tableMetaData: QTableMetaData
  record: QRecord | undefined
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  onRefetch?: () => void
  /** Hide the actions bar (edit/delete/copy buttons) */
  hideActions?: boolean
  className?: string
}

export function RecordView({
  tableMetaData,
  record,
  isLoading = false,
  isError = false,
  error,
  onRefetch,
  hideActions = false,
  className,
}: RecordViewProps) {
  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn('flex items-center justify-center py-16', className)}
        data-qqq-id={`record-view-loading-${tableMetaData.name}`}
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading {tableMetaData.label}...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (isError || !record) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-12 text-center dark:border-red-800 dark:bg-red-900/10',
          className
        )}
        data-qqq-id={`record-view-error-${tableMetaData.name}`}
        role="alert"
      >
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" aria-hidden="true" />
        <h3 className="text-base font-semibold text-red-700 dark:text-red-400">
          Failed to load {tableMetaData.label}
        </h3>
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error.message}</p>
        )}
        {onRefetch && (
          <button
            type="button"
            onClick={onRefetch}
            className={cn(
              'mt-4 inline-flex items-center gap-2 rounded-md border border-red-300 px-4 py-2 text-sm font-medium',
              'text-red-700 bg-white hover:bg-red-50',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
              'transition-colors duration-150'
            )}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
    )
  }

  // Separate sections into tiers
  const visibleSections = tableMetaData.sections.filter((s) => !s.isHidden)
  const primarySections = visibleSections.filter((s) => !s.tier || s.tier === 'T1' || s.tier === 'basic')
  const secondarySections = visibleSections.filter((s) => s.tier === 'T2' || s.tier === 'advanced')

  // If no sections, render all visible fields in a single group
  const hasAnySections = visibleSections.length > 0

  // Exposed joins with associated records
  const exposedJoins = tableMetaData.exposedJoins ?? []
  const manyJoins = exposedJoins.filter((j) => j.isMany && j.joinTable)
  const oneJoins = exposedJoins.filter((j) => !j.isMany && j.joinTable)

  return (
    <div
      className={cn('space-y-8', className)}
      data-qqq-id={`record-view-${tableMetaData.name}`}
    >
      {/* Header with record label and actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {record.recordLabel || `${tableMetaData.label} #${record.values[tableMetaData.primaryKeyField]}`}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tableMetaData.label}
          </p>
        </div>
        {!hideActions && (
          <RecordActions tableMetaData={tableMetaData} record={record} />
        )}
      </div>

      {/* Record errors/warnings */}
      {(record.errors?.length ?? 0) > 0 && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20"
        >
          <ul className="list-inside list-disc space-y-1">
            {record.errors!.map((err, i) => (
              <li key={i} className="text-sm text-red-700 dark:text-red-400">
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(record.warnings?.length ?? 0) > 0 && (
        <div
          role="status"
          className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-900/20"
        >
          <ul className="list-inside list-disc space-y-1">
            {record.warnings!.map((warn, i) => (
              <li key={i} className="text-sm text-yellow-700 dark:text-yellow-400">
                {warn}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* One-to-one join fields inline */}
      {oneJoins.length > 0 && oneJoins.map((join) => {
        const joinRecords = record.associatedRecords?.[join.joinTable!.name] ?? []
        if (joinRecords.length === 0) return null
        const joinRecord = joinRecords[0]
        return (
          <div
            key={join.label}
            className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30"
            data-qqq-id={`join-section-${join.label}`}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {join.label}
            </p>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {Object.values(join.joinTable!.fields)
                .filter((f) => !f.isHidden && !f.isHeavy)
                .slice(0, 6)
                .map((field) => (
                  <div key={field.name} className="flex flex-col gap-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {field.label}
                    </dt>
                    <dd>
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {joinRecord.displayValues?.[field.name] ??
                          (joinRecord.values[field.name] !== undefined &&
                          joinRecord.values[field.name] !== null
                            ? String(joinRecord.values[field.name])
                            : '—')}
                      </span>
                    </dd>
                  </div>
                ))}
            </div>
          </div>
        )
      })}

      {/* Field sections */}
      {hasAnySections ? (
        <div className="space-y-8">
          {/* Primary sections */}
          {(primarySections.length > 0 ? primarySections : visibleSections).map((section) => (
            <div
              key={section.name}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <RecordViewSection
                section={section}
                tableMetaData={tableMetaData}
                record={record}
              />
            </div>
          ))}

          {/* Secondary/advanced sections */}
          {secondarySections.length > 0 && (
            <details className="group">
              <summary
                className={cn(
                  'flex cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium',
                  'text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700/50',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'transition-colors duration-150'
                )}
              >
                <span className="group-open:hidden">Show advanced fields</span>
                <span className="hidden group-open:inline">Hide advanced fields</span>
              </summary>
              <div className="mt-4 space-y-4">
                {secondarySections.map((section) => (
                  <div
                    key={section.name}
                    className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <RecordViewSection
                      section={section}
                      tableMetaData={tableMetaData}
                      record={record}
                    />
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        // No sections — render all visible fields in a simple grid
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {Object.values(tableMetaData.fields)
              .filter((f) => !f.isHidden && !f.isHeavy)
              .map((field) => (
                <div
                  key={field.name}
                  className="flex flex-col gap-1"
                  data-qqq-id={`record-field-${field.name}`}
                >
                  <dt
                    className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    data-qqq-id={`field-label-${field.name}`}
                  >
                    {field.label}
                  </dt>
                  <dd>
                    <FieldValue field={field} record={record} />
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      )}

      {/* Many-to-many / one-to-many associated records */}
      {manyJoins.length > 0 && (
        <div className="space-y-6">
          {manyJoins.map((join) => {
            const assocRecords = record.associatedRecords?.[join.joinTable!.name] ?? []
            return (
              <div
                key={join.label}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <AssociatedRecords
                  join={join}
                  records={assocRecords}
                  parentTableMetaData={tableMetaData}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
