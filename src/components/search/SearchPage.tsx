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
 * @file SearchPage — the full search results page (`/app/search`). Its state lives in the
 * URL (`q`, `tables`, `view=pages`, `sort=recent`), so searches can be shared and bookmarked.
 *
 * - "All" shows matching pages, then each table's best matches with its count and a link
 *   to that table's results, then matching recently viewed records.
 * - A table filter lists that table's matches 25 at a time, with "Show more" while the
 *   backend reports more (older backends return one page; the page says so).
 * - Relevance or most-recent order; result cards with matched-field snippets, secondary
 *   values, last update and quick actions (open, new tab, copy link).
 * - A failed record search names its failure class and keeps the page and recently viewed
 *   matches; a failed search provider (index) is reported above its fallback results.
 */

'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Clock, History, Loader2, RotateCw, Search, X } from 'lucide-react'

import { loadMetaData } from '@/lib/api/metadata'
import { searchRecords, type RecordSearchResult } from '@/lib/api/record-search'
import { queryKeys } from '@/lib/query-client'
import { useQContext } from '@/lib/context/q-context'
import { useAppTreeRoutes } from '@/lib/hooks/use-routes'
import { useRecordSearch } from '@/lib/hooks/use-record-search'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { getRecentRecords, type RecentRecord } from '@/lib/utils/recent-records'
import { searchNavTargets, searchRecentRecords } from '@/lib/utils/navigation-search'
import { isRecordSearchTerm, searchableTables } from '@/lib/utils/record-search'
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/search/recent-searches'
import { describeProviderFallback, describeSearchFailure } from '@/lib/search/search-failure'
import {
  groupResultsByTable,
  labelQuality,
  orderTableResults,
  parseSearchPageState,
  searchPagePath,
  tableCountLabel,
  tableHasMore,
  type SearchPageState,
} from '@/lib/search/search-model'
import { cn } from '@/lib/utils/cn'
import { MetadataIcon, type MetadataIconKind } from '@/components/layout/MetadataIcon'
import { HighlightedText } from './HighlightedText'
import { SearchResultCard } from './SearchResultCard'

/** The record preview (key fields, thumbnails, quick actions), loaded when first shown. */
const RecordPreview = dynamic(() => import('./RecordPreview').then((module) => module.RecordPreview), {
  ssr: false,
  loading: () => (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Loading preview…
    </p>
  ),
})

/** Wide enough for results and preview side by side. */
const SPLIT_VIEW_QUERY = '(min-width: 1280px)'

/**
 * A result's key for preview state.
 *
 * @param result - The result.
 * @returns `table:id`.
 */
function resultKey(result: RecordSearchResult): string {
  return `${result.tableName}:${result.recordId}`
}

/** Fallback icon kind for each app-tree node type. */
const ICON_KIND: Record<string, MetadataIconKind> = { APP: 'app', TABLE: 'table', PROCESS: 'process', REPORT: 'report' }

/** Type shown for each app-tree node type. */
const TYPE_LABEL: Record<string, string> = { APP: 'App', TABLE: 'Table', PROCESS: 'Process', REPORT: 'Report' }

/** Records per table in the "All" overview. */
const OVERVIEW_PER_TABLE = 8

/** Records per page in a one-table view (the QQQ 4.1 maximum per table). */
const TABLE_PAGE_SIZE = 25

/** Pages listed in the "All" overview. */
const OVERVIEW_PAGES = 6

/** Delay between typing and updating the URL (which runs the search). */
const URL_DEBOUNCE_MS = 250

/** Classes of a section card. */
const SECTION_CLASS = 'overflow-hidden rounded-xl border border-border bg-card shadow-sm'

/**
 * A filter chip (a link: filters are URL state).
 *
 * @param props - Component properties.
 * @param props.href - Target URL.
 * @param props.active - Whether this filter is applied.
 * @param props.label - Visible label.
 * @param props.count - Count badge.
 * @param props.icon - Leading icon.
 * @param props.qqqId - `data-qqq-id`.
 * @returns The chip.
 */
function FilterChip({ href, active, label, count, icon, qqqId }: { href: string; active: boolean; label: string; count?: string; icon?: React.ReactNode; qqqId: string }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors pointer-coarse:min-h-11',
        active ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border bg-card text-foreground hover:bg-accent'
      )}
      data-qqq-id={qqqId}
    >
      {icon}
      <span className="max-w-[12rem] truncate">{label}</span>
      {count !== undefined && <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>}
    </Link>
  )
}

/**
 * Renders the search page.
 *
 * @returns The search form, filters and results.
 */
export function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setPageHeader } = useQContext()
  const state = useMemo(() => parseSearchPageState(searchParams), [searchParams])
  const { q, sort, view } = state
  const term = q.trim()
  const [inputValue, setInputValue] = useState(q)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const { data: metaData } = useQuery({ queryKey: queryKeys.metadataAll(), queryFn: loadMetaData, staleTime: 1000 * 60 * 30 })
  const { navTargets } = useAppTreeRoutes(metaData)
  const allTables = useMemo(() => searchableTables(metaData), [metaData])
  // tables named in the URL that this user can search (unknown names are ignored)
  const filterTables = useMemo(() => state.tables.filter((name) => allTables.some((table) => table.name === name)), [state.tables, allTables])
  const singleTable = filterTables.length === 1 ? allTables.find((table) => table.name === filterTables[0]) : undefined

  useEffect(() => setPageHeader('Search'), [setPageHeader])
  useEffect(() => {
    setRecentRecords(getRecentRecords())
    setRecentSearches(getRecentSearches())
  }, [])

  // URL → input (back/forward, links), but not the echo of our own debounced update: the
  // user may have typed more since it was sent
  const pushedQRef = useRef<string | null>(null)
  useEffect(() => {
    if (pushedQRef.current !== null && q.trim() === pushedQRef.current) return
    pushedQRef.current = null
    setInputValue(q)
  }, [q])

  // the latest URL state, for a debounced update that fires after a filter or sort change
  const latestRef = useRef({ state, filterTables })
  latestRef.current = { state, filterTables }

  /**
   * Replaces the URL state (merging with the current state).
   *
   * @param next - Changed fields.
   */
  const navigate = (next: Partial<SearchPageState>) => {
    router.replace(searchPagePath({ ...state, tables: filterTables, ...next }), { scroll: false })
  }

  // input → URL, debounced: searching as you type
  useEffect(() => {
    if (inputValue.trim() === term) return
    const timer = setTimeout(() => {
      const latest = latestRef.current
      pushedQRef.current = inputValue.trim()
      router.replace(searchPagePath({ ...latest.state, tables: latest.filterTables, q: inputValue }), { scroll: false })
    }, URL_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only typing schedules a URL update
  }, [inputValue])

  /**
   * Commits the search immediately and remembers it.
   *
   * @param event - Form submit.
   */
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (inputValue.trim()) setRecentSearches(addRecentSearch(inputValue))
    navigate({ q: inputValue })
  }

  // Overview: every searchable table (or the URL's tables), a few results each, for counts
  const overviewTables = filterTables.length > 1 ? allTables.filter((table) => filterTables.includes(table.name)) : allTables
  const overview = useRecordSearch(term, overviewTables, OVERVIEW_PER_TABLE, { sort, debounceMs: 0 })
  const overviewGroups = useMemo(
    () => groupResultsByTable(overview.results, overview.summaries, allTables, term, sort),
    [overview.results, overview.summaries, allTables, term, sort]
  )

  // One table: pages of 25 while the backend reports more
  const tablePages = useInfiniteQuery({
    queryKey: [...queryKeys.search(), 'table-pages', term, singleTable?.name ?? '', sort],
    queryFn: ({ pageParam, signal }) => searchRecords(term, { tableNames: singleTable ? [singleTable.name] : [], limitPerTable: TABLE_PAGE_SIZE, offset: pageParam, sort, signal }),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, lastOffset) => {
      const summary = last.tables?.find((table) => table.tableName === singleTable?.name)
      return summary?.hasMore && last.results.length > 0 ? lastOffset + TABLE_PAGE_SIZE : undefined
    },
    enabled: Boolean(singleTable) && isRecordSearchTerm(term),
    staleTime: 30_000,
    retry: false,
  })
  const tableResults = useMemo(() => {
    const seen = new Set<string>()
    const all: RecordSearchResult[] = []
    for (const page of tablePages.data?.pages ?? []) {
      for (const result of page.results) {
        if (result.tableName !== singleTable?.name || seen.has(result.recordId)) continue
        seen.add(result.recordId)
        all.push(result)
      }
    }
    return orderTableResults(all, term, sort)
  }, [tablePages.data, singleTable, term, sort])
  const tableSummary = tablePages.data?.pages[0]?.tables?.find((table) => table.tableName === singleTable?.name)
  const tableFailure = useMemo(() => (tablePages.isError ? describeSearchFailure(tablePages.error) : undefined), [tablePages.isError, tablePages.error])
  const tableFallback = describeProviderFallback(tablePages.data?.pages[0]?.provider)

  // Pages and recently viewed records match locally
  const pages = useMemo(() => {
    if (!term) return []
    return searchNavTargets(navTargets, term)
      .map((target, index) => ({ target, index, quality: labelQuality(target.label, term) }))
      .sort((a, b) => b.quality - a.quality || a.index - b.index)
      .map(({ target }) => target)
  }, [navTargets, term])
  const foundPaths = useMemo(() => new Set(overview.results.map((result) => `/app/${encodeURIComponent(result.tableName)}/${encodeURIComponent(result.recordId)}`)), [overview.results])
  const recentMatches = useMemo(() => (term ? searchRecentRecords(recentRecords, term).filter((record) => !foundPaths.has(record.path)).slice(0, 5) : []), [recentRecords, term, foundPaths])

  const recordSearchAvailable = allTables.length > 0
  const failure = singleTable ? tableFailure : overview.failure
  const fallback = singleTable ? tableFallback : overview.fallback
  const searching = singleTable ? tablePages.isFetching && !tablePages.isFetchingNextPage : overview.isSearching
  const recordCount = overviewGroups.reduce((sum, group) => sum + group.results.length, 0)
  const pagesCount = pages.length
  const nothingFound = Boolean(term) && !searching && !failure
    && (view === 'pages' ? pagesCount === 0 : singleTable ? tableResults.length === 0 : pagesCount === 0 && recordCount === 0 && recentMatches.length === 0)

  /**
   * Remembers the search when the user opens a result.
   *
   * @param event - Click anywhere in the results.
   */
  const rememberOnOpen = (event: React.MouseEvent) => {
    if (term && event.target instanceof Element && event.target.closest('a[href]')) setRecentSearches(addRecentSearch(term))
  }

  const filterHref = (next: Partial<SearchPageState>) => searchPagePath({ q: term, sort, ...next })

  // Record preview: a split view beside the results on wide screens (following hover, focus
  // and the arrow keys), a side sheet elsewhere (its button, or a long press)
  const splitView = useMediaQuery(SPLIT_VIEW_QUERY)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const shownResults = useMemo(() => {
    if (view === 'pages') return []
    if (singleTable) return tableResults.map((result) => ({ result, tableLabel: singleTable.label, icon: singleTable.icon }))
    return overviewGroups.flatMap((group) => group.results.map((result) => ({ result, tableLabel: group.tableLabel, icon: group.icon })))
  }, [view, singleTable, tableResults, overviewGroups])
  const previewed = shownResults.find((entry) => resultKey(entry.result) === previewKey) ?? (splitView ? shownResults[0] : undefined)
  const showSplit = splitView && Boolean(term) && shownResults.length > 0
  // relevance relative to the best score per table (only providers send scores)
  const bestScore = useMemo(() => {
    const best = new Map<string, number>()
    for (const { result } of shownResults) {
      if (result.score !== undefined && result.score > (best.get(result.tableName) ?? 0)) best.set(result.tableName, result.score)
    }
    return best
  }, [shownResults])

  /**
   * Props that tie a result card to the preview.
   *
   * @param result - The card's result.
   * @returns Active state, activation and preview handlers, and relevance.
   */
  const previewProps = (result: RecordSearchResult) => {
    const key = resultKey(result)
    const best = bestScore.get(result.tableName)
    return {
      active: showSplit && previewed !== undefined && resultKey(previewed.result) === key,
      onActivate: showSplit ? () => setPreviewKey(key) : undefined,
      onPreview: () => {
        setPreviewKey(key)
        if (!splitView) setSheetOpen(true)
      },
      relevance: result.score !== undefined && best ? Math.max(0, Math.min(1, result.score / best)) : undefined,
    }
  }

  /**
   * ↑/↓ on a result moves to the previous or next result (and so the preview).
   *
   * @param event - Keydown within the results.
   */
  const handleResultsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-qqq-id="search-result-link"]')) return
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-qqq-id="search-result-link"]'))
    const next = links[links.indexOf(event.target) + (event.key === 'ArrowDown' ? 1 : -1)]
    if (!next) return
    event.preventDefault()
    next.focus()
    next.scrollIntoView?.({ block: 'nearest' })
  }

  return (
    <div className={cn('mx-auto w-full space-y-5', showSplit ? 'max-w-[110rem]' : 'max-w-5xl')} data-qqq-id="search-results-page">
      <h1 className="break-words text-2xl font-bold tracking-tight text-foreground">
        {term ? <>Results for &ldquo;{term}&rdquo;</> : 'Search'}
      </h1>

      <form role="search" onSubmit={handleSubmit} className="relative" aria-label="Search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={recordSearchAvailable ? 'Find an app, table, process or record…' : 'Find an app, table, process or recent record…'}
          aria-label={recordSearchAvailable ? 'Search pages and records' : 'Search pages and recent records'}
          className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
          autoComplete="off"
          spellCheck={false}
          data-qqq-id="search-input"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
      </form>

      {term && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Filter results" className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1" data-qqq-id="search-filters">
            <FilterChip href={filterHref({})} active={view !== 'pages' && filterTables.length === 0} label="All" qqqId="search-filter-all" />
            <FilterChip href={filterHref({ view: 'pages' })} active={view === 'pages'} label="Pages" count={String(pagesCount)} qqqId="search-filter-pages" />
            {overviewGroups.map((group) => (
              <FilterChip
                key={group.tableName}
                href={filterHref({ tables: [group.tableName] })}
                active={singleTable?.name === group.tableName}
                label={group.tableLabel}
                count={tableCountLabel(group.results.length, group.summary)}
                icon={<MetadataIcon icon={group.icon} kind="table" className="h-3.5 w-3.5" />}
                qqqId={`search-filter-table-${group.tableName}`}
              />
            ))}
            {singleTable && !overviewGroups.some((group) => group.tableName === singleTable.name) && (
              <FilterChip href={filterHref({ tables: [singleTable.name] })} active label={singleTable.label} qqqId={`search-filter-table-${singleTable.name}`} />
            )}
          </nav>
          {view !== 'pages' && recordSearchAvailable && (
            <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              Sort
              <select
                value={sort}
                onChange={(event) => navigate({ sort: event.target.value === 'recent' ? 'recent' : 'relevance' })}
                className="rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                data-qqq-id="search-sort"
              >
                <option value="relevance">Best match</option>
                <option value="recent">Recently updated</option>
              </select>
            </label>
          )}
        </div>
      )}

      {/* Record search progress and problems, announced politely */}
      <div role="status" aria-live="polite" data-qqq-id="search-records-status">
        {searching && <span className="sr-only">Searching records…</span>}
        {failure && (
          <div className="flex flex-wrap items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" data-qqq-id="search-failure" data-failure-kind={failure.kind}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{failure.title}</p>
              {failure.detail && <p className="break-words text-muted-foreground">{failure.detail}</p>}
              <p className="text-muted-foreground">Pages and recently viewed records below still match.</p>
            </div>
            {failure.retryable && (
              <button
                type="button"
                onClick={() => (singleTable ? void tablePages.refetch() : overview.retry())}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-qqq-id="button-search-retry"
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            )}
          </div>
        )}
        {fallback && !failure && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm" data-qqq-id="search-fallback">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{fallback.title}</p>
              {fallback.detail && <p className="break-words text-muted-foreground">{fallback.detail}</p>}
            </div>
          </div>
        )}
      </div>

      {!term && (
        <div className="space-y-5" data-qqq-id="search-prompt-state">
          <p className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            {recordSearchAvailable ? 'Enter text above to find apps, tables, processes and records.' : 'Enter text above to find apps, tables, processes and recently viewed records.'}
          </p>
          {recentSearches.length > 0 && (
            <section aria-labelledby="search-recent-searches" className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 id="search-recent-searches" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Recent searches
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches()
                    setRecentSearches([])
                  }}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  data-qqq-id="button-clear-recent-searches"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((recent) => (
                  <FilterChip key={recent} href={searchPagePath({ q: recent })} active={false} label={recent} qqqId="search-recent-search" />
                ))}
              </div>
            </section>
          )}
          {recentRecords.length > 0 && (
            <section aria-labelledby="search-recently-viewed" className={SECTION_CLASS}>
              <h2 id="search-recently-viewed" className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground sm:px-6">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Recently viewed
              </h2>
              <ul className="divide-y divide-border">
                {recentRecords.slice(0, 8).map((record) => (
                  <li key={record.path}>
                    <Link href={record.path} prefetch={false} className="flex min-w-0 items-center gap-3 px-4 py-3 text-sm hover:bg-accent sm:px-6">
                      <MetadataIcon icon={record.tableIcon} kind="table" className="text-muted-foreground" />
                      <span className="min-w-0 truncate font-medium text-foreground">{record.recordLabel}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{record.tableLabel}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {nothingFound && (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center" data-qqq-id="search-empty-state">
          <p className="text-sm font-medium text-foreground">
            {view === 'pages' ? 'No pages match' : singleTable ? `No ${singleTable.label} records match` : recordSearchAvailable ? 'No pages or records match' : 'No pages or recent records match'} &ldquo;{term}&rdquo;.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Check the spelling, or try fewer or different words.</p>
          {(singleTable || view === 'pages' || filterTables.length > 1) && (
            <Link href={filterHref({})} replace className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent" data-qqq-id="button-search-everywhere">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Search everything instead
            </Link>
          )}
        </div>
      )}

      {term && (
        <div className={cn(showSplit && 'grid grid-cols-[minmax(0,1fr)_minmax(24rem,34rem)] items-start gap-6')}>
        {/* delegated click: remembers the search when a result link is followed; ↑/↓ move between results */}
        <div className="min-w-0 space-y-5" onClick={rememberOnOpen} onKeyDown={handleResultsKeyDown}>
          {view !== 'pages' && !singleTable && pages.length > 0 && (
            <PagesSection pages={pages.slice(0, OVERVIEW_PAGES)} term={term} moreHref={pages.length > OVERVIEW_PAGES ? filterHref({ view: 'pages' }) : undefined} total={pages.length} />
          )}
          {view === 'pages' && pages.length > 0 && <PagesSection pages={pages} term={term} total={pages.length} />}

          {view !== 'pages' && !singleTable && overviewGroups.map((group) => {
            const more = tableHasMore(group.results.length, group.summary, OVERVIEW_PER_TABLE)
            return (
              <section key={group.tableName} aria-labelledby={`search-table-${group.tableName}`} className={cn(SECTION_CLASS, overview.isStale && 'opacity-80')} data-qqq-id={`search-group-table-${group.tableName}`}>
                <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
                  <MetadataIcon icon={group.icon} kind="table" className="text-muted-foreground" />
                  <h2 id={`search-table-${group.tableName}`} className="min-w-0 truncate text-sm font-semibold text-foreground">{group.tableLabel}</h2>
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{tableCountLabel(group.results.length, group.summary)}</span>
                  {more && (
                    <Link href={filterHref({ tables: [group.tableName] })} replace scroll={false} prefetch={false} className="ml-auto shrink-0 text-sm font-medium text-primary hover:underline" data-qqq-id={`search-more-${group.tableName}`}>
                      Show all
                    </Link>
                  )}
                </div>
                <ul className="divide-y divide-border">
                  {group.results.map((result) => (
                    <SearchResultCard key={result.recordId} result={result} tableLabel={group.tableLabel} icon={group.icon} term={term} {...previewProps(result)} />
                  ))}
                </ul>
              </section>
            )
          })}

          {singleTable && tableResults.length > 0 && (
            <section aria-labelledby="search-table-results" className={SECTION_CLASS} data-qqq-id={`search-group-table-${singleTable.name}`}>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
                <MetadataIcon icon={singleTable.icon} kind="table" className="text-muted-foreground" />
                <h2 id="search-table-results" className="min-w-0 truncate text-sm font-semibold text-foreground">{singleTable.label}</h2>
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                  {tableSummary?.totalCount !== undefined ? `${tableResults.length} of ${tableSummary.totalCount}` : tableCountLabel(tableResults.length, tablePages.hasNextPage ? { tableName: singleTable.name, hasMore: true } : undefined)}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {tableResults.map((result) => (
                  <SearchResultCard key={result.recordId} result={result} tableLabel={singleTable.label} icon={singleTable.icon} term={term} {...previewProps(result)} />
                ))}
              </ul>
              {tablePages.hasNextPage && (
                <div className="border-t border-border px-4 py-3 text-center sm:px-6">
                  <button
                    type="button"
                    onClick={() => void tablePages.fetchNextPage()}
                    disabled={tablePages.isFetchingNextPage}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60"
                    data-qqq-id="button-search-show-more"
                  >
                    {tablePages.isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    Show more
                  </button>
                </div>
              )}
              {!tablePages.hasNextPage && !tableSummary && tableResults.length >= TABLE_PAGE_SIZE && (
                <p className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground sm:px-6" data-qqq-id="search-first-page-only">
                  Showing the first {TABLE_PAGE_SIZE} matches. Add words to narrow the search.
                </p>
              )}
            </section>
          )}

          {view !== 'pages' && !singleTable && recentMatches.length > 0 && (
            <section aria-labelledby="search-recent-matches" className={SECTION_CLASS} data-qqq-id="search-group-records">
              <h2 id="search-recent-matches" className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground sm:px-6">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Recently viewed
              </h2>
              <ul className="divide-y divide-border">
                {recentMatches.map((record) => (
                  <li key={record.path}>
                    <Link href={record.path} prefetch={false} className="flex min-w-0 items-center gap-3 px-4 py-3 text-sm hover:bg-accent sm:px-6" data-qqq-id={`search-recent-${record.path.replace(/\//g, '-')}`}>
                      <MetadataIcon icon={record.tableIcon} kind="table" className="text-muted-foreground" />
                      <span className="min-w-0 truncate font-medium text-foreground"><HighlightedText text={record.recordLabel} term={term} /></span>
                      <span className="shrink-0 text-xs text-muted-foreground">{record.tableLabel}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        {showSplit && previewed && (
          <aside
            aria-label="Record preview"
            className="sticky top-4 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-5 shadow-sm"
            data-qqq-id="search-preview-pane"
          >
            <RecordPreview key={resultKey(previewed.result)} result={previewed.result} tableLabel={previewed.tableLabel} icon={previewed.icon} term={term} headingId="search-preview-title" />
          </aside>
        )}
        </div>
      )}

      {/* Narrow screens: the preview opens as a side sheet */}
      <Dialog.Root open={sheetOpen && !splitView && previewed !== undefined} onOpenChange={setSheetOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed inset-y-0 right-0 z-[2001] flex w-full max-w-md flex-col bg-card shadow-xl focus:outline-none"
            aria-describedby={undefined}
            data-qqq-id="search-preview-sheet"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title className="text-sm font-semibold text-muted-foreground">Preview</Dialog.Title>
              <Dialog.Close className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close preview">
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
              {previewed && <RecordPreview key={resultKey(previewed.result)} result={previewed.result} tableLabel={previewed.tableLabel} icon={previewed.icon} term={term} headingId="search-preview-sheet-title" />}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

/**
 * The matching pages section.
 *
 * @param props - Component properties.
 * @param props.pages - Pages to list.
 * @param props.term - Search text.
 * @param props.total - All matching pages.
 * @param props.moreHref - Link to every matching page, when not all are listed.
 * @returns The section.
 */
function PagesSection({ pages, term, total, moreHref }: { pages: ReturnType<typeof searchNavTargets>; term: string; total: number; moreHref?: string }) {
  return (
    <section aria-labelledby="search-pages" className={SECTION_CLASS} data-qqq-id="search-group-pages">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <h2 id="search-pages" className="text-sm font-semibold text-foreground">Pages</h2>
        <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{total}</span>
        {moreHref && (
          <Link href={moreHref} replace scroll={false} prefetch={false} className="ml-auto text-sm font-medium text-primary hover:underline" data-qqq-id="search-more-pages">
            Show all
          </Link>
        )}
      </div>
      <ul className="divide-y divide-border">
        {pages.map((target) => {
          const context = target.ancestors.map((ancestor) => ancestor.label).join(' / ')
          return (
            <li key={target.path}>
              <Link href={target.path} prefetch={false} className="flex min-w-0 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent sm:px-6" data-qqq-id={`search-page-${target.path.replace(/\//g, '-')}`}>
                <MetadataIcon icon={target.icon} kind={ICON_KIND[target.nodeType] ?? 'app'} className="text-muted-foreground" />
                <span className="min-w-0 truncate font-medium text-foreground"><HighlightedText text={target.label} term={term} /></span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">{[TYPE_LABEL[target.nodeType], context].filter(Boolean).join(' · ')}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
