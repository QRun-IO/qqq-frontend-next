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
 * @file Search results page — displays global search results grouped by table, reads query from URL params.
 */

'use client'

// Search results page — displays global search results grouped by table
// Reads search query from URL params: /app/search?q=searchTerm

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { globalSearch, type GlobalSearchResult } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { useQContext } from '@/lib/context/q-context'

/**
 * Groups an array of global search results by their `tableLabel` (falling back to `tableName`).
 *
 * @param results - The flat list of search results returned from the API.
 * @returns A `Map` keyed by table label, where each value contains the table name and matching records.
 */
function groupByTable(
  results: GlobalSearchResult[]
): Map<string, { tableName: string; records: GlobalSearchResult[] }> {
  const groups = new Map<string, { tableName: string; records: GlobalSearchResult[] }>()
  for (const result of results) {
    const groupKey = result.tableLabel ?? result.tableName
    const existing = groups.get(groupKey)
    if (existing) {
      existing.records.push(result)
    } else {
      groups.set(groupKey, {
        tableName: result.tableName,
        records: [result],
      })
    }
  }
  return groups
}

/**
 * Renders the global search results page at `/app/search`.
 *
 * Reads the `q` query parameter from the URL, debounces user input, updates the
 * URL on change, and fetches results via TanStack Query. Results are grouped by
 * table label and rendered as linked rows.
 *
 * @returns The search results page with an input, loading skeletons, empty states, and result groups.
 */
export default function SearchResultsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setPageHeader } = useQContext()

  const queryParam = searchParams.get('q') ?? ''
  const [inputValue, setInputValue] = useState(queryParam)
  const [debouncedTerm, setDebouncedTerm] = useState(queryParam)

  // Keep input value in sync when URL param changes externally
  useEffect(() => {
    setInputValue(queryParam)
    setDebouncedTerm(queryParam)
  }, [queryParam])

  // Debounce the input value by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Update URL when debounced term changes (without full navigation)
  useEffect(() => {
    if (debouncedTerm !== queryParam) {
      const params = new URLSearchParams(searchParams.toString())
      if (debouncedTerm) {
        params.set('q', debouncedTerm)
      } else {
        params.delete('q')
      }
      router.replace(`/app/search?${params.toString()}`, { scroll: false })
    }
  }, [debouncedTerm, queryParam, searchParams, router])

  // Set page header
  useEffect(() => {
    setPageHeader('Search Results')
  }, [setPageHeader])

  const { data: results, isLoading } = useQuery({
    queryKey: queryKeys.globalSearch(debouncedTerm),
    queryFn: () => globalSearch(debouncedTerm),
    enabled: debouncedTerm.length > 0,
  })

  const grouped = useMemo<
    Map<string, { tableName: string; records: GlobalSearchResult[] }>
  >(() => {
    if (!results || results.length === 0) return new Map()
    return groupByTable(results)
  }, [results])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value)
    },
    []
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setDebouncedTerm(inputValue)
      }
    },
    [inputValue]
  )

  const hasResults = results && results.length > 0
  const hasSearched = debouncedTerm.length > 0
  const showEmpty = hasSearched && !isLoading && !hasResults

  return (
    <div className="space-y-6" data-qqq-id="search-results-page">
      {/* Page heading */}
      {debouncedTerm ? (
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Search Results for &ldquo;{debouncedTerm}&rdquo;
        </h1>
      ) : (
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Search
        </h1>
      )}

      {/* Search input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search across all tables..."
          aria-label="Search across all tables"
          className="rounded-xl border border-input bg-card pl-10 pr-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id="search-input"
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6" aria-busy="true" aria-live="polite">
          {/* Skeleton group 1 */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-border">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-6 py-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
          {/* Skeleton group 2 */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-border">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="divide-y divide-border">
              {[1, 2].map((i) => (
                <div key={i} className="px-6 py-3">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 shadow-sm"
          data-qqq-id="search-empty-state"
        >
          <Search className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted-foreground">
            No results found for &ldquo;{debouncedTerm}&rdquo;
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search terms or check for typos.
          </p>
        </div>
      )}

      {/* No query state */}
      {!hasSearched && !isLoading && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 shadow-sm"
          data-qqq-id="search-prompt-state"
        >
          <Search className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted-foreground">
            Enter a search term above to find records across all tables.
          </p>
        </div>
      )}

      {/* Results grouped by table */}
      {!isLoading && hasResults && (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([tableLabel, group]) => (
            <div
              key={tableLabel}
              className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
              data-qqq-id={`search-group-${group.tableName}`}
            >
              {/* Group header */}
              <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
                <span className="text-sm font-semibold text-foreground">
                  {tableLabel}
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {group.records.length} {group.records.length === 1 ? 'result' : 'results'}
                </span>
              </div>

              {/* Result rows */}
              <div className="divide-y divide-border">
                {group.records.map((result) => (
                  <Link
                    key={`${result.tableName}-${result.recordId}`}
                    href={`/app/${encodeURIComponent(result.tableName)}/${encodeURIComponent(result.recordId)}`}
                    className="block px-6 py-3 hover:bg-accent cursor-pointer transition-colors text-sm text-foreground"
                    data-qqq-id={`search-result-${result.tableName}-${result.recordId}`}
                  >
                    {result.recordLabel}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
