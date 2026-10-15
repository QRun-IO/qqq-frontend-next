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
 * @file RecordDeveloperView — the record developer view (`/app/[slug]/[recordId]/dev`, loaded on
 * demand by its page so the route's first load stays small): the record screen's header and
 * actions, then a sticky section navigation over the record's fields (display and raw values),
 * API access (endpoints with curl, fetch and Java examples), the panels that developer panel
 * providers contribute (record security, ESB, quick search, SQL workbench, assistant, ... — each
 * only when its module is installed and active for the table), relations, recent audits,
 * associated scripts, raw JSON and a searchable view of the table metadata.
 */

'use client'

import React, { useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Code } from 'lucide-react'

import { useRouteParams } from '@/lib/hooks/use-route-params'
import { useMetaData } from '@/lib/hooks/use-metadata'
import { useQContext } from '@/lib/context/q-context'
import { SCRIPT_LOG_TABLE, getRecordDeveloperData } from '@/lib/api/developer'
import { getRecordDeveloperPanels } from '@/lib/api/developer-panels'
import { loadTableMetaData } from '@/lib/api/metadata'
import { auditSource } from '@/lib/api/audits'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { getProcessesForRecordView, getRecordActionProcesses } from '@/lib/utils/process-utils'
import { isSafeRedirectPath } from '@/lib/utils/string-utils'
import { AssociatedScriptViewer } from '@/components/records/AssociatedScriptViewer'
import { RecordViewHeader } from '@/components/records/RecordViewHeader'
import { scriptLogsQueryHref } from '@/components/scripts/script-utils'
import { CodeBlock } from '@/components/scripts/HighlightedCode'
import { CopyButton, DeveloperSection, DeveloperSectionNav, type DeveloperNavItem } from '@/components/developer/DeveloperSection'
import { DeveloperPanelView } from '@/components/developer/DeveloperPanelView'
import { RecordApiAccess } from '@/components/developer/RecordApiAccess'
import { RecordFieldValues } from '@/components/developer/RecordFieldValues'
import { RecentAuditSummary, RecordRelations, hasRelations } from '@/components/developer/RecordRelations'
import { TableMetadataExplorer } from '@/components/developer/TableMetadataExplorer'

/**
 * The view-mode setter the shared header needs; this screen has no card/list modes.
 * @returns Nothing.
 */
const NO_VIEW_MODE = () => undefined

/**
 * Renders the developer view of the record named by the route.
 *
 * @returns The page: loading and error states, then the record header and the developer sections.
 */
export function RecordDeveloperView() {
  const params = useRouteParams<{ slug: string; recordId: string }>()
  const { setPageHeader, setTableMetaData } = useQContext()
  const { slug, recordId } = params
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { data: instance } = useMetaData()
  const { data: table, isLoading: tableLoading, error: tableError } = useQuery({
    queryKey: queryKeys.tableMetadata(slug),
    queryFn: () => loadTableMetaData(slug),
    staleTime: 1000 * 60 * 30,
  })
  // The developer-mode route returns the record (with display values) and its associated scripts.
  const { data: developerData, isLoading: recordLoading, error: recordError } = useQuery({
    queryKey: queryKeys.recordDeveloper(slug, recordId),
    queryFn: () => getRecordDeveloperData(slug, recordId),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const record = developerData?.record
  const panelsQuery = useQuery({
    queryKey: queryKeys.recordDeveloperPanels(slug, recordId),
    queryFn: () => getRecordDeveloperPanels(slug, recordId),
    enabled: Boolean(record),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const panels = useMemo(() => panelsQuery.data ?? [], [panelsQuery.data])

  const recordLabel = record?.recordLabel || (table ? `${table.label} #${recordId}` : `${slug} #${recordId}`)
  useEffect(() => {
    setPageHeader(`${recordLabel} Developer Mode`)
    if (table) setTableMetaData(table)
  }, [recordLabel, table, setPageHeader, setTableMetaData])

  const reloadRecord = useCallback(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.recordDeveloper(slug, recordId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tableRecord(slug, recordId) }),
  ]), [queryClient, slug, recordId])

  const processes = useMemo(() => (instance ? getProcessesForRecordView(instance, slug) : []), [instance, slug])
  const actionProcesses = useMemo(() => getRecordActionProcesses(processes, slug), [processes, slug])
  const audits = auditSource(instance, table?.clientCapabilities)

  // Back goes to the record screen (or to where the user came from on it, when that is the record screen).
  const fromPath = searchParams.get('from')
  const recordPath = `/app/${encodeURIComponent(slug)}/${encodeURIComponent(recordId)}`
  const backHref = fromPath && isSafeRedirectPath(fromPath) && fromPath.startsWith(recordPath) ? fromPath : recordPath
  const navigateFrom = useMemo(() => ({ path: pathname, label: `${recordLabel} (developer)` }), [pathname, recordLabel])

  if (recordLoading || tableLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-live="polite" aria-busy="true">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="sr-only">Loading developer view</span>
      </div>
    )
  }

  if (recordError || tableError || !record || !table) {
    return (
      <div className="space-y-4" data-qqq-id={`record-dev-${slug}-${recordId}`}>
        <BackLink href={backHref} label={recordLabel} />
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          Failed to load record: {getErrorMessage(recordError ?? tableError ?? new Error('Record not found'))}
        </div>
      </div>
    )
  }

  const primaryKey = (record.values[table.primaryKeyField] ?? recordId) as string | number
  const showRelations = hasRelations(table, record, instance?.tables)
  const associatedScripts = developerData?.associatedScripts ?? []
  const logsViewAllHref = instance?.tables?.[SCRIPT_LOG_TABLE] ? scriptLogsQueryHref : undefined
  const rawJson = JSON.stringify(record.values, null, 2)

  const navItems: DeveloperNavItem[] = [
    { id: 'fields', label: 'Fields' },
    { id: 'api', label: 'API' },
    ...panels.map((panel) => ({ id: `panel-${panel.id}`, label: panel.title })),
    ...(showRelations ? [{ id: 'relations', label: 'Relations' }] : []),
    ...(audits ? [{ id: 'audit', label: 'Audit' }] : []),
    ...(associatedScripts.length ? [{ id: 'scripts', label: 'Scripts' }] : []),
    { id: 'json', label: 'JSON' },
    { id: 'metadata', label: 'Table Metadata' },
  ]

  return (
    <div className="min-w-0 space-y-4" data-qqq-id={`record-dev-${slug}-${recordId}`}>
      <div className="flex flex-wrap items-center gap-3">
        <BackLink href={backHref} label={recordLabel} />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground" data-qqq-id="record-dev-badge">
          <Code className="h-3.5 w-3.5" aria-hidden="true" />
          Developer view · <span className="font-mono">{table.name}</span>
        </span>
      </div>

      <RecordViewHeader
        tableMetaData={table}
        record={record}
        t1Fields={[]}
        viewMode="tabs"
        setViewMode={NO_VIEW_MODE}
        showViewModeToggle={false}
        hideActions={false}
        processes={processes}
        allProcesses={instance?.processes}
        allTables={instance?.tables}
        navigateFrom={navigateFrom}
        auditSource={audits}
        widgetMetaDataMap={instance?.widgets}
        onRecordChanged={reloadRecord}
      />

      <DeveloperSectionNav items={navItems} />

      <DeveloperSection id="fields" title="Fields" description="Each field's value as the record screen shows it, and its raw value.">
        <RecordFieldValues table={table} record={record} allTables={instance?.tables} widgetMetaDataMap={instance?.widgets} navigateFrom={navigateFrom} />
      </DeveloperSection>

      <DeveloperSection id="api" title="API Access" description="Requests you can make for this record, with examples built from its values.">
        <RecordApiAccess table={table} record={record} processes={actionProcesses} />
      </DeveloperSection>

      {panelsQuery.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading developer panels…</p>}
      {panelsQuery.isError && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Developer panels could not be loaded: {getErrorMessage(panelsQuery.error)}
        </p>
      )}
      {panels.map((panel) => (
        <DeveloperPanelView key={panel.id} panel={panel} tableName={table.name} primaryKey={primaryKey} returnTo={pathname} />
      ))}

      {showRelations && (
        <DeveloperSection id="relations" title="Relations" description="Records this record references, its associations and the joins exposed on its table.">
          <RecordRelations table={table} record={record} allTables={instance?.tables} />
        </DeveloperSection>
      )}

      {audits && (
        <DeveloperSection id="audit" title="Audit" description="The record's most recent changes.">
          <RecentAuditSummary source={audits} table={table} primaryKey={primaryKey} recordLabel={recordLabel} />
        </DeveloperSection>
      )}

      {associatedScripts.length > 0 && (
        <DeveloperSection id="scripts" title="Associated Scripts">
          {associatedScripts.map((associated) => {
            const fieldName = associated.associatedScript.fieldName
            const scriptId = record.values[fieldName]
            return (
              <AssociatedScriptViewer
                key={fieldName}
                tableName={slug}
                recordId={recordId}
                fieldLabel={table.fields[fieldName]?.label ?? fieldName}
                data={associated}
                scriptId={typeof scriptId === 'string' || typeof scriptId === 'number' ? scriptId : null}
                canCreate={Boolean(table.editPermission)}
                canEdit={Boolean(instance?.processes?.storeScriptRevision)}
                canTest={Boolean(instance?.processes?.testScript)}
                logsViewAllHref={logsViewAllHref}
                onChanged={reloadRecord}
              />
            )
          })}
        </DeveloperSection>
      )}

      <DeveloperSection id="json" title="Record Raw Values as JSON" actions={<CopyButton text={rawJson} label="Copy record JSON" />}>
        <CodeBlock code={rawJson} language="json" className="max-h-[32rem]" dataQqqId="json-output" />
      </DeveloperSection>

      <DeveloperSection id="metadata" title="Table Metadata" defaultCollapsed>
        <TableMetadataExplorer table={table} />
      </DeveloperSection>
    </div>
  )
}

/**
 * Link back to the record screen.
 *
 * @param props - Target and record label.
 * @param props.href - The record screen path.
 * @param props.label - The record's label.
 * @returns The link.
 */
function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-qqq-id="record-dev-back"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to {label}
    </Link>
  )
}
