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
 * @file QuickSearchPanel — the results half of a search-as-you-type combobox (record
 * search, ranking, grouping, listbox). Loaded on demand by the header search and the `/`
 * dialog, which own only the input: the panel hands its keyboard handler and active option
 * back through `onController`, so every page's first load stays small.
 */

'use client'

import React, { useEffect } from 'react'

import type { NavTarget } from '@/lib/hooks/use-routes'
import { useQuickSearch } from '@/lib/hooks/use-quick-search'
import type { SearchableTable } from '@/lib/utils/record-search'
import { QuickSearchListbox, quickSearchOptionDomId } from './QuickSearchListbox'

/** What the input needs from a mounted panel. */
export interface QuickSearchPanelController {
  /** Keyboard handler for the combobox input (↑↓, Enter, Ctrl/⌘+Enter). */
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  /** DOM id of the active option (`aria-activedescendant`), if any. */
  activeDescendant?: string
  /** Whether the panel has anything to show (results, recents or a hint). */
  hasContent: boolean
}

/** Props for {@link QuickSearchPanel}. */
export interface QuickSearchPanelProps {
  /** DOM id of the listbox (the combobox's `aria-controls`). */
  listboxId: string
  /** Whether the search is open. */
  open: boolean
  /** Search text (owned by the input). */
  term: string
  /** Sets the search text. */
  setTerm: (term: string) => void
  /** Navigable pages. */
  navTargets: NavTarget[]
  /** Searchable tables (empty: record search unavailable, never called). */
  searchTables: SearchableTable[]
  /** Navigates in this tab (the caller closes the search). */
  onNavigate: (path: string) => void
  /** Receives the controller whenever it changes (`null` on unmount). */
  onController: (controller: QuickSearchPanelController | null) => void
  /** Classes for the scrolling list. */
  listClassName?: string
  /** Rendered below the results (e.g. keyboard hints) when there is content. */
  footer?: React.ReactNode
  /** Render nothing (not even the typing hint) while there is nothing to show (a dropdown). */
  hideWhenEmpty?: boolean
}

/**
 * Renders the quick search results and wires them to the caller's input.
 *
 * @param props - Component properties.
 * @returns The results (or the typing hint), or nothing when empty and `hideWhenEmpty`.
 */
export function QuickSearchPanel({ listboxId, open, term, setTerm, navTargets, searchTables, onNavigate, onController, listClassName, footer, hideWhenEmpty = false }: QuickSearchPanelProps) {
  const search = useQuickSearch({ open, term, setTerm, navTargets, searchTables, onNavigate })
  const hasContent = term.trim().length > 0 || search.groups.length > 0
  const activeDescendant = search.activeId ? quickSearchOptionDomId(listboxId, search.activeId) : undefined
  const { onInputKeyDown } = search

  useEffect(() => {
    onController({ onInputKeyDown, activeDescendant, hasContent })
  }, [onController, onInputKeyDown, activeDescendant, hasContent])
  useEffect(() => () => onController(null), [onController])

  if (!hasContent && hideWhenEmpty) return null
  return (
    <>
      <QuickSearchListbox id={listboxId} search={search} listClassName={listClassName} />
      {footer}
    </>
  )
}
