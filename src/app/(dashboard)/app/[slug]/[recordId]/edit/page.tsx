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
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { useQContext } from '@/lib/context/q-context'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { useRecord } from '@/lib/hooks/use-record'
import { EntityForm } from '@/components/forms/EntityForm'

/**
 * Renders the record-edit form for the record identified by `slug` and `recordId`.
 *
 * Fetches both application metadata and the existing record data via `useRecord`.
 * Shows a loading spinner while either is pending. Renders a permission error
 * when the user lacks `editPermission` on the table, and a fetch-error panel
 * when the record cannot be loaded. On success renders `<EntityForm>` in edit
 * mode (pre-populated with the existing record values).
 *
 * @returns The entity edit form, a loading spinner, or an error/permission panel.
 */
export default function EntityEditPage() {
  const params = useParams<{ slug: string; recordId: string }>()
  const { setPageHeader, setTableMetaData } = useQContext()
  const { slug, recordId } = params

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  const tableMetaData = metaData?.tables?.[slug]

  const { record, isLoading, isError, error } = useRecord({
    tableName: slug,
    primaryKey: recordId,
    enabled: Boolean(tableMetaData),
  })

  useEffect(() => {
    setPageHeader(`Edit ${tableMetaData?.label ?? slug} #${recordId}`)
    if (tableMetaData) {
      setTableMetaData(tableMetaData)
    }
  }, [tableMetaData?.label, slug, recordId, tableMetaData, setPageHeader, setTableMetaData])

  if (!tableMetaData || isLoading) {
    return (
      <div className="flex items-center justify-center py-16" aria-busy="true" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!tableMetaData.editPermission) {
    return (
      <div
        className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center"
        role="alert"
      >
        <p className="text-sm text-yellow-700">
          You do not have permission to edit {tableMetaData.label} records.
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
          {error?.message ?? `Failed to load ${tableMetaData.label} #${recordId}`}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl" data-qqq-id={`entity-edit-${slug}-${recordId}`}>
      <EntityForm tableMetaData={tableMetaData} record={record} />
    </div>
  )
}
