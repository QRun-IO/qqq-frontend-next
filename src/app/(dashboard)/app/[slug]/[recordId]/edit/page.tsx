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
 * @file EntityEdit page — serves the route `/app/[slug]/[recordId]/edit` and renders the edit form.
 */

'use client'

/**
 * EntityEdit page — serves the route `/app/[slug]/[recordId]/edit` and renders the
 * edit form for an existing QQQ record.
 *
 * Route params:
 * - `slug` — the QQQ table name.
 * - `recordId` — the primary-key value of the record to edit.
 */

import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useRouteParams } from '@/lib/hooks/use-route-params'
import { useQContext } from '@/lib/context/q-context'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { useRecord } from '@/lib/hooks/use-record'
import { recordLoadFailure } from '@/lib/utils/error-utils'
import { EntityForm } from '@/components/forms/EntityForm'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { canEditRecords, hasCapability } from '@/lib/auth/permissions'

/**
 * Renders the record-edit form for the record identified by `slug` and `recordId`.
 *
 * Fetches both application metadata and the existing record data via `useRecord`.
 * Shows a loading spinner while either is pending. Renders a permission error
 * when the user lacks `editPermission` on the table, and a fetch-error panel
 * when the record cannot be loaded. On success renders `<EntityForm>` in edit
 * mode (pre-populated with the existing record values).
 *
 * @returns A composed page that renders one of:
 *   - A full-screen spinner while metadata or record data is loading
 *   - A permission-error banner when the user lacks `editPermission`
 *   - A destructive error panel when the record cannot be fetched
 *   - `<EntityForm>` in edit mode (pre-populated with the existing record values)
 *     wrapped in a centered `max-w-4xl` container
 */
export default function EntityEditPage() {
  const params = useRouteParams<{ slug: string; recordId: string }>()
  const { setPageHeader, setTableMetaData } = useQContext()
  const { slug, recordId } = params

  const { data: metaData, isError: metadataError } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  const { data: tableMetaData, isError: tableError } = useTableMetaData(metaData?.tables?.[slug] ? slug : undefined)

  const { record, isLoading, isError, error } = useRecord({
    tableName: slug,
    primaryKey: recordId,
    enabled: canEditRecords(tableMetaData),
    includeAssociations: false,
  })

  useEffect(() => {
    setPageHeader(`Edit ${tableMetaData?.label ?? slug} #${recordId}`)
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

  if (!canEditRecords(tableMetaData)) {
    return (
      <div
        className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center"
        role="alert"
        data-qqq-id="permission-denied"
      >
        <p className="text-sm text-yellow-700">
          {!hasCapability(tableMetaData, 'TABLE_UPDATE')
            ? `${tableMetaData.label} records cannot be edited.`
            : `You do not have permission to edit ${tableMetaData.label} records.`}
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
    <div className="mx-auto max-w-4xl" data-qqq-id={`entity-edit-${slug}-${recordId}`}>
      <EntityForm tableMetaData={tableMetaData} record={record} widgets={metaData?.widgets} />
    </div>
  )
}
