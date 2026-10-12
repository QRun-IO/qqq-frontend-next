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
 * @file search-model — ranks and groups everything the quick search shows: pages (apps,
 * tables, processes, reports matched locally), records found by record search (grouped by
 * table with counts, best matches promoted to "Top hits"), recently viewed records, recent
 * search terms, and the "more in table" / "all results" links. Pure functions over plain
 * data, shared by the header search, the `/` dialog and the search page.
 */

import type { QIcon } from '@/types'
import type { QAppNodeType } from '@/types/enums'
import type { NavTarget } from '@/lib/hooks/use-routes'
import type { RecordSearchResult, RecordSearchTableSummary } from '@/lib/api/record-search'
import type { RecentRecord } from '@/lib/utils/recent-records'
import { recordSearchResultPath, type SearchableTable } from '@/lib/utils/record-search'
import { searchNavTargets, searchRecentRecords } from '@/lib/utils/navigation-search'
import { termTokens } from './highlight'
import { searchPagePath, type SearchSort } from './search-url'

export { parseSearchPageState, searchPagePath, type SearchPageState, type SearchSort } from './search-url'

/** One selectable entry of the quick search listbox. */
export type QuickSearchOption =
  | { id: string; kind: 'page'; path: string; label: string; context: string; icon?: QIcon; nodeType?: QAppNodeType }
  | { id: string; kind: 'record'; path: string; label: string; tableLabel: string; icon?: QIcon; result: RecordSearchResult }
  | { id: string; kind: 'recent'; path: string; label: string; tableLabel: string; icon?: QIcon }
  | { id: string; kind: 'query'; term: string; completion?: boolean }
  | { id: string; kind: 'more'; path: string; tableLabel: string; count?: string }
  | { id: string; kind: 'all'; path: string; term: string }

/** A titled group of options. */
export interface QuickSearchGroup {
  /** Stable id (DOM ids derive from it). */
  id: string
  /** Visible heading. */
  heading: string
  /** Count shown beside the heading, e.g. "12" or "25+". */
  count?: string
  /** Heading icon (a table's icon for its group). */
  icon?: QIcon
  /** What the group holds. */
  kind: 'top' | 'suggestions' | 'pages' | 'table' | 'recent' | 'recent-searches' | 'actions'
  /** The group's options, in order. */
  options: QuickSearchOption[]
}

/** How well a label matches a term: 4 exact, 3 prefix, 2 every word starts a word, 1 every word contained, 0 otherwise. */
export type MatchQuality = 0 | 1 | 2 | 3 | 4

/**
 * Grades how well a label matches the search term.
 *
 * @param label - Label to grade.
 * @param term - Search text.
 * @returns The match quality.
 */
export function labelQuality(label: string, term: string): MatchQuality {
  const text = label.trim().toLowerCase()
  const whole = term.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!whole) return 0
  if (text === whole) return 4
  if (text.startsWith(whole)) return 3
  const tokens = termTokens(whole)
  const words = text.split(/[\s\-_/.,:;()]+/).filter(Boolean)
  if (tokens.every((token) => words.some((word) => word.startsWith(token)))) return 2
  if (tokens.every((token) => text.includes(token))) return 1
  return 0
}

/**
 * Orders one table's results. With `recent`, newest `updatedAt` first (records without one
 * last). With `relevance`, a provider's order (it sent scores) is kept; otherwise (the
 * default search orders by primary key) better label matches come first, stably.
 *
 * @param results - One table's results, in backend order.
 * @param term - Search text.
 * @param sort - Requested order.
 * @returns The ordered results (a new array).
 */
export function orderTableResults(results: RecordSearchResult[], term: string, sort: SearchSort = 'relevance'): RecordSearchResult[] {
  const indexed = results.map((result, index) => ({ result, index }))
  if (sort === 'recent') {
    const time = (result: RecordSearchResult) => (result.updatedAt ? Date.parse(result.updatedAt) : NaN)
    return indexed
      .sort((a, b) => {
        const ta = time(a.result)
        const tb = time(b.result)
        if (Number.isNaN(ta) !== Number.isNaN(tb)) return Number.isNaN(ta) ? 1 : -1
        return (Number.isNaN(ta) ? 0 : tb - ta) || a.index - b.index
      })
      .map(({ result }) => result)
  }
  if (results.some((result) => result.score !== undefined)) return [...results]
  return indexed
    .sort((a, b) => labelQuality(b.result.recordLabel, term) - labelQuality(a.result.recordLabel, term) || a.index - b.index)
    .map(({ result }) => result)
}

/** Results of one table, with its summary. */
export interface TableResults {
  /** Backend table name. */
  tableName: string
  /** Table label. */
  tableLabel: string
  /** Table icon from metadata. */
  icon?: QIcon
  /** Ordered results. */
  results: RecordSearchResult[]
  /** Summary from the backend (extended contract), when sent. */
  summary?: RecordSearchTableSummary
}

/**
 * Groups results by table, in the backend's table order, with each table's summary and
 * metadata icon, ordered per {@link orderTableResults}.
 *
 * @param results - Results in backend order.
 * @param summaries - Per-table summaries (extended contract), if any.
 * @param tables - Searchable tables (labels and icons).
 * @param term - Search text.
 * @param sort - Requested order.
 * @returns One entry per table that has results.
 */
export function groupResultsByTable(
  results: RecordSearchResult[],
  summaries: RecordSearchTableSummary[] | undefined,
  tables: SearchableTable[],
  term: string,
  sort: SearchSort = 'relevance'
): TableResults[] {
  const byName = new Map<string, RecordSearchResult[]>()
  for (const result of results) {
    const list = byName.get(result.tableName)
    if (list) list.push(result)
    else byName.set(result.tableName, [result])
  }
  return [...byName.entries()].map(([tableName, tableResults]) => {
    const table = tables.find((candidate) => candidate.name === tableName)
    return {
      tableName,
      tableLabel: table?.label ?? tableResults[0].tableLabel ?? tableName,
      icon: table?.icon,
      results: orderTableResults(tableResults, term, sort),
      summary: summaries?.find((summary) => summary.tableName === tableName),
    }
  })
}

/**
 * The count shown for a table: its total when known, the returned count with "+" when
 * more are available, else the returned count.
 *
 * @param shown - Results returned for the table.
 * @param summary - The table's summary, if any.
 * @returns e.g. "128", "25+" or "3".
 */
export function tableCountLabel(shown: number, summary?: RecordSearchTableSummary): string {
  if (summary?.totalCount !== undefined && summary.totalCount >= shown) return String(summary.totalCount)
  if (summary?.hasMore) return `${shown}+`
  return String(shown)
}

/**
 * Whether a table has more matches than were shown.
 *
 * @param shown - Results shown.
 * @param summary - The table's summary, if any.
 * @param limit - The per-table limit that was requested (older backends: a full page suggests more).
 * @returns Whether to offer more.
 */
export function tableHasMore(shown: number, summary: RecordSearchTableSummary | undefined, limit: number): boolean {
  if (summary?.hasMore !== undefined) return summary.hasMore || (summary.totalCount ?? 0) > shown
  if (summary?.totalCount !== undefined) return summary.totalCount > shown
  return shown >= limit
}

/** Inputs of {@link buildQuickSearchGroups}. */
export interface QuickSearchInput {
  /** Search text. */
  term: string
  /** Navigable pages. */
  navTargets: NavTarget[]
  /** Recently viewed records, newest first. */
  recentRecords: RecentRecord[]
  /** Recent search terms, newest first. */
  recentSearches: string[]
  /** Record search results for `term` (empty while searching, failed or unavailable). */
  results: RecordSearchResult[]
  /** Per-table summaries from the response, if any. */
  summaries?: RecordSearchTableSummary[]
  /** Searchable tables (labels and icons). */
  tables: SearchableTable[]
  /** Records requested per table (to tell when more may exist). */
  limitPerTable: number
  /** Most pages listed. */
  maxPages?: number
  /** Most results listed per table. */
  maxPerTable?: number
}

/** Most term completions offered. */
const MAX_COMPLETIONS = 3

/**
 * Completes the last word of a search term from the words of matching labels, most
 * frequent first ("acme co" with "Acme Corp" and "Acme Corporation" offers "acme corp" and
 * "acme corporation").
 *
 * @param term - Search text (the last word needs two characters).
 * @param labels - Labels of matching pages and records.
 * @returns Up to three completed terms, lowercased, never the term itself.
 */
export function termCompletions(term: string, labels: string[]): string[] {
  const words = term.trim().split(/\s+/)
  const last = (words.pop() ?? '').toLowerCase()
  if (last.length < 2) return []
  const prefix = words.join(' ').toLowerCase()
  const counts = new Map<string, number>()
  for (const label of labels) {
    for (const word of new Set(label.toLowerCase().split(/[\s\-_/.,:;()"'@]+/))) {
      if (word.length > last.length && word.startsWith(last)) counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))
    .slice(0, MAX_COMPLETIONS)
    .map(([word]) => (prefix ? `${prefix} ${word}` : word))
}

/** Most entries in "Top hits". */
const MAX_TOP_HITS = 3

/**
 * Builds the quick search's groups.
 *
 * Without a term: recent searches, then recently viewed records. With a term: "Top hits"
 * (exact and prefix matches across pages and records, best first), "Pages", one group per
 * table with its count and a "more in table" link when it has more, matching recently viewed
 * records not already listed, and finally a "search all results" entry, so Enter always has a
 * useful target.
 *
 * @param input - Term, candidates and limits.
 * @returns Non-empty groups, in display order.
 */
export function buildQuickSearchGroups(input: QuickSearchInput): QuickSearchGroup[] {
  const { term, navTargets, recentRecords, recentSearches, results, summaries, tables, limitPerTable, maxPages = 5, maxPerTable = 5 } = input
  const trimmed = term.trim()
  const groups: QuickSearchGroup[] = []

  if (!trimmed) {
    if (recentSearches.length > 0) {
      groups.push({
        id: 'recent-searches',
        heading: 'Recent searches',
        kind: 'recent-searches',
        options: recentSearches.slice(0, 5).map((query) => ({ id: `query:${query}`, kind: 'query', term: query })),
      })
    }
    if (recentRecords.length > 0) {
      groups.push({
        id: 'recent',
        heading: 'Recently viewed',
        kind: 'recent',
        options: recentRecords.slice(0, 6).map((record) => ({ id: `recent:${record.path}`, kind: 'recent', path: record.path, label: record.recordLabel, tableLabel: record.tableLabel, icon: record.tableIcon })),
      })
    }
    return groups
  }

  const pages = searchNavTargets(navTargets, trimmed).map((target) => ({
    option: {
      id: `page:${target.path}`,
      kind: 'page' as const,
      path: target.path,
      label: target.label,
      context: target.ancestors.map((ancestor) => ancestor.label).join(' / '),
      icon: target.icon,
      nodeType: target.nodeType,
    },
    quality: labelQuality(target.label, trimmed),
  }))
  // stable: better label matches first, tree order otherwise
  pages.sort((a, b) => b.quality - a.quality)

  const byTable = groupResultsByTable(results, summaries, tables, trimmed)
  const records = byTable.flatMap((table) => table.results.map((result, rank) => ({
    option: {
      id: `record:${table.tableName}:${result.recordId}`,
      kind: 'record' as const,
      path: recordSearchResultPath(result),
      label: result.recordLabel,
      tableLabel: table.tableLabel,
      icon: table.icon,
      result,
    },
    quality: labelQuality(result.recordLabel, trimmed),
    rank,
  })))

  const topCandidates = [
    ...pages.filter((page) => page.quality >= 3).map((page) => ({ ...page, score: 0, record: false })),
    ...records.filter((record) => record.quality >= 3 || (record.rank === 0 && record.quality >= 2 && record.option.result.score !== undefined))
      .map((record) => ({ ...record, score: record.option.result.score ?? 0, record: true })),
  ]
  topCandidates.sort((a, b) => b.quality - a.quality || b.score - a.score || Number(a.record) - Number(b.record) || a.option.label.length - b.option.label.length)
  const top = topCandidates.slice(0, MAX_TOP_HITS).map((candidate) => candidate.option)
  const topIds = new Set(top.map((option) => option.id))
  if (top.length > 0) groups.push({ id: 'top', heading: 'Top hits', kind: 'top', options: top })

  const completions = termCompletions(trimmed, [...pages.map((page) => page.option.label), ...records.map((record) => record.option.label)])
  if (completions.length > 0) {
    groups.push({
      id: 'suggestions',
      heading: 'Suggestions',
      kind: 'suggestions',
      options: completions.map((completion) => ({ id: `complete:${completion}`, kind: 'query', term: completion, completion: true })),
    })
  }

  const remainingPages = pages.map((page) => page.option).filter((option) => !topIds.has(option.id)).slice(0, maxPages)
  if (remainingPages.length > 0) groups.push({ id: 'pages', heading: 'Pages', kind: 'pages', options: remainingPages })

  for (const table of byTable) {
    const shown = table.results.length
    const options: QuickSearchOption[] = records
      .filter((record) => record.option.result.tableName === table.tableName && !topIds.has(record.option.id))
      .slice(0, maxPerTable)
      .map((record) => record.option)
    const listed = options.length + table.results.filter((result) => topIds.has(`record:${table.tableName}:${result.recordId}`)).length
    const count = tableCountLabel(shown, table.summary)
    if (listed < shown || tableHasMore(shown, table.summary, limitPerTable)) {
      options.push({ id: `more:${table.tableName}`, kind: 'more', path: searchPagePath({ q: trimmed, tables: [table.tableName] }), tableLabel: table.tableLabel, count })
    }
    if (options.length > 0) groups.push({ id: `table:${table.tableName}`, heading: table.tableLabel, count, icon: table.icon, kind: 'table', options })
  }

  const foundPaths = new Set(records.map((record) => record.option.path))
  const recent = searchRecentRecords(recentRecords, trimmed)
    .filter((record) => !foundPaths.has(record.path))
    .slice(0, 3)
    .map((record): QuickSearchOption => ({ id: `recent:${record.path}`, kind: 'recent', path: record.path, label: record.recordLabel, tableLabel: record.tableLabel, icon: record.tableIcon }))
  if (recent.length > 0) groups.push({ id: 'recent', heading: 'Recently viewed', kind: 'recent', options: recent })

  groups.push({ id: 'actions', heading: 'Search', kind: 'actions', options: [{ id: 'all', kind: 'all', path: searchPagePath({ q: trimmed }), term: trimmed }] })
  return groups
}

/**
 * The options of all groups, in display order (the keyboard order).
 *
 * @param groups - Groups from {@link buildQuickSearchGroups}.
 * @returns Every option.
 */
export function flattenOptions(groups: QuickSearchGroup[]): QuickSearchOption[] {
  return groups.flatMap((group) => group.options)
}

/**
 * Where an option leads, if anywhere (a recent search term fills the input instead).
 *
 * @param option - The option.
 * @returns Its path, or `undefined`.
 */
export function optionPath(option: QuickSearchOption): string | undefined {
  return option.kind === 'query' ? undefined : option.path
}
