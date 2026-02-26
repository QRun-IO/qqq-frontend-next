'use client'

// EntityCopy — copy a record (pre-populates form with existing values)
// Package 3: full implementation using EntityForm with isCopy=true

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { useQContext } from '@/lib/context/q-context'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { useRecord } from '@/lib/hooks/use-record'
import { EntityForm } from '@/components/forms/EntityForm'

export default function EntityCopyPage() {
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
    setPageHeader(`Copy ${tableMetaData?.label ?? slug} #${recordId}`)
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

  if (!tableMetaData.insertPermission) {
    return (
      <div
        className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center"
        role="alert"
      >
        <p className="text-sm text-yellow-700">
          You do not have permission to create {tableMetaData.label} records.
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
    <div className="mx-auto max-w-4xl" data-qqq-id={`entity-copy-${slug}-${recordId}`}>
      <EntityForm
        tableMetaData={tableMetaData}
        record={record}
        isCopy={true}
      />
    </div>
  )
}
