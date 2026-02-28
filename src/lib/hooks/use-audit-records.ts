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
