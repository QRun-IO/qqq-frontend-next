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
 * @file Search page — every page (app, table, process, report) and recently viewed record matching `?q=`.
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { loadMetaData } from '@/lib/api/metadata'
import { queryKeys } from '@/lib/query-client'
import { useQContext } from '@/lib/context/q-context'
import { useAppTreeRoutes } from '@/lib/hooks/use-routes'
import { getRecentRecords } from '@/lib/utils/recent-records'
import type { RecentRecord } from '@/lib/utils/recent-records'
import { buildNavigationSearchItems } from '@/lib/utils/navigation-search'
import { MetadataIcon, type MetadataIconKind } from '@/components/layout/MetadataIcon'

/** Fallback icon kind for each app-tree node type. */
const ICON_KIND: Record<string, MetadataIconKind> = { APP: 'app', TABLE: 'table', PROCESS: 'process', REPORT: 'report' }

/**
 * Renders the search page at `/app/search`.
 *
 * Matching is local (labels of navigable app-tree nodes and recently viewed
 * records); QQQ has no global record-search endpoint. The `q` parameter is kept
 * in the URL so results are shareable and survive refresh.
 *
 * @returns The search input and matching pages and records.
 */
export default function SearchResultsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setPageHeader } = useQContext()
  const term = searchParams.get('q') ?? ''
  const [inputValue, setInputValue] = useState(term)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30,
  })
  const { navTargets } = useAppTreeRoutes(metaData)

  useEffect(() => {
    setInputValue(term)
  }, [term])

  useEffect(() => {
    setRecentRecords(getRecentRecords())
  }, [])

  useEffect(() => {
    setPageHeader('Search')
  }, [setPageHeader])

  const items = useMemo(
    () => (term.trim() ? buildNavigationSearchItems(navTargets, recentRecords, term, 50) : []),
    [navTargets, recentRecords, term]
  )
  const pages = items.filter((item) => item.kind === 'page')
  const records = items.filter((item) => item.kind === 'record')

  /**
   * Writes the input value to the `q` URL parameter.
   *
   * @param event - Form submit event.
   */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const next = inputValue.trim()
    router.replace(next ? `/app/search?q=${encodeURIComponent(next)}` : '/app/search')
  }

  return (
    <div className="space-y-6" data-qqq-id="search-results-page">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {term ? <>Search results for &ldquo;{term}&rdquo;</> : 'Search'}
      </h1>

      <form role="search" onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Find an app, table, process or recent record..."
          aria-label="Search pages and recent records"
          className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id="search-input"
        />
      </form>

      {!term && (
        <p className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground" data-qqq-id="search-prompt-state">
          Enter text above to find apps, tables, processes and recently viewed records.
        </p>
      )}

      {term && items.length === 0 && (
        <p className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground" data-qqq-id="search-empty-state">
          No pages or recent records match &ldquo;{term}&rdquo;.
        </p>
      )}

      {pages.length > 0 && (
        <section aria-label="Pages" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-qqq-id="search-group-pages">
          <h2 className="border-b border-border px-6 py-3 text-sm font-semibold text-foreground">Pages</h2>
          <ul className="divide-y divide-border">
            {pages.map((item) => (
              <li key={item.path}>
                <Link href={item.path} className="flex items-center gap-3 px-6 py-3 text-sm transition-colors hover:bg-accent" data-qqq-id={`search-page-${item.path.replace(/\//g, '-')}`}>
                  <MetadataIcon icon={item.icon} kind={item.nodeType ? ICON_KIND[item.nodeType] : 'app'} className="text-muted-foreground" />
                  <span className="font-medium text-foreground">{item.label}</span>
                  {item.context && <span className="text-xs text-muted-foreground">{item.context}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {records.length > 0 && (
        <section aria-label="Recently viewed" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-qqq-id="search-group-records">
          <h2 className="border-b border-border px-6 py-3 text-sm font-semibold text-foreground">Recently viewed</h2>
          <ul className="divide-y divide-border">
            {records.map((item) => (
              <li key={item.path}>
                <Link href={item.path} className="flex items-center gap-3 px-6 py-3 text-sm transition-colors hover:bg-accent">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.context}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
