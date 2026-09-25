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
 * @file useRecord — TanStack Query hook for fetching a single record by primary key.
 */
'use client'

import { useQuery } from '@tanstack/react-query'

import type { QRecord } from '@/types'
import { getRecord } from '@/lib/api/tables'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'

/**
 * Configuration options for {@link useRecord}.
 */
export interface UseRecordOptions {
  /** Backend-registered table name. */
  tableName: string
  /** Primary key of the record to fetch. */
  primaryKey: string | number
  /** When `false`, the query is suspended until set to `true`. */
  enabled?: boolean
  /** When `true`, the response includes associated child records. */
  includeAssociations?: boolean
  /** Optional alternate backend table configuration to use. */
  tableVariant?: string
  /** How long the cached record is considered fresh (default 5 minutes). */
  staleTime?: number
}

/**
 * Shape of the object returned by {@link useRecord}.
 */
export interface UseRecordResult {
  /** The fetched record, or `undefined` while loading or on error. */
  record: QRecord | undefined
  /** `true` while the initial fetch is in flight. */
  isLoading: boolean
  /** `true` if the fetch encountered an error. */
  isError: boolean
  /** The error thrown by the query, or `null`. */
  error: Error | null
  /** Manually re-trigger the query. */
  refetch: () => void
}

/**
 * Fetches a single record by primary key via the v1 `GET /table/{tableName}/{primaryKey}` route.
 *
 * Disabled when `tableName` is empty or `primaryKey` is undefined/empty.
 *
 * @param options - Table name, primary key, and optional fetch configuration.
 * @returns The hook state and actions including `record`, `isLoading`, `isError`, `error`, and `refetch`.
 */
export function useRecord({
  tableName,
  primaryKey,
  enabled = true,
  includeAssociations = true,
  tableVariant,
  staleTime = 0, // revalidate on every mount; cached data shows while refetching
}: UseRecordOptions): UseRecordResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...queryKeys.tableRecord(tableName, primaryKey), { includeAssociations, tableVariant }],
    queryFn: () =>
      getRecord(tableName, primaryKey, {
        includeAssociations,
        tableVariant,
      }),
    enabled: enabled && Boolean(tableName) && primaryKey !== undefined && primaryKey !== '',
    staleTime,
    // Every caller renders its own not-found / permission / failure state.
    meta: HANDLES_OWN_ERRORS,
  })

  return {
    record: data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}
