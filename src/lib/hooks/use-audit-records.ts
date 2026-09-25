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
 * @file useAuditRecords — fetches audit change history for a record.
 */

import { useQuery } from '@tanstack/react-query'

import type { QAuditRecord } from '@/types'
import { getAuditRecords, type AuditSource } from '@/lib/api/audits'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'

/**
 * Options for {@link useAuditRecords}.
 */
interface UseAuditRecordsOptions {
  /** How the current user can read audits (see `auditSource`); `null` disables the query. */
  source: AuditSource
  /** The audited table. */
  tableName: string
  /** The record's primary key. */
  primaryKey: string | number
  /** When false the query does not run (e.g. until the history dialog opens). */
  enabled?: boolean
}

/**
 * Loads a record's audit history, newest first.
 *
 * @param options - See {@link UseAuditRecordsOptions}.
 * @returns The entries plus loading and error state (the caller renders errors).
 */
export function useAuditRecords({ source, tableName, primaryKey, enabled = true }: UseAuditRecordsOptions) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.audits(tableName, primaryKey),
    queryFn: () => getAuditRecords(source!, tableName, primaryKey),
    enabled: enabled && source !== null,
    staleTime: 0,
    meta: HANDLES_OWN_ERRORS,
  })

  return {
    auditRecords: (data ?? []) as QAuditRecord[],
    isLoading,
    isError,
    error,
    refetch,
  }
}
