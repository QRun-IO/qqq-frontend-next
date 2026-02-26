// useAuditRecords — fetches audit change history for a record

import { useQuery } from '@tanstack/react-query'
import { getAuditRecords } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import type { QAuditRecord } from '@/types'

interface UseAuditRecordsOptions {
  tableName: string
  primaryKey: string | number
  /** Only fetch when true (lazy loading on expand) */
  enabled?: boolean
}

export function useAuditRecords({ tableName, primaryKey, enabled = true }: UseAuditRecordsOptions) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.audits(tableName, primaryKey),
    queryFn: () => getAuditRecords(tableName, primaryKey),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 min cache
  })

  return {
    auditRecords: (data ?? []) as QAuditRecord[],
    isLoading,
    isError,
    error,
  }
}
