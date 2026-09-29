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
 * @file use-filter-setup — server state of the saved report filter and columns widget: table
 * metadata as an application API version exposes it, and a requested page (and count) of the
 * records a filter matches, through the plain or the API-versioned v1 routes.
 */

'use client'

import { useQuery } from '@tanstack/react-query'

import type { QQueryFilter, QRecord, QTableMetaData, QueryJoin } from '@/types'
import { countApiRecords, loadApiTableMetaData, queryApiRecords, type ApiVersionRef } from '@/lib/api/api-versioned'
import { countRecords, queryRecords } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { hasCapability } from '@/lib/utils/query-columns'

/** Stable empty page, so the grid's memoized rows are not rebuilt while nothing has loaded. */
const NO_RECORDS: QRecord[] = []

/**
 * Loads a table's metadata as an API version exposes it
 * (`GET /qqq/v1/{apiPath}/{apiVersion}/metaData/table/{tableName}`).
 *
 * @param api - The API version; the query waits while it is undefined.
 * @param tableName - The table; the query waits while it is undefined.
 * @returns The TanStack query result.
 */
export function useApiTableMetaData(api: ApiVersionRef | undefined, tableName: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.tableMetadata(tableName ?? ''), 'api', api?.path ?? '', api?.version ?? ''],
    queryFn: () => loadApiTableMetaData(api!, tableName!),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(api && tableName),
  })
}

/** Options for {@link useFilterSetupPreview}. */
export interface FilterSetupPreviewOptions {
  /** The filtered table. */
  table: QTableMetaData
  /** The API version, for an API-versioned widget. */
  api?: ApiVersionRef
  /** The filter prepared for the backend, with its sort and the page (`skip`, `limit`). */
  filter: QQueryFilter
  /** Exposed joins the shown columns, criteria or sort use. */
  joins?: QueryJoin[]
  /** Whether a many-side join can repeat rows (then the distinct count is asked for too). */
  includeDistinct: boolean
  /** When false nothing is queried (a filter variable has no value). */
  enabled: boolean
}

/**
 * Queries the records a filter matches (one page) and counts them, for the preview grids.
 *
 * @param options - See {@link FilterSetupPreviewOptions}.
 * @returns The records, counts and request state.
 */
export function useFilterSetupPreview({ table, api, filter, joins, includeDistinct, enabled }: FilterSetupPreviewOptions) {
  const tableName = table.name
  const apiKey = api ? `${api.path}/${api.version}` : null
  const canCount = hasCapability(table, 'TABLE_COUNT')
  const countFilter: QQueryFilter = { ...filter, skip: 0, limit: 0, orderBys: [] }
  const request = { filter, ...(joins ? { joins } : {}) }
  const countRequest = { filter: countFilter, ...(joins ? { joins } : {}) }

  const recordsQuery = useQuery({
    queryKey: [...queryKeys.tableRecords(tableName), 'filterSetupPreview', apiKey, 'query', JSON.stringify(request)],
    queryFn: () => (api ? queryApiRecords(api, tableName, request) : queryRecords(tableName, request)),
    staleTime: 0,
    placeholderData: (previous) => previous,
    enabled,
  })

  const countQuery = useQuery({
    queryKey: [...queryKeys.tableRecords(tableName), 'filterSetupPreview', apiKey, 'count', JSON.stringify(countRequest), includeDistinct],
    queryFn: () => (api ? countApiRecords(api, tableName, countRequest, includeDistinct) : countRecords(tableName, countRequest, includeDistinct)),
    staleTime: 0,
    placeholderData: (previous) => previous,
    enabled: enabled && canCount,
  })

  return {
    records: recordsQuery.data?.records ?? NO_RECORDS,
    totalCount: canCount ? countQuery.data?.count ?? null : null,
    isLoading: enabled && (recordsQuery.isLoading || (canCount && countQuery.isLoading)),
    isFetching: recordsQuery.isFetching || countQuery.isFetching,
    refresh: () => {
      if (!enabled) return
      void recordsQuery.refetch()
      if (canCount) void countQuery.refetch()
    },
    error: recordsQuery.error ?? countQuery.error ?? null,
  }
}
