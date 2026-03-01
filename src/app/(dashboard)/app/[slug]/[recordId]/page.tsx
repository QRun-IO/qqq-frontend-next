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
 * @file RecordView page — serves the route `/app/[slug]/[recordId]` and renders the record detail view.
 */

'use client'

/**
 * RecordView page — serves the route `/app/[slug]/[recordId]` and renders a
 * detailed view of a single QQQ record.
 *
 * Route params:
 * - `slug` — the QQQ table name.
 * - `recordId` — the primary-key value of the record to display.
 */

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

/**
 * Renders the detail view for a single record identified by `slug` (table name)
 * and `recordId` (primary key).
 *
 * Uses the `useRecord` hook to fetch the record including associations. Once
 * the record loads it is registered in the recently-viewed history (via
 * `addRecentRecord`) so it surfaces in the GlobalSearch and SearchDialog.
 * The page header in QContext is updated to the record label.
 *
 * @returns A composed view that assembles:
 *   - A full-screen spinner while table metadata resolves
 *   - `<RecordView>` wired with the fetched record, loading state, error state,
 *     a refetch callback, the list of available processes, and all table definitions
 *     (needed to render association sub-tables)
 */
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
