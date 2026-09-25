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
 * @file record-cache — TanStack Query cache maintenance after record mutations.
 */

import type { Query, QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-client'

/**
 * Whether a cached query belongs to one record of a table, whatever form of the
 * primary key built its key (route params are strings, record values are numbers).
 *
 * @param query - A cached query.
 * @param tableName - Table of the record.
 * @param primaryKey - Primary key of the record.
 * @returns `true` for `['qqq', 'records', tableName, primaryKey, ...]` keys.
 */
export function isRecordQuery(query: Query, tableName: string, primaryKey: string | number): boolean {
  const [root, scope, table, id] = query.queryKey
  const [expectedRoot, expectedScope] = queryKeys.records()
  return root === expectedRoot && scope === expectedScope && table === tableName &&
    (typeof id === 'string' || typeof id === 'number') && String(id) === String(primaryKey)
}

/**
 * Forgets a record the server just deleted without asking the server for it again.
 *
 * The record view that started the deletion is still mounted until navigation
 * completes, so refetching its record would only produce a 404 and a misleading
 * error. Instead, reads of the deleted record are cancelled, unobserved copies are
 * dropped, and every query of the table is marked stale so lists and counts reload
 * the next time they mount.
 *
 * @param queryClient - The application query client.
 * @param tableName - Table of the deleted record.
 * @param primaryKey - Primary key of the deleted record.
 */
export async function forgetDeletedRecord(queryClient: QueryClient, tableName: string, primaryKey: string | number): Promise<void> {
  const deleted = (query: Query) => isRecordQuery(query, tableName, primaryKey)
  await queryClient.cancelQueries({ queryKey: queryKeys.tableRecords(tableName), predicate: deleted })
  queryClient.removeQueries({ queryKey: queryKeys.tableRecords(tableName), predicate: (query) => deleted(query) && query.getObserversCount() === 0 })
  await queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableName), refetchType: 'none' })
}
