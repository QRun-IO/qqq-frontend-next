'use client'

// RecordView page — view a single record
// Package 3: full implementation using RecordView component + useRecord hook

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { addRecentRecord } from '@/lib/utils/recent-records'
import { getProcessesForTable } from '@/lib/utils/process-utils'
import { useQContext } from '@/lib/context/q-context'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { useRecord } from '@/lib/hooks/use-record'
import { RecordView } from '@/components/records/RecordView'

export default function RecordViewPage() {
  const params = useParams<{ slug: string; recordId: string }>()
  const { setPageHeader, setTableMetaData } = useQContext()
  const { slug, recordId } = params

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })

  const tableMetaData = metaData?.tables?.[slug]

  const { record, isLoading, isError, error, refetch } = useRecord({
    tableName: slug,
    primaryKey: recordId,
    enabled: Boolean(tableMetaData),
    includeAssociations: true,
  })

  useEffect(() => {
    if (record?.recordLabel) {
      setPageHeader(record.recordLabel)
    } else {
      setPageHeader(`${tableMetaData?.label ?? slug} #${recordId}`)
    }
    if (tableMetaData) {
      setTableMetaData(tableMetaData)
    }
  }, [record, tableMetaData, slug, recordId, setPageHeader, setTableMetaData])

  // Track recently viewed records for global search
  useEffect(() => {
    if (record && tableMetaData) {
      addRecentRecord({
        tableName: tableMetaData.name,
        tableLabel: tableMetaData.label,
        recordId: String(record.values[tableMetaData.primaryKeyField]),
        recordLabel: record.recordLabel || `${tableMetaData.label} #${record.values[tableMetaData.primaryKeyField]}`,
        path: `/app/${tableMetaData.name}/${record.values[tableMetaData.primaryKeyField]}`,
      })
    }
  }, [record, tableMetaData])

  if (!tableMetaData) {
    return (
      <div className="flex items-center justify-center py-16" aria-busy="true" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const tableProcesses = metaData ? getProcessesForTable(metaData, slug) : []

  return (
    <RecordView
      tableMetaData={tableMetaData}
      record={record}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRefetch={refetch}
      processes={tableProcesses}
      allTables={metaData?.tables}
    />
  )
}
