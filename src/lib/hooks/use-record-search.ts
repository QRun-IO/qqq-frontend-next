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
 * @file useRecordSearch — debounced record search (`POST /search`) over the
 * tables the metadata marks as searchable. Makes no request when no table is
 * searchable (the backend lacks the capability) or the term is too short.
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { searchRecords } from '@/lib/api/tables'
import type { RecordSearchResult } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { isRecordSearchTerm } from '@/lib/utils/record-search'
import type { SearchableTable } from '@/lib/utils/record-search'

/** Delay between the last keystroke and the search request. */
export const RECORD_SEARCH_DEBOUNCE_MS = 250

/** Stable empty result list (consumers memoize on it). */
const NO_RESULTS: RecordSearchResult[] = []

/** State of a record search. */
export interface RecordSearchState {
  /** Whether record search is available (at least one searchable table). */
  available: boolean
  /** Results for the current (debounced) term; empty while not searching. */
  results: RecordSearchResult[]
  /** Whether a search for the current input is pending (debouncing or in flight). */
  isSearching: boolean
  /** Whether the latest search failed. */
  isError: boolean
}

/**
 * Searches records across the given tables as the user types.
 *
 * @param term - Current search text.
 * @param tables - Searchable tables (from {@link searchableTables}); empty disables search.
 * @param limitPerTable - Maximum results per table.
 * @returns Search availability, results and status.
 */
export function useRecordSearch(term: string, tables: SearchableTable[], limitPerTable: number): RecordSearchState {
  const trimmed = term.trim()
  const [debounced, setDebounced] = useState(trimmed)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), RECORD_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [trimmed])

  const tableNames = useMemo(() => tables.map((table) => table.name), [tables])
  const available = tableNames.length > 0
  const enabled = available && isRecordSearchTerm(debounced)

  const query = useQuery({
    queryKey: queryKeys.recordSearch(debounced, tableNames, limitPerTable),
    queryFn: () => searchRecords(debounced, { tableNames, limitPerTable }),
    enabled,
    staleTime: 30_000,
    retry: false,
  })

  const current = enabled && debounced === trimmed
  return {
    available,
    // an empty answer keeps the same identity, so a keyboard selection made meanwhile survives it
    results: current && query.data && query.data.length > 0 ? query.data : NO_RESULTS,
    isSearching: available && isRecordSearchTerm(trimmed) && (debounced !== trimmed || query.isFetching),
    isError: current && query.isError,
  }
}
