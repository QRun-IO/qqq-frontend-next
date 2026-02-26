'use client'

// EntityCreate — create a new record
// Package 3: full implementation using EntityForm component

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { useQContext } from '@/lib/context/q-context'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { EntityForm } from '@/components/forms/EntityForm'

export default function EntityCreatePage() {
  const params = useParams<{ slug: string }>()
  const { setPageHeader, setTableMetaData } = useQContext()
  const slug = params.slug

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  const tableMetaData = metaData?.tables?.[slug]

  useEffect(() => {
    setPageHeader(`Create ${tableMetaData?.label ?? slug}`)
    if (tableMetaData) {
      setTableMetaData(tableMetaData)
    }
  }, [tableMetaData?.label, slug, tableMetaData, setPageHeader, setTableMetaData])

  if (!tableMetaData) {
    return (
      <div className="flex items-center justify-center py-16" aria-busy="true" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!tableMetaData.insertPermission) {
    return (
      <div
        className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center dark:border-yellow-800 dark:bg-yellow-900/20"
        role="alert"
      >
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          You do not have permission to create {tableMetaData.label} records.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl" data-qqq-id={`entity-create-${slug}`}>
      <EntityForm tableMetaData={tableMetaData} />
    </div>
  )
}
