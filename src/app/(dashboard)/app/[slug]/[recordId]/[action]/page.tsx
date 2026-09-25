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
 * @file Record-scoped process route — `/app/{table}/{id}/{process}`, the Material Dashboard
 * URL that runs one of the table's processes for a single record.
 */

'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { useRouteParams } from '@/lib/hooks/use-route-params'
import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { processRunHref, tableProcessForSegment } from '@/lib/utils/material-links'
import { launchTableName } from '@/lib/utils/process-utils'
import { NotFoundState } from '@/components/layout/NotFoundState'
import { RouteRedirect } from '@/components/layout/RouteRedirect'

/**
 * Opens the named process for the record, returning to the record afterwards, or shows the
 * in-shell not-found state when the segment is not one of the table's processes.
 *
 * @returns A redirect, a loading state or the not-found state.
 */
export default function RecordProcessPage() {
  const { slug, recordId, action } = useRouteParams<{ slug: string; recordId: string; action: string }>()
  const { data: metaData, isError } = useQuery({ queryKey: queryKeys.metadataAll(), queryFn: loadMetaData, staleTime: 1000 * 60 * 30 })

  if (isError) {
    return <div role="alert" className="py-12 text-center text-destructive">Failed to load application metadata.</div>
  }
  if (!metaData) {
    return (
      <div role="status" aria-label="Loading" className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const processName = metaData.tables?.[slug] ? tableProcessForSegment(metaData, slug, action, true) : null
  if (!processName) return <NotFoundState name={action} />

  const search = typeof window === 'undefined' ? '' : window.location.search
  const href = processRunHref(processName, {
    recordId,
    search,
    returnTo: `/app/${encodeURIComponent(slug)}/${encodeURIComponent(recordId)}`,
    tableName: launchTableName(metaData.processes[processName], slug),
  })
  return <RouteRedirect href={href} label={metaData.processes[processName]?.label ?? processName} />
}
