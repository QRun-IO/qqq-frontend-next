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
 * @file use-metadata — TanStack Query wrappers for all QQQ metadata API calls.
 */
'use client'

import { useQuery } from '@tanstack/react-query'

import type { QInstance, QTableMetaData, QProcessMetaData } from '@/types'
import { loadMetaData, loadTableMetaData, loadProcessMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'

/**
 * How long metadata query results are considered fresh before a background refetch is triggered.
 * Set to 30 minutes because metadata changes infrequently during a session.
 */
const METADATA_STALE_TIME = 1000 * 60 * 30 // 30 minutes

/**
 * Fetches and caches the full QInstance metadata (app tree, tables, processes, widgets).
 *
 * Results are cached for {@link METADATA_STALE_TIME}. All page-level components that need
 * the top-level instance metadata should use this hook.
 *
 * @returns A TanStack Query result containing a {@link QInstance} object.
 */
export function useMetaData() {
  return useQuery<QInstance>({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: METADATA_STALE_TIME,
  })
}

/**
 * Fetches and caches metadata for a single table by name.
 *
 * The query is disabled when `tableName` is undefined or empty, making it safe to call
 * before the table name is known from URL params.
 *
 * @param tableName - The QQQ table name to load metadata for, or undefined to skip fetching.
 * @returns A TanStack Query result containing a {@link QTableMetaData} object.
 */
export function useTableMetaData(tableName: string | undefined) {
  return useQuery<QTableMetaData>({
    queryKey: queryKeys.tableMetadata(tableName ?? ''),
    queryFn: () => loadTableMetaData(tableName!),
    staleTime: METADATA_STALE_TIME,
    enabled: Boolean(tableName),
  })
}

/**
 * Fetches and caches metadata for a single process by name.
 *
 * The query is disabled when `processName` is undefined or empty, making it safe to call
 * before the process name is known from URL params.
 *
 * @param processName - The QQQ process name to load metadata for, or undefined to skip fetching.
 * @returns A TanStack Query result containing a {@link QProcessMetaData} object.
 */
export function useProcessMetaData(processName: string | undefined) {
  return useQuery<QProcessMetaData>({
    queryKey: queryKeys.processMetadata(processName ?? ''),
    queryFn: () => loadProcessMetaData(processName!),
    staleTime: METADATA_STALE_TIME,
    enabled: Boolean(processName),
  })
}
