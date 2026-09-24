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
 * @file Unified slug page — dispatches to AppHome, RecordQuery, ProcessRun, or ReportRun based on the slug.
 */

'use client'

/**
 * Unified slug page — serves the route `/app/[slug]` and dispatches to
 * `AppHome`, `RecordQuery`, or `ProcessRun` based on how the slug resolves
 * against the QQQ application metadata.
 *
 * Route params:
 * - `slug` — a QQQ app name, table name, process name, or report name.
 */

import React, { useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import type { QInstance } from '@/types'
import { useQContext } from '@/lib/context/q-context'
import { loadMetaData } from '@/lib/api/metadata'
import { useProcessMetaData, useTableMetaData } from '@/lib/hooks/use-metadata'
import type { ProcessInitRequest } from '@/lib/api/processes'
import { queryKeys } from '@/lib/query-client'
import { getProcessesForTable } from '@/lib/utils/process-utils'
import { RecordQuery } from '@/components/query'
import { ProcessRun } from '@/components/process'
import { AppHome } from '@/components/widgets'
import { ReportRun } from '@/components/reports'

/**
 * Resolves a URL slug to its QQQ resource type and name.
 *
 * Checks the slug against apps, tables, processes, and reports in priority order.
 * Returns a discriminated union describing the match, or `null` when the slug is
 * not found in any category.
 *
 * Extracted as a named function for testability — the caller (`SlugPage`) passes
 * the already-fetched metadata so this function remains a pure mapping with no
 * side effects or data fetching.
 *
 * @param slug - The URL path segment to resolve (e.g. `"orders"` or `"importData"`).
 * @param metaData - The full QQQ instance metadata fetched from the backend.
 * @returns A `{ type, name }` object describing the resolved resource, or `null`.
 */
export function resolveSlugTarget(
  slug: string,
  metaData: QInstance
): { type: 'app' | 'table' | 'process' | 'report'; name: string } | null {
  if (metaData.apps?.[slug]) {
    return { type: 'app', name: slug }
  }
  if (metaData.tables?.[slug]) {
    return { type: 'table', name: slug }
  }
  if (metaData.processes?.[slug]) {
    return { type: 'process', name: slug }
  }
  if (metaData.reports?.[slug]) {
    return { type: 'report', name: slug }
  }
  return null
}

/**
 * Renders the appropriate page component for a given `slug` URL segment.
 *
 * Resolution priority:
 * 1. If the slug matches a QQQ **app** → renders `<AppHome>` (dashboard widgets).
 * 2. If the slug matches a **table** → renders `<RecordQuery>` (data grid + filters).
 * 3. If the slug matches a **process** → renders `<ProcessRun>` (step wizard).
 * 4. If the slug matches a **report** → renders `<ReportRun>` (format selector + download).
 * 5. Otherwise → renders an unknown-resource message.
 *
 * The page header in QContext is updated whenever the resolution changes.
 *
 * @returns A composed page selected by slug resolution:
 *   - `<AppHome>` (dashboard widgets) when the slug matches a QQQ app
 *   - `<RecordQuery>` (data grid + filters + pagination) when the slug matches a table
 *   - `<ProcessRun>` (step wizard) when the slug matches a process
 *   - `<ReportRun>` (format selector + download) when the slug matches a report
 *   - A full-screen spinner while metadata is loading or the resource is resolving
 *   - An unknown-resource message panel when the slug does not match any resource
 */
export default function SlugPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const { setPageHeader, setTableMetaData } = useQContext()
  const slug = params.slug

  const { data: metaData, isError: metadataError } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  // Determine what this slug is
  const isApp = Boolean(metaData?.apps?.[slug])
  const isTable = Boolean(metaData?.tables?.[slug])
  const isProcess = Boolean(metaData?.processes?.[slug])
  const isReport = Boolean(metaData?.reports?.[slug])

  const app = metaData?.apps?.[slug]
  const { data: table, isError: tableError } = useTableMetaData(isTable && !isApp ? slug : undefined)
  const { data: process, isError: processError } = useProcessMetaData(isProcess && !isApp && !isTable ? slug : undefined)
  const report = metaData?.reports?.[slug]

  useEffect(() => {
    if (isApp) {
      setPageHeader(app?.label ?? slug)
    } else if (isTable) {
      setPageHeader(table?.label ?? slug)
      if (table) setTableMetaData(table)
    } else if (isProcess) {
      setPageHeader(process?.label ?? slug)
    } else if (isReport) {
      setPageHeader(report?.label ?? slug)
    } else {
      setPageHeader(slug)
    }
  }, [isApp, isTable, isProcess, isReport, app, table, process, report, slug, setPageHeader, setTableMetaData])

  if (metadataError || (isTable && !isApp && tableError) || (isProcess && !isApp && !isTable && processError)) {
    return (
      <div role="alert" className="py-12 text-center text-destructive">
        Failed to load {metadataError ? 'application' : isTable ? 'table' : 'process'} metadata.
      </div>
    )
  }

  if (!metaData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // App dashboard — Package 5 implementation
  if (isApp && app) {
    return (
      <AppHome
        appMetaData={app}
        widgetRegistry={metaData.widgets ?? {}}
      />
    )
  }

  // Table record query — Package 2 implementation
  if (isTable && table) {
    const tableProcesses = getProcessesForTable(metaData, slug)
    return <RecordQuery tableName={slug} tableMetaData={table} allTables={metaData.tables} processes={tableProcesses} />
  }

  // Table loading state (table found but metadata not yet available)
  if (isTable && !table) {
    return (
      <div role="status" aria-label="Loading table metadata" className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Process run — Package 4 implementation
  if (isProcess && process) {
    const initialRequest: ProcessInitRequest = {}
    const selection = searchParams.get('recordsParam')
    if (selection === 'recordIds') {
      initialRequest.recordsParam = 'recordIds'
      initialRequest.recordIds = searchParams.get('recordIds') ?? ''
    } else if (selection === 'filterJSON' || selection === 'queryFilter') {
      initialRequest.recordsParam = 'filterJSON'
      initialRequest.filterJSON = searchParams.get('filterJSON') ?? ''
    }
    return <ProcessRun key={`${slug}?${searchParams}`} processName={slug} processMetaData={process} initialRequest={initialRequest} />
  }

  // Process loading state (process found but metadata not yet available)
  if (isProcess && !process) {
    return (
      <div role="status" aria-label="Loading process metadata" className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Report run
  if (isReport && report) {
    return <ReportRun reportName={slug} reportMetaData={report} />
  }

  // Report loading state (report found but metadata not yet available)
  if (isReport && !report) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Unknown slug
  return (
    <div className="space-y-4" data-qqq-id={`unknown-slug-${slug}`}>
      <h2 className="text-2xl font-semibold text-foreground">{slug}</h2>
      <div className="rounded-xl border border-dashed border-border bg-muted p-12 text-center">
        <p className="text-muted-foreground">
          Unknown resource: <code className="font-mono">{slug}</code>
        </p>
      </div>
    </div>
  )
}
