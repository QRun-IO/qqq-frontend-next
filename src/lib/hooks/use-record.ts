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
