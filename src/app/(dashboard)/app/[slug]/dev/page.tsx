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
 * @file Developer view page — resolves the slug to a table or a process. For a table it shows raw
 * table metadata as formatted JSON for debugging field definitions and permissions; for a process,
 * its metadata summary and JSON; for either, its ESB publications and triggers when it has any.
 */

'use client'

import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Code, ChevronDown, ChevronUp } from 'lucide-react'

import { useRouteParams } from '@/lib/hooks/use-route-params'
import { useQContext } from '@/lib/context/q-context'
import { useMetaData, useProcessMetaData } from '@/lib/hooks/use-metadata'
import { loadTableMetaData } from '@/lib/api/metadata'
import { getEsbForProcess, getEsbForTable } from '@/lib/api/esb'
import { queryKeys } from '@/lib/query-client'
import { EsbSection } from '@/components/esb/EsbSection'
import { ProcessDeveloperView } from '@/components/esb/ProcessDeveloperView'

/**
 * Renders the Developer view for the table or process named by the slug. A slug naming both
 * resolves to the table, as it does on the slug page; a slug naming neither (or instance metadata
 * that fails to load) falls through to the table view, which reports the load failure.
 *
 * @returns A spinner while instance metadata loads, then `<ProcessDeveloperPage>` for a process
 *   slug or `<TableDeveloperView>` otherwise.
 */
export default function DeveloperViewPage() {
  const params = useRouteParams<{ slug: string }>()
  const { setPageHeader } = useQContext()
  const slug = params.slug
  const { data: metaData, isError: metaDataError } = useMetaData()

  useEffect(() => {
    setPageHeader(`Developer View: ${slug}`)
  }, [slug, setPageHeader])

  if (!metaData && !metaDataError) return <LoadingSpinner />
  const isProcess = Boolean(metaData && !metaData.tables?.[slug] && metaData.processes?.[slug])
  return isProcess ? <ProcessDeveloperPage processName={slug} /> : <TableDeveloperView tableName={slug} />
}

/**
 * Loads a process's metadata and ESB data and renders its Developer view.
 *
 * @param props - Component props.
 * @param props.processName - The process to show.
 * @returns A spinner while metadata loads, a destructive error panel on failure, then the
 *   `<ProcessDeveloperView>` (without an ESB section on 403, 404, or a backend without the ESB module).
 */
function ProcessDeveloperPage({ processName }: { processName: string }) {
  const { data, error } = useProcessMetaData(processName)
  const { data: esb } = useQuery({
    queryKey: queryKeys.esbProcess(processName),
    queryFn: () => getEsbForProcess(processName),
  })

  if (error) return <LoadError error={error} />
  if (!data) return <LoadingSpinner />
  return <ProcessDeveloperView process={data} esb={esb ?? null} />
}

/**
 * Renders a developer debug view for a QQQ table, showing summary statistics
 * and the full table metadata as a collapsible JSON block.
 *
 * @param props - Component props.
 * @param props.tableName - The table to show.
 * @returns A composed view that assembles:
 *   - A 4-column stats grid (`<MetaStat>` cards: field count, section count, permissions, primary key)
 *   - An `<EsbSection>` with the table's ESB publications and subscribers, omitted when the
 *     table has none to show (403, 404, or a backend without the ESB module)
 *   - A collapsible `<JsonBlock>` panel rendering the full table metadata as formatted JSON
 *   - A loading spinner while metadata is fetching, and a destructive error panel on failure
 */
function TableDeveloperView({ tableName }: { tableName: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.tableMetadata(tableName),
    queryFn: () => loadTableMetaData(tableName),
    staleTime: 1000 * 60 * 5,
  })

  const { data: esb } = useQuery({
    queryKey: queryKeys.esbTable(tableName),
    queryFn: () => getEsbForTable(tableName),
  })

  return (
    <div className="space-y-6" data-qqq-id={`table-dev-${tableName}`}>
      <div className="flex items-center gap-3">
        <Code className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-foreground">
          Table Developer View: <span className="font-mono text-primary">{tableName}</span>
        </h2>
      </div>

      {isLoading && <LoadingSpinner />}

      {error && <LoadError error={error} />}

      {data && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetaStat label="Fields" value={Object.keys(data.fields ?? {}).length} />
            <MetaStat label="Sections" value={(data.sections ?? []).length} />
            <MetaStat
              label="Capabilities"
              value={[
                data.insertPermission ? 'Insert' : null,
                data.editPermission ? 'Edit' : null,
                data.deletePermission ? 'Delete' : null,
              ]
                .filter(Boolean)
                .join(', ') || 'Read-only'}
            />
            <MetaStat label="Primary Key" value={data.primaryKeyField ?? '—'} />
          </div>

          <EsbSection data={esb ?? null} />

          {/* Raw JSON */}
          <JsonBlock label="Full Table Metadata" value={data} defaultOpen={false} />
        </div>
      )}
    </div>
  )
}

/**
 * A centered spinner announced as busy.
 *
 * @returns The loading indicator.
 */
function LoadingSpinner() {
  return (
    <div
      className="flex items-center justify-center py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

/**
 * A destructive panel reporting a metadata load failure.
 *
 * @param props - Component props.
 * @param props.error - The load error.
 * @returns The error panel.
 */
function LoadError({ error }: { error: unknown }) {
  return (
    <div
      className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
      role="alert"
    >
      Failed to load metadata: {error instanceof Error ? error.message : 'Unknown error'}
    </div>
  )
}

/**
 * Renders a single labeled statistic card.
 *
 * @param props - Component props.
 * @param props.label - The stat label displayed above the value.
 * @param props.value - The numeric or string value to display prominently.
 * @returns A bordered card showing the label and value.
 */
function MetaStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">
        {value}
      </p>
    </div>
  )
}

/**
 * Collapsible card that renders a JSON value as a formatted `<pre>` block.
 *
 * @param props - Component props.
 * @param props.label - Heading displayed in the toggle button.
 * @param props.value - The value to serialize and display as JSON.
 * @param props.defaultOpen - Whether the panel starts expanded. Defaults to `true`.
 * @returns A collapsible JSON inspector card.
 */
function JsonBlock({
  label,
  value,
  defaultOpen = true,
}: {
  label: string
  value: unknown
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-muted px-4 py-3 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
        aria-expanded={open}
        data-qqq-id="button-json-block-toggle"
      >
        <span className="flex items-center gap-2">
          <Code className="h-4 w-4" aria-hidden="true" />
          {label}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {open && (
        <pre
          className="overflow-x-auto bg-gray-900 p-4 text-xs text-green-300"
          data-qqq-id="json-output"
        >
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  )
}
