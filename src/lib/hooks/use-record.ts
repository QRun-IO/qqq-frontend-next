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

'use client'

// useRecord — TanStack Query hook for fetching a single record by primary key

import { useQuery } from '@tanstack/react-query'

import type { QRecord } from '@/types'
import { getRecord } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'

export interface UseRecordOptions {
  tableName: string
  primaryKey: string | number
  enabled?: boolean
  includeAssociations?: boolean
  tableVariant?: string
  staleTime?: number
}

export interface UseRecordResult {
  record: QRecord | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

export function useRecord({
  tableName,
  primaryKey,
  enabled = true,
  includeAssociations = true,
  tableVariant,
  staleTime = 1000 * 60 * 5, // 5 minutes
}: UseRecordOptions): UseRecordResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.tableRecord(tableName, primaryKey),
    queryFn: () =>
      getRecord(tableName, primaryKey, {
        includeAssociations,
        tableVariant,
      }),
    enabled: enabled && Boolean(tableName) && primaryKey !== undefined && primaryKey !== '',
    staleTime,
  })

  return {
    record: data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}
