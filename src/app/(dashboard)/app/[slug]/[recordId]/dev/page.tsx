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
 * @file RecordDeveloperView page — raw record values and table metadata as JSON, plus the
 * record's associated scripts (versions, code, editing, logs, testing, docs).
 */

'use client'

import React, { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Code, ChevronDown, ChevronUp } from 'lucide-react'

import { useRouteParams } from '@/lib/hooks/use-route-params'
import { useMetaData } from '@/lib/hooks/use-metadata'
import { useQContext } from '@/lib/context/q-context'
import { getRecordDeveloperData } from '@/lib/api/developer'
import { getRecord } from '@/lib/api/tables'
import { loadTableMetaData } from '@/lib/api/metadata'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { AssociatedScriptViewer } from '@/components/records/AssociatedScriptViewer'

/**
 * Renders a developer debug view for a single record, showing all field values
 * in a table and the raw record and table metadata as collapsible JSON blocks.
 *
 * @returns A composed page that assembles:
 *   - A field-values summary table (field name, type, raw value for every field in the record)
 *   - A `<JsonBlock>` for the raw record values (expanded by default)
 *   - An `<AssociatedScriptViewer>` card per associated script declared on the table
 *   - A `<JsonBlock>` for the full table metadata (collapsed by default)
 *   - A loading spinner while either query is in-flight, and an error panel if the record fetch fails
 */
export default function RecordDeveloperViewPage() {
  const params = useRouteParams<{ slug: string; recordId: string }>()
  const { setPageHeader } = useQContext()
  const { slug, recordId } = params
  const queryClient = useQueryClient()

  const { data: record, isLoading: recordLoading, error: recordError } = useQuery({
    queryKey: queryKeys.tableRecord(slug, recordId),
    queryFn: () => getRecord(slug, recordId),
    staleTime: 1000 * 60 * 5,
  })

  const { data: metaData, isLoading: metaLoading } = useQuery({
    queryKey: queryKeys.tableMetadata(slug),
    queryFn: () => loadTableMetaData(slug),
    staleTime: 1000 * 60 * 30,
  })

  const { data: instance } = useMetaData()
  const { data: developerData, error: developerError } = useQuery({
    queryKey: queryKeys.recordDeveloper(slug, recordId),
    queryFn: () => getRecordDeveloperData(slug, recordId),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })

  const headerLabel = record?.recordLabel || (metaData ? `${metaData.label} ${recordId}` : `${slug} #${recordId}`)
  useEffect(() => {
    setPageHeader(`${headerLabel} Developer Mode`)
  }, [headerLabel, setPageHeader])

  const reloadRecord = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.tableRecord(slug, recordId) }),
    [queryClient, slug, recordId]
  )

  const isLoading = recordLoading || metaLoading
  const canEditScripts = Boolean(instance?.processes?.storeScriptRevision)
  const canTestScripts = Boolean(instance?.processes?.testScript)

  return (
    <div className="space-y-6" data-qqq-id={`record-dev-${slug}-${recordId}`}>
      <div className="flex items-center gap-3">
        <Code className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-foreground">
          Record Developer View:{' '}
          <span className="font-mono text-primary">{slug}</span>
          {' '}
          <span className="font-mono text-muted-foreground">#{recordId}</span>
        </h2>
      </div>

      {isLoading && (
        <div
          className="flex items-center justify-center py-12"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {recordError && (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          Failed to load record: {recordError instanceof Error ? recordError.message : 'Unknown error'}
        </div>
      )}

      {!isLoading && record && (
        <div className="space-y-4">
          {/* Field values summary */}
          {metaData && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm" data-qqq-id="record-dev-field-table">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-foreground">
                      Field
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-foreground">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-foreground">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(record.values).map(([fieldName, value]) => {
                    const field = metaData.fields[fieldName]
                    return (
                      <tr
                        key={fieldName}
                        className="border-t border-border"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-primary">
                          {fieldName}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                          {field?.type ?? '—'}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-foreground">
                          {value === null || value === undefined
                            ? <span className="text-muted-foreground italic">null</span>
                            : String(value)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <JsonBlock label="Record Raw Values as JSON" value={record.values} />

          {developerError && (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              role="alert"
            >
              Failed to load associated scripts: {getErrorMessage(developerError)}
            </div>
          )}
          {metaData && developerData?.associatedScripts.map((associated) => {
            const fieldName = associated.associatedScript.fieldName
            const scriptId = developerData.record.values[fieldName]
            return (
              <AssociatedScriptViewer
                key={fieldName}
                tableName={slug}
                recordId={recordId}
                fieldLabel={metaData.fields[fieldName]?.label ?? fieldName}
                data={associated}
                scriptId={typeof scriptId === 'string' || typeof scriptId === 'number' ? scriptId : null}
                canCreate={Boolean(metaData.editPermission)}
                canEdit={canEditScripts}
                canTest={canTestScripts}
                onChanged={reloadRecord}
              />
            )
          })}

          {metaData && <JsonBlock label="Table Metadata" value={metaData} defaultOpen={false} />}
        </div>
      )}
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
      <h3 className="m-0">
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
      </h3>
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
