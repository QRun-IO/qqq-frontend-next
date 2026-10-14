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
 * @file search-url — the search page's URL state (`q`, `tables`, `view=pages`,
 * `sort=recent`), so searches can be shared and bookmarked. Kept apart from the search
 * model so the always-loaded shell (header, palette) can link to the page cheaply.
 */

/** Result order on the search page. */
export type SearchSort = 'relevance' | 'recent'

/** The search page's URL state. */
export interface SearchPageState {
  /** Search text. */
  q: string
  /** Tables to show (empty: all). */
  tables?: string[]
  /** Result order. */
  sort?: SearchSort
  /** `pages` shows only matching pages (apps, tables, processes, reports). */
  view?: 'all' | 'pages'
}

/**
 * The search page URL for a state (default values are omitted, so URLs stay short).
 *
 * @param state - Search text, tables, order and view.
 * @returns e.g. `/app/search?q=acme&tables=person&sort=recent`.
 */
export function searchPagePath({ q, tables, sort, view }: SearchPageState): string {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  if (view === 'pages') params.set('view', 'pages')
  else if (tables && tables.length > 0) params.set('tables', tables.join(','))
  if (sort === 'recent') params.set('sort', 'recent')
  const query = params.toString()
  return query ? `/app/search?${query}` : '/app/search'
}

/**
 * Reads the search page state from URL parameters (unknown values fall back to the defaults).
 *
 * @param params - The page's search params.
 * @returns The state.
 */
export function parseSearchPageState(params: Pick<URLSearchParams, 'get'>): Required<SearchPageState> {
  const view = params.get('view') === 'pages' ? 'pages' : 'all'
  const tables = view === 'pages' ? [] : [...new Set((params.get('tables') ?? '').split(',').map((name) => name.trim()).filter(Boolean))]
  return { q: params.get('q') ?? '', tables, sort: params.get('sort') === 'recent' ? 'recent' : 'relevance', view }
}

/**
 * Opens an app path in a new browser tab without giving it access to this window.
 *
 * @param path - App path.
 */
export function openInNewTab(path: string): void {
  window.open(path, '_blank', 'noopener,noreferrer')
}
