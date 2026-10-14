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
 * @file useRecordSearch — debounced, cancellable record search (`POST /search`) over the
 * tables the metadata marks as searchable. Makes no request when no table is searchable
 * (the backend lacks the capability) or the term is too short. A superseded request is
 * aborted; the previous term's results stay on screen (flagged stale) until the new ones
 * arrive, so the list does not flash empty while typing.
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { searchRecords } from '@/lib/api/record-search'
import type { RecordSearchResult, RecordSearchSort, RecordSearchTableSummary } from '@/lib/api/record-search'
import { queryKeys } from '@/lib/query-client'
import { isRecordSearchTerm } from '@/lib/utils/record-search'
import type { SearchableTable } from '@/lib/utils/record-search'
import { describeProviderFallback, describeSearchFailure, type SearchFailure, type SearchFallback } from '@/lib/search/search-failure'

/** Delay between the last keystroke and the search request. */
export const RECORD_SEARCH_DEBOUNCE_MS = 200

/** Stable empty result list (consumers memoize on it). */
const NO_RESULTS: RecordSearchResult[] = []

/** Optional request settings of {@link useRecordSearch}. */
export interface UseRecordSearchOptions {
  /** Records to skip per table (paging one table). */
  offset?: number
  /** Requested order. */
  sort?: RecordSearchSort
  /** Delay after the last change before searching (default {@link RECORD_SEARCH_DEBOUNCE_MS}). */
  debounceMs?: number
}

/** State of a record search. */
export interface RecordSearchState {
  /** Whether record search is available (at least one searchable table). */
  available: boolean
  /** Results for the current term (or, while `isStale`, for the previous one). */
  results: RecordSearchResult[]
  /** Per-table summaries, when the backend sends them. */
  summaries?: RecordSearchTableSummary[]
  /** Set when the search provider (e.g. an index) failed and the results are the default search's. */
  fallback?: SearchFallback
  /** Whether a search for the current input is pending (debouncing or in flight). */
  isSearching: boolean
  /** Whether `results` belong to an earlier term (a newer search is pending). */
  isStale: boolean
  /** Whether the latest search failed. */
  isError: boolean
  /** Why it failed, when it did. */
  failure?: SearchFailure
  /** Runs the search again. */
  retry: () => void
}

/**
 * Searches records across the given tables as the user types.
 *
 * @param term - Current search text.
 * @param tables - Searchable tables (from `searchableTables`); empty disables search.
 * @param limitPerTable - Maximum results per table.
 * @param options - Offset, order and debounce.
 * @returns Search availability, results and status.
 */
export function useRecordSearch(term: string, tables: SearchableTable[], limitPerTable: number, options: UseRecordSearchOptions = {}): RecordSearchState {
  const { offset = 0, sort = 'relevance', debounceMs = RECORD_SEARCH_DEBOUNCE_MS } = options
  const trimmed = term.trim()
  const [debounced, setDebounced] = useState(trimmed)

  useEffect(() => {
    if (debounced === trimmed) return
    const timer = setTimeout(() => setDebounced(trimmed), debounceMs)
    return () => clearTimeout(timer)
  }, [trimmed, debounced, debounceMs])

  const tableNames = useMemo(() => tables.map((table) => table.name), [tables])
  const available = tableNames.length > 0
  const searchable = available && isRecordSearchTerm(trimmed)
  const enabled = available && isRecordSearchTerm(debounced)

  const query = useQuery({
    queryKey: queryKeys.recordSearch(debounced, tableNames, limitPerTable, offset, sort),
    // the signal aborts a request whose term was superseded
    queryFn: ({ signal }) => searchRecords(debounced, { tableNames, limitPerTable, offset, sort, signal }),
    enabled,
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
  })

  const current = searchable && debounced === trimmed
  const data = searchable ? query.data : undefined
  const isError = current && query.isError && !query.isFetching
  const failure = useMemo(() => (isError ? describeSearchFailure(query.error) : undefined), [isError, query.error])
  const fallback = useMemo(() => describeProviderFallback(data?.provider), [data?.provider])
  const { refetch } = query

  return {
    available,
    // an unchanged answer keeps the same identity, so a keyboard selection made meanwhile survives it
    results: data && data.results.length > 0 && !isError ? data.results : NO_RESULTS,
    summaries: isError ? undefined : data?.tables,
    fallback: isError ? undefined : fallback,
    isSearching: searchable && (debounced !== trimmed || query.isFetching),
    isStale: searchable && (debounced !== trimmed || query.isPlaceholderData),
    isError,
    failure,
    retry: () => void refetch(),
  }
}
