'use client'

// Metadata hooks — TanStack Query wrappers for all metadata API calls

import { useQuery } from '@tanstack/react-query'

import type { QInstance, QTableMetaData, QProcessMetaData } from '@/types'
import { loadMetaData, loadTableMetaData, loadProcessMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'

const METADATA_STALE_TIME = 1000 * 60 * 30 // 30 minutes

export function useMetaData() {
  return useQuery<QInstance>({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: METADATA_STALE_TIME,
  })
}

export function useTableMetaData(tableName: string | undefined) {
  return useQuery<QTableMetaData>({
    queryKey: queryKeys.tableMetadata(tableName ?? ''),
    queryFn: () => loadTableMetaData(tableName!),
    staleTime: METADATA_STALE_TIME,
    enabled: Boolean(tableName),
  })
}

export function useProcessMetaData(processName: string | undefined) {
  return useQuery<QProcessMetaData>({
    queryKey: queryKeys.processMetadata(processName ?? ''),
    queryFn: () => loadProcessMetaData(processName!),
    staleTime: METADATA_STALE_TIME,
    enabled: Boolean(processName),
  })
}
