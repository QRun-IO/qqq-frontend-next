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
 * @file EntityCopy page — copies a record by pre-populating the create form with existing values.
 */

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'

import { useRouteParams } from '@/lib/hooks/use-route-params'
import { useQContext } from '@/lib/context/q-context'
import { loadMetaData, loadTableMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { useRecord } from '@/lib/hooks/use-record'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import type { QTableMetaData } from '@/types'
import type { CopyNode } from '@/lib/utils/copy-tree'
import { copyTableNames, prepareCopyTree } from '@/lib/utils/copy-tree'
import { getErrorStatusCode, recordLoadFailure } from '@/lib/utils/error-utils'
import { canInsertRecords, canReadRecords, hasCapability } from '@/lib/auth/permissions'
import { EntityForm, type EntityFormProps } from '@/components/forms/EntityForm'
import { FullCopyDraft } from '@/components/forms/FullCopyDraft'

/**
 * Renders the entity copy form for the record identified by `slug` and `recordId`.
 *
 * Fetches full table metadata and the base source record, then renders `<EntityForm>`
 * in copy mode (`isCopy=true`) so field values are pre-populated but the form
 * will create a new record on submit. Shows a loading spinner while data is
 * pending, a permission error when the user lacks `insertPermission`, and a
 * fetch-error panel when the source record cannot be loaded.
 *
 * @returns A composed page that renders one of:
 *   - A full-screen spinner while metadata or record data is loading
 *   - A permission-error banner when the user lacks `insertPermission`
 *   - A destructive error panel when the source record cannot be fetched
 *   - `<EntityForm>` in copy mode (`isCopy=true`, pre-populated with source values)
 *     wrapped in a centered `max-w-4xl` container; submitting creates a new record
 */
export default function EntityCopyPage() {
  const params = useRouteParams<{ slug: string; recordId: string }>()
  return <CopyPageContent key={JSON.stringify(params)} slug={params.slug} recordId={params.recordId} />
}

/**
 * Own metadata/source loading while rendering components receive ready metadata.
 * @param props - Exact route identifiers.
 * @returns Base form and explicit full-copy draft flow.
 */
function CopyPageContent({ slug, recordId }: { slug: string; recordId: string }) {
  const { setPageHeader, setTableMetaData } = useQContext()
  const [mode, setMode] = useState<'base' | 'full'>('base')
  const [tree, setTree] = useState<CopyNode>()
  const [copyState, setCopyState] = useState<NonNullable<EntityFormProps['copyAssociations']>>()

  const { data: metaData, isError: metadataError } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  const { data: tableMetaData, isError: tableError } = useTableMetaData(metaData?.tables?.[slug] ? slug : undefined)

  const { record, isLoading, isError, error } = useRecord({
    tableName: slug,
    primaryKey: recordId,
    enabled: canInsertRecords(tableMetaData) && canReadRecords(tableMetaData),
    includeAssociations: false,
  })

  const expanded = useRecord({ tableName: slug, primaryKey: recordId, includeAssociations: true,
    enabled: mode === 'full' && !tree && canInsertRecords(tableMetaData) && canReadRecords(tableMetaData),
  })
  const sourceTables = useMemo(() => {
    if (!expanded.record) return { names: [] as string[] }
    try { return { names: copyTableNames(expanded.record).filter(name => name !== slug) } }
    catch (failure) { return { names: [] as string[], error: failure instanceof Error ? failure.message : 'Full copy source is invalid.' } }
  }, [expanded.record, slug])
  const targetQueries = useQueries({ queries: sourceTables.names.map(name => ({
    queryKey: queryKeys.tableMetadata(name), queryFn: () => loadTableMetaData(name), staleTime: 1000 * 60 * 30,
    enabled: mode === 'full' && !tree,
  })) })
  let fullError = sourceTables.error
  if (expanded.isError || targetQueries.some(query => query.isError)) {
    const accessDenied = (expanded.isError && getErrorStatusCode(expanded.error) === 403) ||
      targetQueries.some(query => query.isError && getErrorStatusCode(query.error) === 403)
    fullError = accessDenied
      ? 'You do not have access to all the information needed for Full Copy. Choose Base Copy to copy this record only.'
      : 'Full Copy could not load all required information. Reload to try again, or choose Base Copy.'
  }
  let prepared: CopyNode | undefined
  if (!tree && !fullError && expanded.record && record && tableMetaData && targetQueries.every(query => Boolean(query.data))) {
    const tables: Record<string, QTableMetaData> = { [slug]: tableMetaData }
    targetQueries.forEach((query, index) => { if (query.data) tables[sourceTables.names[index]] = query.data })
    try { prepared = prepareCopyTree(tableMetaData, { ...expanded.record, values: record.values }, tables) }
    catch (failure) { fullError = failure instanceof Error ? failure.message : 'Full copy source is invalid.' }
  }
  useEffect(() => { if (prepared && !tree) setTree(prepared) }, [prepared, tree])
  const unavailable = fullError ?? (!tree || !copyState ? 'Loading full copy source and metadata…' : undefined)
  const fullState = unavailable ? { getRecords: () => { throw new Error(unavailable) }, error: unavailable } : copyState

  useEffect(() => {
    setPageHeader(`Copy ${tableMetaData?.label ?? slug} #${recordId}`)
    if (tableMetaData) {
      setTableMetaData(tableMetaData)
    }
  }, [tableMetaData?.label, slug, recordId, tableMetaData, setPageHeader, setTableMetaData])

  if (metadataError || tableError || (metaData && !metaData.tables?.[slug])) {
    return <div role="alert" className="py-12 text-center text-destructive">Table metadata is unavailable.</div>
  }

  if (!tableMetaData || isLoading) {
    return (
      <div className="flex items-center justify-center py-16" aria-busy="true" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!tableMetaData.readPermission) {
    return <div role="alert" data-qqq-id="permission-denied" className="py-12 text-center text-destructive">You do not have permission to read the source {tableMetaData.label} record.</div>
  }

  if (!canInsertRecords(tableMetaData)) {
    return (
      <div
        className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center"
        role="alert"
        data-qqq-id="permission-denied"
      >
        <p className="text-sm text-yellow-700">
          {!hasCapability(tableMetaData, 'TABLE_INSERT')
            ? `${tableMetaData.label} records cannot be created.`
            : `You do not have permission to create ${tableMetaData.label} records.`}
        </p>
      </div>
    )
  }

  if (isError || !record) {
    return (
      <div
        className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center"
        role="alert"
      >
        <p className="text-sm text-destructive">
          {recordLoadFailure(tableMetaData.label, recordId, error)}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl" data-qqq-id={`entity-copy-${slug}-${recordId}`}>
      <fieldset className="mb-4 flex flex-wrap gap-4">
        <legend className="mb-2 font-medium">Copy scope</legend>
        <label className="flex items-center gap-2"><input type="radio" name="copy-mode" checked={mode === 'base'} onChange={() => setMode('base')} data-qqq-id="copy-mode-base" />Base copy</label>
        <label className="flex items-center gap-2"><input type="radio" name="copy-mode" checked={mode === 'full'} onChange={() => setMode('full')} data-qqq-id="copy-mode-full" />Full copy</label>
      </fieldset>
      <p className="mb-4 text-sm text-muted-foreground">{mode === 'base' ? 'Copy this record’s editable fields. Associated records are not copied.' : 'Copy editable fields and every loaded named association. A record reached through two named paths is copied twice. Normal insert defaults and validation apply. Limited to 64 association levels and 1000 associated records in this form.'}</p>
      <EntityForm
        tableMetaData={tableMetaData}
        widgets={metaData?.widgets}
        record={record}
        isCopy={true}
        copyAssociations={mode === 'full' ? fullState : undefined}
      >
        {tree && <fieldset hidden={mode !== 'full'} disabled={mode !== 'full'} className="min-w-0"><FullCopyDraft tree={tree} onChange={setCopyState} /></fieldset>}
      </EntityForm>
    </div>
  )
}
