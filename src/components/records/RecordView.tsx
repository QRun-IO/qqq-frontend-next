'use client'

// RecordView — displays a single record with sections, field values, and related records
// Metadata-driven: renders entirely from QTableMetaData + QRecord
// Features:
// - Differentiated error handling (403, 404, 500)
// - Collapsible sections on mobile
// - T2 sections collapsed by default

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, RefreshCw, ShieldX, FileQuestion, ArrowLeft, LayoutGrid, List } from 'lucide-react'
import { AxiosError } from 'axios'

import type { QTableMetaData, QRecord, QWidgetMetaData, QProcessMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { RecordViewSection } from './RecordViewSection'
import { RecordActions } from './RecordActions'
import { AssociatedRecords } from './AssociatedRecords'
import { FieldValue } from './FieldValue'

/** Extract up to two uppercase initials from a label string */
function getInitials(label: string): string {
  const words = label.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return label.slice(0, 2).toUpperCase()
}

interface RecordViewProps {
  tableMetaData: QTableMetaData
  record: QRecord | undefined
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  onRefetch?: () => void
  /** Hide the actions bar (edit/delete/copy buttons) */
  hideActions?: boolean
  /** Widget metadata map for sections that render widgets */
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  /** Processes available for this table (single-record actions) */
  processes?: QProcessMetaData[]
  className?: string
}

/**
 * Extracts an HTTP status code from an error, if available.
 * Supports AxiosError and generic error objects with a `status` property.
 */
function getErrorStatusCode(error: Error | null | undefined): number | undefined {
  if (!error) return undefined

  // AxiosError provides response.status
  if ('response' in error) {
    const axiosErr = error as AxiosError
    return axiosErr.response?.status
  }

  // Some error wrappers expose status directly
  if ('status' in error && typeof (error as Record<string, unknown>).status === 'number') {
    return (error as Record<string, unknown>).status as number
  }

  return undefined
}

export function RecordView({
  tableMetaData,
  record,
  isLoading = false,
  isError = false,
  error,
  onRefetch,
  hideActions = false,
  widgetMetaDataMap,
  processes,
  className,
}: RecordViewProps) {
  const router = useRouter()

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
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Loading {tableMetaData.label}...
          </p>
        </div>
      </div>
    )
  }

  // Error state — differentiated by HTTP status code
  if (isError || !record) {
    const statusCode = getErrorStatusCode(error)

    // 403 Forbidden
    if (statusCode === 403) {
      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border border-yellow-200 bg-yellow-50 p-12 text-center dark:border-yellow-800 dark:bg-yellow-900/10',
            className
          )}
          data-qqq-id={`record-view-forbidden-${tableMetaData.name}`}
          role="alert"
        >
          <ShieldX className="mb-3 h-10 w-10 text-yellow-500 dark:text-yellow-400" aria-hidden="true" />
          <h3 className="text-base font-semibold text-yellow-700 dark:text-yellow-400">
            Permission Denied
          </h3>
          <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
            You don&apos;t have permission to view this record.
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            data-qqq-id="button-go-back"
            className={cn(
              'mt-4 inline-flex items-center gap-2 rounded-md border border-yellow-300 px-4 py-2 text-sm font-medium',
              'text-yellow-700 bg-white hover:bg-yellow-50',
              'focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2',
              'transition-colors duration-150'
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go Back
          </button>
        </div>
      )
    }

    // 404 Not Found
    if (statusCode === 404) {
      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border border-border bg-muted p-12 text-center',
            className
          )}
          data-qqq-id={`record-view-not-found-${tableMetaData.name}`}
          role="alert"
        >
          <FileQuestion className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-base font-semibold text-foreground">
            Record Not Found
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The {tableMetaData.label} record you are looking for does not exist or has been deleted.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/app/${tableMetaData.name}`)}
            data-qqq-id="button-back-to-table"
            className={cn(
              'mt-4 inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'transition-colors duration-150'
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to {tableMetaData.label}
          </button>
        </div>
      )
    }

    // Default error (500 or unknown)
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
          {statusCode === 500
            ? 'Server Error'
            : `Failed to load ${tableMetaData.label}`}
        </h3>
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error.message}</p>
        )}
        {onRefetch && (
          <button
            type="button"
            onClick={onRefetch}
            data-qqq-id="button-retry"
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

  // Exposed joins with associated records
  const exposedJoins = tableMetaData.exposedJoins ?? []
  const manyJoins = exposedJoins.filter((j) => j.isMany && j.joinTable)
  const oneJoins = exposedJoins.filter((j) => !j.isMany && j.joinTable)

  // Build tabs — "Overview" shows all T2 sections in a card grid,
  // plus individual tabs for specific content if needed
  type TabDef = { id: string; label: string }
  const tabs: TabDef[] = []
  if (secondarySections.length > 0) {
    tabs.push({ id: 'overview', label: 'Overview' })
  }
  // Each T2 section also gets its own tab for focused view
  for (const s of secondarySections) {
    tabs.push({ id: `section-${s.name}`, label: s.label })
  }
  if (manyJoins.length > 0) {
    tabs.push({ id: 'related', label: 'Related' })
  }

  return (
    <RecordViewContent
      tableMetaData={tableMetaData}
      record={record}
      hideActions={hideActions}
      widgetMetaDataMap={widgetMetaDataMap}
      processes={processes}
      className={className}
      tabs={tabs}
      primarySections={primarySections}
      secondarySections={secondarySections}
      visibleSections={visibleSections}
      oneJoins={oneJoins}
      manyJoins={manyJoins}
    />
  )
}

/** Inner component that uses useState for tab selection and view mode */
function RecordViewContent({
  tableMetaData,
  record,
  hideActions,
  widgetMetaDataMap,
  processes,
  className,
  tabs,
  primarySections,
  secondarySections,
  visibleSections,
  oneJoins,
  manyJoins,
}: {
  tableMetaData: QTableMetaData
  record: QRecord
  hideActions: boolean
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  processes?: QProcessMetaData[]
  className?: string
  tabs: Array<{ id: string; label: string }>
  primarySections: typeof tableMetaData.sections
  secondarySections: typeof tableMetaData.sections
  visibleSections: typeof tableMetaData.sections
  oneJoins: typeof tableMetaData.exposedJoins
  manyJoins: typeof tableMetaData.exposedJoins
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '')
  const [viewMode, setViewMode] = useState<'tabs' | 'list'>('tabs')

  const t1Sections = primarySections.length > 0 ? primarySections : visibleSections

  // Collect T1 fields, excluding those whose values are part of the record label
  const recordLabel = record.recordLabel ?? ''
  const t1Fields = t1Sections.flatMap((section) =>
    section.fieldNames
      .map((fn) => tableMetaData.fields[fn])
      .filter((f) => {
        if (!f || f.isHidden || f.isHeavy) return false
        // Skip the primary key — already implied
        if (f.name === tableMetaData.primaryKeyField) return false
        // Skip fields whose display value is contained in the record label
        if (recordLabel) {
          const displayVal = record.displayValues?.[f.name]
          const rawVal = record.values[f.name]
          const val = displayVal ?? (rawVal != null ? String(rawVal) : null)
          if (val && recordLabel.includes(val)) return false
        }
        return true
      })
  )

  return (
    <div
      className={cn('space-y-5', className)}
      data-qqq-id={`record-view-${tableMetaData.name}`}
    >
      {/* Back link */}
      <Link
        href={`/app/${tableMetaData.name}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-qqq-id="link-back-to-table"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to {tableMetaData.label}
      </Link>

      {/* Record header — avatar + name + actions */}
      <div className="flex items-start gap-4">
        <div
          className="mt-1 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground"
          aria-hidden="true"
          data-qqq-id="record-avatar"
        >
          {getInitials(
            record.recordLabel ||
            `${tableMetaData.label} ${record.values[tableMetaData.primaryKeyField]}`
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {record.recordLabel || `${tableMetaData.label} #${record.values[tableMetaData.primaryKeyField]}`}
          </h1>
          {/* T1 fields as a compact grid under the name */}
          {t1Fields.length > 0 && (
            <dl
              className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4"
              data-qqq-id="record-primary-sections"
            >
              {t1Fields.map((field) => {
                const displayVal = record.displayValues?.[field.name]
                const rawVal = record.values[field.name]
                const val = displayVal ?? (rawVal != null ? String(rawVal) : null)
                return (
                  <div key={field.name} className="flex flex-col" data-qqq-id={`record-field-${field.name}`}>
                    <dt className="text-xs text-muted-foreground" data-qqq-id={`field-label-${field.name}`}>{field.label}</dt>
                    <dd className="text-sm text-foreground">{val ?? '\u2014'}</dd>
                  </div>
                )
              })}
              {/* One-to-one join fields */}
              {oneJoins.map((join) => {
                const joinRecords = record.associatedRecords?.[join.joinTable!.name] ?? []
                if (joinRecords.length === 0) return null
                const joinRecord = joinRecords[0]
                return Object.values(join.joinTable!.fields)
                  .filter((f) => !f.isHidden && !f.isHeavy)
                  .slice(0, 3)
                  .map((field) => {
                    const val = joinRecord.displayValues?.[field.name] ??
                      (joinRecord.values[field.name] != null ? String(joinRecord.values[field.name]) : null)
                    return (
                      <div key={`${join.label}-${field.name}`} className="flex flex-col">
                        <dt className="text-xs text-muted-foreground">{field.label}</dt>
                        <dd className="text-sm text-foreground">{val ?? '\u2014'}</dd>
                      </div>
                    )
                  })
              })}
            </dl>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View mode toggle */}
          <div
            className="flex rounded-lg border border-border bg-muted/50 p-0.5"
            role="radiogroup"
            aria-label="View mode"
            data-qqq-id="record-view-mode-toggle"
          >
            <button
              role="radio"
              aria-checked={viewMode === 'tabs'}
              aria-label="Card view"
              onClick={() => setViewMode('tabs')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'tabs'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              role="radio"
              aria-checked={viewMode === 'list'}
              aria-label="List view"
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'list'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {!hideActions && (
            <RecordActions tableMetaData={tableMetaData} record={record} processes={processes} />
          )}
        </div>
      </div>

      {/* Record errors/warnings */}
      {(record.errors?.length ?? 0) > 0 && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <ul className="list-inside list-disc space-y-1">
            {record.errors!.map((err, i) => (
              <li key={i} className="text-sm text-red-700">{err}</li>
            ))}
          </ul>
        </div>
      )}
      {(record.warnings?.length ?? 0) > 0 && (
        <div role="status" className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3">
          <ul className="list-inside list-disc space-y-1">
            {record.warnings!.map((warn, i) => (
              <li key={i} className="text-sm text-yellow-700">{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* === View mode: Tabs (default) === */}
      {viewMode === 'tabs' && tabs.length > 0 && (
        <>
          {/* Tab bar — pill-style */}
          <div
            className="flex rounded-xl border border-border bg-muted/50 p-1"
            role="tablist"
            data-qqq-id="record-view-tabs"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                data-qqq-id={`record-tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content: Overview — all T2 sections in 2-column card grid */}
          {activeTab === 'overview' && (
            <div
              className="grid grid-cols-1 gap-6 lg:grid-cols-2"
              role="tabpanel"
              data-qqq-id="record-tab-panel-overview"
            >
              {secondarySections.map((section) => (
                <div
                  key={section.name}
                  className={cn(
                    'rounded-xl border border-border bg-card p-6 shadow-sm',
                    (section.gridColumns ?? 0) >= 3 ? 'lg:col-span-2' : undefined
                  )}
                >
                  <RecordViewSection
                    section={section}
                    tableMetaData={tableMetaData}
                    record={record}
                    widgetMetaDataMap={widgetMetaDataMap}
                    stacked
                  />
                </div>
              ))}
            </div>
          )}

          {/* Tab content: Individual T2 section tabs */}
          {secondarySections.map((section) => (
            activeTab === `section-${section.name}` && (
              <div
                key={section.name}
                role="tabpanel"
                data-qqq-id={`record-tab-panel-${section.name}`}
              >
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <RecordViewSection
                    section={section}
                    tableMetaData={tableMetaData}
                    record={record}
                    widgetMetaDataMap={widgetMetaDataMap}
                  />
                </div>
              </div>
            )
          ))}

          {/* Tab content: Related (many-to-many / one-to-many) */}
          {activeTab === 'related' && (
            <div className="space-y-6" role="tabpanel" data-qqq-id="record-tab-panel-related">
              {manyJoins.map((join) => {
                const assocRecords = record.associatedRecords?.[join.joinTable!.name] ?? []
                return (
                  <div key={join.label} className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
        </>
      )}

      {/* === View mode: List (compact top-to-bottom data view) === */}
      {viewMode === 'list' && (
        <div className="space-y-4" data-qqq-id="record-view-list-mode">
          {/* T1 sections as compact cards */}
          {t1Sections.length > 0 && t1Sections.map((section) => (
            <div
              key={section.name}
              className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm"
            >
              <RecordViewSection
                section={section}
                tableMetaData={tableMetaData}
                record={record}
                widgetMetaDataMap={widgetMetaDataMap}
                compact
              />
            </div>
          ))}

          {/* T2 sections as compact cards */}
          {secondarySections.map((section) => (
            <div
              key={section.name}
              className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm"
            >
              <RecordViewSection
                section={section}
                tableMetaData={tableMetaData}
                record={record}
                widgetMetaDataMap={widgetMetaDataMap}
                compact
              />
            </div>
          ))}

          {/* Related records */}
          {manyJoins.map((join) => {
            const assocRecords = record.associatedRecords?.[join.joinTable!.name] ?? []
            return (
              <div key={join.label} className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
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

      {/* No tabs/sections — just show all fields if nothing to tab */}
      {tabs.length === 0 && secondarySections.length === 0 && t1Fields.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <dl className="grid gap-x-8 gap-y-4 grid-cols-1 sm:grid-cols-2">
            {Object.values(tableMetaData.fields)
              .filter((f) => !f.isHidden && !f.isHeavy)
              .map((field) => (
                <div key={field.name} className="flex flex-col gap-0.5" data-qqq-id={`record-field-${field.name}`}>
                  <dt className="text-sm font-semibold text-foreground" data-qqq-id={`field-label-${field.name}`}>
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
    </div>
  )
}
