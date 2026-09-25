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
 * @file SavedView page — the record query screen opened with a backend saved view
 * (`/app/{table}/savedView/{id}`), as in the Material dashboard.
 */

'use client'

import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useRouteParams } from '@/lib/hooks/use-route-params'
import { useQContext } from '@/lib/context/q-context'
import { loadMetaData } from '@/lib/api/metadata'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { queryKeys } from '@/lib/query-client'
import { getProcessesForTable } from '@/lib/utils/process-utils'
import { RecordQuery } from '@/components/query'

/**
 * Saved view route: resolves the table and renders its query screen with the view applied.
 *
 * @returns The query screen, a loading indicator, or an error for unknown tables or ids.
 */
export default function SavedViewPage() {
  const { slug, viewId } = useRouteParams<{ slug: string; viewId: string }>()
  const { setPageHeader, setTableMetaData } = useQContext()
  const { data: metaData, isError: metadataError } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })
  const isTable = Boolean(metaData?.tables?.[slug])
  const { data: table, isError: tableError } = useTableMetaData(isTable ? slug : undefined)
  const id = /^\d+$/.test(viewId) ? Number(viewId) : NaN

  useEffect(() => {
    setPageHeader(table?.label ?? slug)
    if (table) setTableMetaData(table)
  }, [slug, table, setPageHeader, setTableMetaData])

  if (metadataError || tableError || (metaData && !isTable) || !Number.isFinite(id)) {
    return (
      <div role="alert" className="py-12 text-center text-destructive" data-qqq-id={`saved-view-${slug}-${viewId}`}>
        {metaData && !isTable ? <>Unknown table: <code className="font-mono">{slug}</code></> : !Number.isFinite(id) ? 'The requested view was not found.' : 'Failed to load table metadata.'}
      </div>
    )
  }

  if (!metaData || !table) {
    return (
      <div role="status" aria-label="Loading saved view" className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <RecordQuery
      key={`${slug}-${id}`}
      tableName={slug}
      tableMetaData={table}
      allTables={metaData.tables}
      processes={getProcessesForTable(metaData, slug)}
      metaData={metaData}
      savedViewId={id}
    />
  )
}
