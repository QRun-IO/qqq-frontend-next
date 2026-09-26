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
 * @file RecordView — metadata-driven record detail page with tiered sections, tabs, and related records.
 */

'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Loader2, AlertCircle, RefreshCw, ShieldX, FileQuestion, ArrowLeft } from 'lucide-react'
import type { QTableMetaData, QRecord, QWidgetMetaData, QProcessMetaData, QAssociation, QTableSection } from '@/types'
import type { AuditSource } from '@/lib/api/audits'
import { cn } from '@/lib/utils/cn'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { isSafeRedirectPath } from '@/lib/utils/string-utils'
import { useUserPreferences } from '@/lib/hooks/use-user-preferences'
import { useLocationHash } from '@/lib/hooks/use-location-hash'
import { recordHashAction } from '@/lib/utils/material-links'

import { RecordViewSection } from './RecordViewSection'
import { FieldValue } from './FieldValue'
import { FieldLabel } from './FieldLabel'
import { RecordViewHeader } from './RecordViewHeader'
import { RecordViewTabs } from './RecordViewTabs'
import { associationWidgetBinding, type AssociationTableState } from '@/lib/utils/association-utils'
import { AssociatedRecords } from './AssociatedRecords'
import { RecordViewAssociated } from './RecordViewAssociated'

/**
 * Returns true if a section has at least one visible field or a widget.
 *
 * @param section - The section descriptor containing field names and an optional widget name.
 * @param table - The parent table metadata used to look up field visibility flags.
 * @returns `true` when the section contributes at least one renderable item.
 */
function sectionHasContent(section: { fieldNames: string[]; widgetName?: string }, table: QTableMetaData): boolean {
  if (section.widgetName) return true
  return section.fieldNames.some((fn) => {
    const f = table.fields[fn]
    return f && !f.isHidden
  })
}

/**
 * Whether a section is hidden (`isHidden`, or v1 metadata's `hidden`).
 *
 * @param section - Section metadata.
 * @returns `true` when the section must not render.
 */
function isSectionHidden(section: QTableSection): boolean {
  return Boolean(section.isHidden || section.hidden)
}

// ---------------------------------------------------------------------------
// RecordViewContext — shared data for the record detail subtree
// ---------------------------------------------------------------------------

/**
 * Shared context values provided by {@link RecordViewContent} to all
 * descendant components in the record detail subtree.
 *
 * Using context avoids threading `tableMetaData`, `allTables`, and
 * `navigateFrom` through every intermediate component as props.
 */
interface RecordViewContextValue {
  /** Table metadata that describes sections, fields, and relationships. */
  tableMetaData: QTableMetaData
  /** Full table metadata map for rendering possibleValueSource fields as links. */
  allTables: Record<string, QTableMetaData> | undefined
  /** Navigation context: current page path + label for building back-links. */
  navigateFrom: { path: string; label: string }
}

const RecordViewContext = createContext<RecordViewContextValue | null>(null)

/**
 * Returns the nearest {@link RecordViewContext} value.
 *
 * Throws if called outside a `RecordViewContext.Provider`, which guards
 * against accidentally using the subcomponents outside {@link RecordViewContent}.
 *
 * @returns The current {@link RecordViewContextValue}.
 */
export function useRecordViewContext(): RecordViewContextValue {
  const ctx = useContext(RecordViewContext)
  if (!ctx) {
    throw new Error('useRecordViewContext must be used within a RecordViewContext.Provider')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// RecordViewProps + RecordView (public export)
// ---------------------------------------------------------------------------

/**
 * Props for the {@link RecordView} component.
 *
 * All rendering is driven by metadata — no field names are hardcoded.
 */
interface RecordViewProps {
  /** Table metadata that describes sections, fields, and relationships. */
  tableMetaData: QTableMetaData
  /** The record to display; `undefined` while loading or after a non-error empty state. */
  record: QRecord | undefined
  /** `true` while the record data is being fetched. */
  isLoading?: boolean
  /** `true` when the data-fetch has entered an error state. */
  isError?: boolean
  /** The error object from the failed fetch, used to differentiate 403/404/500. */
  error?: Error | null
  /** Callback to trigger a data re-fetch — shown as a Retry button on server errors. */
  onRefetch?: () => void
  /** Hide the actions bar (edit/delete/copy buttons) */
  hideActions?: boolean
  /** Widget metadata map for sections that render widgets */
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  /** Full child metadata and its independent load status, supplied by the page. */
  associationTables?: Record<string, AssociationTableState>
  /** Processes available for this table (single-record actions) */
  processes?: QProcessMetaData[]
  /** Full table metadata map for rendering possibleValueSource fields as links with hover previews */
  allTables?: Record<string, QTableMetaData>
  /** How the current user can read this record's audits (`null` hides the Audit action). */
  auditSource?: AuditSource
  /** Additional CSS classes applied to the outermost container. */
  className?: string
}


/**
 * Renders a metadata-driven detail view for a single QQQ record.
 *
 * Handles loading spinners, differentiated error states (403/404/500), and
 * delegates to {@link RecordViewContent} once data is available.  Sections are
 * automatically partitioned into T1 (primary), T2 (secondary), and T3
 * (supplementary/audit) tiers, and tabs are synthesised from T2/T3 sections
 * and named associations.
 *
 * @param props - See {@link RecordViewProps}.
 * @returns A loading spinner (`aria-busy`), a colored error alert (403 yellow,
 *   404 muted, 500 red) with contextual action buttons, `null` when the record
 *   is absent but no error has occurred, or the full record detail layout
 *   rendered by {@link RecordViewContent}.
 */
export function RecordView({
  tableMetaData,
  record,
  isLoading = false,
  isError = false,
  error,
  onRefetch,
  hideActions = false,
  widgetMetaDataMap,
  associationTables,
  processes,
  allTables,
  auditSource = null,
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

  // MED-13: guard against premature error flash — only enter error block when there
  // is an actual error. The `!record` case below handles missing-but-not-errored state.
  if (isError) {
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

  // Record not loaded yet (but no error) — avoids rendering below with undefined record
  if (!record) return null

  // Separate sections into tiers, excluding sections with no renderable content
  const visibleSections = tableMetaData.sections.filter(
    (s) => !isSectionHidden(s) && sectionHasContent(s, tableMetaData)
  )
  const primarySections = visibleSections.filter((s) => !s.tier || s.tier === 'T1' || s.tier === 'basic')
  const secondarySections = visibleSections.filter((s) => s.tier === 'T2' || s.tier === 'advanced')
  const tertiarySections = visibleSections.filter((s) => s.tier === 'T3')

  const boundNames = new Set(visibleSections.flatMap((section) => {
    const binding = associationWidgetBinding(widgetMetaDataMap?.[section.widgetName ?? ''])
    return binding && 'name' in binding ? [binding.name] : []
  }))
  const associations = (tableMetaData.associations ?? []).filter((association) => !boundNames.has(association.name))

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
  // T3 content sections get their own tabs (e.g., Notes)
  for (const s of tertiarySections) {
    tabs.push({ id: `section-${s.name}`, label: s.label })
  }
  if (associations.length > 0) {
    tabs.push({ id: 'related', label: 'Related' })
  }

  return (
    <RecordViewContent
      tableMetaData={tableMetaData}
      record={record}
      hideActions={hideActions}
      widgetMetaDataMap={widgetMetaDataMap}
      associationTables={associationTables}
      processes={processes}
      allTables={allTables}
      className={className}
      tabs={tabs}
      primarySections={primarySections}
      secondarySections={secondarySections}
      tertiarySections={tertiarySections}
      associations={associations}
      onRefetch={onRefetch}
      auditSource={auditSource}
    />
  )
}

/**
 * Inner stateful component that renders the full record detail layout.
 *
 * Separated from {@link RecordView} so that hook calls (useState, useCallback,
 * useMemo) are only executed after loading/error guards have passed and a
 * valid record is guaranteed.  Persists the active tab and view mode (tabs vs
 * list) in the URL so that browser back/forward navigation restores state.
 *
 * Provides {@link RecordViewContext} to the subtree, eliminating prop drilling
 * of `tableMetaData`, `allTables`, and `navigateFrom` through intermediate
 * subcomponents.
 *
 * @param props - Component properties (pre-partitioned sections and join arrays).
 * @returns The full record detail layout within a {@link RecordViewContext}
 *   provider: back link, {@link RecordViewHeader}, error/warning banners,
 *   tab panel or list view depending on `viewMode`, and the
 *   {@link RecordInfoFooter}. Returns a `<RecordViewContext.Provider>` as the
 *   outermost element so all child components can access shared state without
 *   prop drilling.
 */
function RecordViewContent({
  tableMetaData,
  record,
  hideActions,
  widgetMetaDataMap,
  associationTables,
  processes,
  allTables,
  className,
  tabs,
  primarySections,
  secondarySections,
  tertiarySections,
  associations,
  onRefetch,
  auditSource,
}: {
  tableMetaData: QTableMetaData
  record: QRecord
  hideActions: boolean
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  /** Full child metadata and its independent load status, supplied by the page. */
  associationTables?: Record<string, AssociationTableState>
  processes?: QProcessMetaData[]
  allTables?: Record<string, QTableMetaData>
  className?: string
  tabs: Array<{ id: string; label: string }>
  primarySections: typeof tableMetaData.sections
  secondarySections: typeof tableMetaData.sections
  tertiarySections: typeof tableMetaData.sections
  associations: QAssociation[]
  onRefetch?: () => void
  auditSource: AuditSource
}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { preferences } = useUserPreferences()

  // Persist tab and view mode in URL so back navigation restores state
  const urlTab = searchParams.get('tab')
  const urlView = searchParams.get('view') as 'tabs' | 'list' | null

  // Back navigation — read source page info from URL params
  const fromPath = searchParams.get('from')
  const fromLabel = searchParams.get('fromLabel')
  // MED-6: only allow same-origin paths to prevent open redirect (rejects //evil.com protocol-relative URLs)
  const safeFromPath = fromPath && isSafeRedirectPath(fromPath) ? fromPath : null

  const activeTab = (urlTab && tabs.some((t) => t.id === urlTab)) ? urlTab : (tabs[0]?.id ?? '')
  // Use URL view param if set, otherwise fall back to user preference
  const defaultViewMode = preferences.recordDefaultViewMode
  const viewMode = urlView ? urlView : defaultViewMode

  /**
   * Updates a single URL search parameter in-place, removing it when the
   * value equals the provided default to keep URLs clean.
   *
   * @param key - The URL search parameter name.
   * @param value - The new value to set.
   * @param defaultValue - The "default" value; when matched the key is removed.
   */
  const updateUrlParam = useCallback((key: string, value: string, defaultValue: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === defaultValue) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [searchParams, pathname, router])

  /**
   * Switches the active tab by updating the `tab` URL parameter.
   *
   * @param tabId - The id of the tab to activate.
   */
  const setActiveTab = useCallback((tabId: string) => {
    updateUrlParam('tab', tabId, tabs[0]?.id ?? '')
  }, [updateUrlParam, tabs])

  /**
   * Switches between "tabs" (card grid) and "list" (compact sequential) view
   * modes by updating the `view` URL parameter.
   *
   * @param mode - The view mode to activate.
   */
  const setViewMode = useCallback((mode: 'tabs' | 'list') => {
    updateUrlParam('view', mode, 'tabs')
  }, [updateUrlParam])

  // Material section anchors (#sectionName): show that section's tab and scroll to it.
  const [hash] = useLocationHash()
  useEffect(() => {
    const action = recordHashAction(hash)
    if (action?.type !== 'section') return
    const tabId = `section-${action.name}`
    if (viewMode === 'tabs' && tabs.some((tab) => tab.id === tabId)) setActiveTab(tabId)
    const frame = window.requestAnimationFrame(() => {
      document.querySelector(`[data-qqq-id="record-section-${CSS.escape(action.name)}"]`)?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
    // only a new hash moves the view; tab and mode changes must not re-apply it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  // CQ-MED-4: primarySections already captures all sections without an explicit tier
  // (via the `!s.tier` predicate), so the `|| visibleSections` fallback is redundant.
  const t1Sections = primarySections
  const parentPk = record.values[tableMetaData.primaryKeyField]

  // Build navigateFrom for outgoing record links — tells target page where to return.
  // Include current from/fromLabel so the back chain is preserved at unlimited depth:
  // A → B(from=A) → C(from=B?from=A) — back from C restores B which still knows to go back to A.
  const navigateFrom = useMemo(() => {
    const stateParams = new URLSearchParams()
    if (urlTab) stateParams.set('tab', urlTab)
    if (urlView) stateParams.set('view', urlView)
    if (fromPath) stateParams.set('from', fromPath)
    if (fromLabel) stateParams.set('fromLabel', fromLabel)
    const qs = stateParams.toString()
    const path = `${pathname}${qs ? `?${qs}` : ''}`
    const label = record.recordLabel || `${tableMetaData.label} #${parentPk}`
    return { path, label }
  }, [pathname, urlTab, urlView, fromPath, fromLabel, record.recordLabel, tableMetaData.label, parentPk])

  // Collect T1 fields, excluding those whose values are part of the record label
  const recordLabel = record.recordLabel ?? ''
  const t1Fields = t1Sections.flatMap((section) =>
    (section.fieldNames ?? [])
      .map((fn) => tableMetaData.fields[fn])
      .filter((f) => {
        if (!f || f.isHidden) return false
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

  const renderAssociation = (name: string, label?: string) => {
    const association = tableMetaData.associations?.find((item) => item.name === name)
    if (!association) return <p role="alert">Association binding is unavailable.</p>
    return <AssociatedRecords
      association={association}
      label={label}
      metadata={associationTables?.[association.associatedTableName]}
      records={record.associatedRecords?.[association.name]}
      parentTableMetaData={tableMetaData}
      parentRecord={record}
      allTables={allTables}
      navigateFrom={navigateFrom}
      onRecordCreated={onRefetch}
    />
  }

  // Context value shared with all subcomponents in the record detail subtree
  const contextValue = useMemo<RecordViewContextValue>(
    () => ({ tableMetaData, allTables, navigateFrom }),
    [tableMetaData, allTables, navigateFrom]
  )

  return (
    <RecordViewContext.Provider value={contextValue}>
      <div
        className={cn('space-y-5', className)}
        data-qqq-id={`record-view-${tableMetaData.name}`}
      >
        {/* Back link — returns to source page if navigated from another record, otherwise table list */}
        <Link
          href={safeFromPath || `/app/${tableMetaData.name}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-qqq-id="link-back-to-table"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {fromLabel || tableMetaData.label}
        </Link>

        {/* Record header — avatar + name + T1 fields + view-mode toggle + actions */}
        <RecordViewHeader
          tableMetaData={tableMetaData}
          record={record}
          t1Fields={t1Fields}
          viewMode={viewMode}
          setViewMode={setViewMode}
          hideActions={hideActions}
          processes={processes}
          allTables={allTables}
          navigateFrom={navigateFrom}
          auditSource={auditSource}
          widgetMetaDataMap={widgetMetaDataMap}
          onRecordChanged={onRefetch}
        />

        {viewMode === 'tabs' && t1Sections.filter((section) => section.widgetName).map((section) => (
          <RecordViewSection key={section.name} section={section} tableMetaData={tableMetaData} record={record}
            widgetMetaDataMap={widgetMetaDataMap} allTables={allTables} navigateFrom={navigateFrom}
            renderAssociation={renderAssociation} />
        ))}

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
          <RecordViewTabs
            tableMetaData={tableMetaData}
            record={record}
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            secondarySections={secondarySections}
            tertiarySections={tertiarySections}
            associations={associations}
            renderAssociation={renderAssociation}
            widgetMetaDataMap={widgetMetaDataMap}
            allTables={allTables}
            navigateFrom={navigateFrom}
          />
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
                  renderAssociation={renderAssociation}
                  tableMetaData={tableMetaData}
                  record={record}
                  widgetMetaDataMap={widgetMetaDataMap}
                  allTables={allTables}
                  navigateFrom={navigateFrom}
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
                  renderAssociation={renderAssociation}
                  tableMetaData={tableMetaData}
                  record={record}
                  widgetMetaDataMap={widgetMetaDataMap}
                  allTables={allTables}
                  navigateFrom={navigateFrom}
                  compact
                />
              </div>
            ))}

            {/* T3 sections as compact cards */}
            {tertiarySections.map((section) => (
              <div
                key={section.name}
                className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm"
              >
                <RecordViewSection
                  section={section}
                  renderAssociation={renderAssociation}
                  tableMetaData={tableMetaData}
                  record={record}
                  widgetMetaDataMap={widgetMetaDataMap}
                  allTables={allTables}
                  navigateFrom={navigateFrom}
                  compact
                />
              </div>
            ))}

            {/* Related records */}
            <RecordViewAssociated associations={associations} renderAssociation={renderAssociation} />
          </div>
        )}

        {/* No tabs/sections — just show all fields if nothing to tab */}
        {tabs.length === 0 && secondarySections.length === 0 && t1Fields.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <dl className="grid gap-x-8 gap-y-4 grid-cols-1 sm:grid-cols-2">
              {Object.values(tableMetaData.fields)
                .filter((f) => !f.isHidden)
                .map((field) => (
                  <div key={field.name} className="flex flex-col gap-0.5" data-qqq-id={`record-field-${field.name}`}>
                    <dt className="text-sm font-semibold text-foreground">
                      <FieldLabel field={field} data-qqq-id={`field-label-${field.name}`} />
                    </dt>
                    <dd>
                      <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} widgetMetaDataMap={widgetMetaDataMap} tableMetaData={tableMetaData} />
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        )}

      </div>
    </RecordViewContext.Provider>
  )
}
