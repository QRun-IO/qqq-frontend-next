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
 * @file navigation-search — "jump to" search results for the header search, the `/`
 * search dialog and the search page: navigation targets and recently viewed records,
 * matched locally by label, plus the records a backend record search found (only
 * when the metadata advertises searchable tables; see `record-search.ts`).
 */

import type { QIcon } from '@/types'
import type { QAppNodeType } from '@/types/enums'
import type { NavTarget } from '@/lib/hooks/use-routes'
import type { RecordSearchResult } from '@/lib/api/tables'
import type { RecentRecord } from './recent-records'
import { recordSearchResultPath } from './record-search'

/** One selectable search result. */
export interface NavigationSearchItem {
  /**
   * `page` = app, table, process or report; `result` = record found by record search;
   * `record` = recently viewed record.
   */
  kind: 'page' | 'result' | 'record'
  /** Destination path. */
  path: string
  /** Primary label. */
  label: string
  /** Secondary context: enclosing apps for pages, table label for records. */
  context: string
  /** Metadata icon (pages only). */
  icon?: QIcon
  /** App-tree node type (pages only). */
  nodeType?: QAppNodeType
}

/**
 * Case-insensitive substring test.
 *
 * @param text - Text to search.
 * @param needle - Lowercased search term.
 * @returns Whether `text` contains `needle`.
 */
function includes(text: string | undefined, needle: string): boolean {
  return Boolean(text && text.toLowerCase().includes(needle))
}

/**
 * Filters navigation targets by a free-text term: label matches first, then targets
 * whose enclosing app matches, preserving tree order within each group.
 *
 * @param targets - Navigable targets.
 * @param term - Search text; blank returns no matches.
 * @returns Matching targets.
 */
export function searchNavTargets(targets: NavTarget[], term: string): NavTarget[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return []
  const byLabel = targets.filter((target) => includes(target.label, needle))
  const byApp = targets.filter((target) => !byLabel.includes(target)
    && target.ancestors.some((ancestor) => includes(ancestor.label, needle)))
  return [...byLabel, ...byApp]
}

/**
 * Filters recently viewed records by record label or table label.
 *
 * @param records - Recently viewed records, newest first.
 * @param term - Search text; blank returns every record.
 * @returns Matching records.
 */
export function searchRecentRecords(records: RecentRecord[], term: string): RecentRecord[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return records
  return records.filter((record) => includes(record.recordLabel, needle) || includes(record.tableLabel, needle))
}

/**
 * Builds the ordered result list: matching pages, then records found by record
 * search (in backend order), then matching recent records not already found.
 *
 * @param targets - Navigable targets.
 * @param records - Recently viewed records, newest first.
 * @param term - Search text; blank lists only the recent records.
 * @param limit - Maximum pages and recent records (record search limits its own results).
 * @param found - Records found by record search for `term`.
 * @returns Selectable results.
 */
export function buildNavigationSearchItems(
  targets: NavTarget[],
  records: RecentRecord[],
  term: string,
  limit = 8,
  found: RecordSearchResult[] = []
): NavigationSearchItem[] {
  const pages: NavigationSearchItem[] = searchNavTargets(targets, term).slice(0, limit).map((target) => ({
    kind: 'page',
    path: target.path,
    label: target.label,
    context: target.ancestors.map((ancestor) => ancestor.label).join(' / '),
    icon: target.icon,
    nodeType: target.nodeType,
  }))
  const results: NavigationSearchItem[] = found.map((result) => ({
    kind: 'result',
    path: recordSearchResultPath(result),
    label: result.recordLabel,
    context: result.tableLabel ?? '',
  }))
  const foundPaths = new Set(results.map((result) => result.path))
  const recent: NavigationSearchItem[] = searchRecentRecords(records, term)
    .filter((record) => !foundPaths.has(record.path))
    .slice(0, limit)
    .map((record) => ({
      kind: 'record',
      path: record.path,
      label: record.recordLabel,
      context: record.tableLabel,
    }))
  return [...pages, ...results, ...recent]
}
