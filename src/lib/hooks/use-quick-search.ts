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
 * @file useQuickSearch — state and keyboard behaviour of a search-as-you-type combobox
 * (the header search and the `/` dialog): the term, record search, grouped options, the
 * active option, recent searches and recently viewed records.
 *
 * Keyboard: ↓/↑ move the active option, Enter opens it (Ctrl/⌘+Enter in a new tab), and
 * with a term the first option is active until the user moves, so Enter opens the top hit.
 * Without a term nothing is active, so Enter does nothing until the user picks.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { NavTarget } from '@/lib/hooks/use-routes'
import { useRecordSearch, type RecordSearchState } from '@/lib/hooks/use-record-search'
import { getRecentRecords, type RecentRecord } from '@/lib/utils/recent-records'
import type { SearchableTable } from '@/lib/utils/record-search'
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/search/recent-searches'
import { buildQuickSearchGroups, flattenOptions, type QuickSearchGroup, type QuickSearchOption } from '@/lib/search/search-model'
import { openInNewTab, searchPagePath } from '@/lib/search/search-url'

/** Records requested per table by the quick search. */
export const QUICK_SEARCH_RECORDS_PER_TABLE = 6

/** Options of {@link useQuickSearch}. */
export interface UseQuickSearchOptions {
  /** Whether the search is open (record search and recents run only while open). */
  open: boolean
  /** Search text (owned by the caller's input). */
  term: string
  /** Sets the search text. */
  setTerm: (term: string) => void
  /** Navigable pages. */
  navTargets: NavTarget[]
  /** Searchable tables (empty: record search unavailable, never called). */
  searchTables: SearchableTable[]
  /** Navigates in this tab (the caller also closes the search; the term is cleared after). */
  onNavigate: (path: string) => void
}

/** State and handlers returned by {@link useQuickSearch}. */
export interface QuickSearchController {
  /** Search text. */
  term: string
  /** Sets the search text. */
  setTerm: (term: string) => void
  /** Record search status. */
  recordSearch: RecordSearchState
  /** Groups to render. */
  groups: QuickSearchGroup[]
  /** Every option, in keyboard order. */
  options: QuickSearchOption[]
  /** Id of the active option, or `null`. */
  activeId: string | null
  /** Makes an option active (pointer hover). */
  setActiveId: (id: string | null) => void
  /** Opens or applies an option. */
  choose: (option: QuickSearchOption, newTab?: boolean) => void
  /** Opens the search page for the current term. */
  openSearchPage: () => void
  /** Clears the recent search terms. */
  clearRecent: () => void
  /** Keyboard handler for the combobox input; returns nothing, handles ↑↓ and Enter. */
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

/**
 * Search-as-you-type state for a combobox over pages, records and recents.
 *
 * @param options - Open state, candidates and navigation.
 * @returns The controller.
 */
export function useQuickSearch({ open, term, setTerm: setTermProp, navTargets, searchTables, onNavigate }: UseQuickSearchOptions): QuickSearchController {
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [activeId, setActiveIdState] = useState<string | null>(null)
  // whether the user moved the selection since the options last changed
  const userMovedRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setRecentRecords(getRecentRecords().slice(0, 10))
    setRecentSearches(getRecentSearches())
  }, [open])

  const recordSearch = useRecordSearch(open ? term : '', searchTables, QUICK_SEARCH_RECORDS_PER_TABLE)
  const groups = useMemo(() => buildQuickSearchGroups({
    term,
    navTargets,
    recentRecords,
    recentSearches,
    results: recordSearch.results,
    summaries: recordSearch.summaries,
    tables: searchTables,
    limitPerTable: QUICK_SEARCH_RECORDS_PER_TABLE,
  }), [term, navTargets, recentRecords, recentSearches, recordSearch.results, recordSearch.summaries, searchTables])
  const options = useMemo(() => flattenOptions(groups), [groups])
  const hasTerm = term.trim().length > 0

  // a new term discards a choice made for the previous one (runs before the effect below)
  const previousTermRef = useRef(term)
  useEffect(() => {
    if (previousTermRef.current === term) return
    previousTermRef.current = term
    userMovedRef.current = false
  }, [term])

  // keep the active option while it is listed and the user chose it; else the first (with a
  // term). While the records belong to the previous term, preselect only a current entry
  // (a page or "search everything"), so Enter never opens a stale record.
  const stale = recordSearch.isStale
  useEffect(() => {
    setActiveIdState((current) => {
      if (current && userMovedRef.current && options.some((option) => option.id === current)) return current
      userMovedRef.current = false
      if (!hasTerm) return null
      // never preselect a completion (Enter opens a result), nor a stale record
      const first = options.find((option) => option.kind !== 'query' && (!stale || (option.kind !== 'record' && option.kind !== 'more')))
      return first?.id ?? null
    })
  }, [options, hasTerm, stale])

  const setTerm = useCallback((next: string) => {
    userMovedRef.current = false
    setTermProp(next)
  }, [setTermProp])

  const setActiveId = useCallback((id: string | null) => {
    userMovedRef.current = true
    setActiveIdState(id)
  }, [])

  const choose = useCallback((option: QuickSearchOption, newTab = false) => {
    if (option.kind === 'query') {
      setTerm(option.term)
      return
    }
    if (hasTerm) setRecentSearches(addRecentSearch(term))
    if (newTab) {
      openInNewTab(option.path)
      return
    }
    onNavigate(option.path)
    setTerm('')
  }, [hasTerm, term, onNavigate, setTerm])

  const openSearchPage = useCallback(() => {
    if (!hasTerm) return
    setRecentSearches(addRecentSearch(term))
    onNavigate(searchPagePath({ q: term }))
    setTerm('')
  }, [hasTerm, term, onNavigate, setTerm])

  const clearRecent = useCallback(() => {
    clearRecentSearches()
    setRecentSearches([])
  }, [])

  const onInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    const index = activeId ? options.findIndex((option) => option.id === activeId) : -1
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (options.length > 0) setActiveId(options[Math.min(index + 1, options.length - 1)].id)
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveId(index > 0 ? options[index - 1].id : null)
        break
      case 'Enter': {
        event.preventDefault()
        // Shift+Enter always opens the results page
        if (event.shiftKey) {
          openSearchPage()
          break
        }
        const option = index >= 0 ? options[index] : undefined
        if (option) choose(option, event.metaKey || event.ctrlKey)
        else openSearchPage()
        break
      }
    }
  }, [activeId, options, setActiveId, choose, openSearchPage])

  return { term, setTerm, recordSearch, groups, options, activeId, setActiveId, choose, openSearchPage, clearRecent, onInputKeyDown }
}
