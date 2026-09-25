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
 * @file NavigationSearchResults — listbox of "jump to" results shared by the header search and the search dialog.
 */

'use client'

import React from 'react'
import { Clock } from 'lucide-react'

import type { RecordSearchState } from '@/lib/hooks/use-record-search'
import type { NavigationSearchItem } from '@/lib/utils/navigation-search'
import { cn } from '@/lib/utils/cn'
import { MetadataIcon, type MetadataIconKind } from './MetadataIcon'

/** Fallback icon kind for each app-tree node type. */
const ICON_KIND: Record<string, MetadataIconKind> = { APP: 'app', TABLE: 'table', PROCESS: 'process', REPORT: 'report' }

/** Props for {@link NavigationSearchResults}. */
export interface NavigationSearchResultsProps {
  /** DOM id of the listbox (referenced by the combobox's `aria-controls`). */
  id: string
  /** Ordered results: pages first, then recent records. */
  items: NavigationSearchItem[]
  /** Current search text (for the empty message). */
  term: string
  /** Index of the highlighted item, or -1. */
  selectedIndex: number
  /** Called with a result path when an item is chosen. */
  onSelect: (path: string) => void
  /** Called with an index when the pointer moves over an item. */
  onHover: (index: number) => void
  /** Record search status; omit when the backend has no record search. */
  recordSearch?: Pick<RecordSearchState, 'available' | 'isSearching' | 'isError'>
}

/**
 * Highlights the matched part of a label.
 *
 * @param props - Component properties.
 * @param props.text - Label text.
 * @param props.term - Search text.
 * @returns The label with the first match wrapped in `<mark>`.
 */
function Highlighted({ text, term }: { text: string; term: string }) {
  const needle = term.trim().toLowerCase()
  const at = needle ? text.toLowerCase().indexOf(needle) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-primary/20 px-0.5 text-foreground">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  )
}

/**
 * Renders grouped results ("Pages", "Records" found by record search, "Recently
 * viewed") as a listbox of options, with a polite status line for record search.
 *
 * @param props - Component properties.
 * @returns A `role="listbox"` element, with an empty message when nothing matches.
 */
export function NavigationSearchResults({ id, items, term, selectedIndex, onSelect, onHover, recordSearch }: NavigationSearchResultsProps) {
  const groups: Array<{ kind: NavigationSearchItem['kind']; heading: string }> = [
    { kind: 'page', heading: 'Pages' },
    { kind: 'result', heading: 'Records' },
    { kind: 'record', heading: 'Recently viewed' },
  ]
  const searching = recordSearch?.available === true && recordSearch.isSearching
  const status = searching
    ? 'Searching records…'
    : recordSearch?.available && recordSearch.isError ? 'Record search failed. Try again.' : ''

  return (
    <>
      {/* Record search progress and errors, announced politely (outside the listbox: not an option) */}
      <p role="status" aria-live="polite" className={cn('px-3 text-xs text-muted-foreground', status ? 'pt-2' : 'sr-only')} data-qqq-id="search-results-status">
        {status}
      </p>
      <div id={id} role="listbox" aria-label="Search results" aria-busy={searching} className="max-h-[400px] overflow-y-auto py-1" data-qqq-id="search-results">
        {items.length === 0 && !searching && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground" data-qqq-id="search-results-empty">
            {recordSearch?.available ? 'No pages or records match' : 'No pages or recent records match'} &ldquo;{term.trim()}&rdquo;
          </p>
        )}
        {groups.map(({ kind, heading }) => {
          const group = items.map((item, index) => ({ item, index })).filter(({ item }) => item.kind === kind)
          if (group.length === 0) return null
          return (
            <div key={kind} role="group" aria-label={heading}>
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" aria-hidden="true">
                {kind === 'record' && <Clock className="h-3 w-3" aria-hidden="true" />}
                {heading}
              </div>
              {group.map(({ item, index }) => (
                <button
                  key={`${item.kind}-${item.path}`}
                  type="button"
                  role="option"
                  aria-selected={selectedIndex === index}
                  onClick={() => onSelect(item.path)}
                  // mousemove, not mouseenter: results rendering under a resting pointer must not steal the keyboard selection
                  onMouseMove={() => { if (selectedIndex !== index) onHover(index) }}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                    selectedIndex === index ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                  data-qqq-id={`search-result-${item.kind}-${item.path.replace(/\//g, '-')}`}
                >
                  {item.kind === 'page' ? (
                    <MetadataIcon icon={item.icon} kind={item.nodeType ? ICON_KIND[item.nodeType] : 'app'} className="text-muted-foreground" />
                  ) : (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6rem] font-medium text-primary" aria-hidden="true">
                      {item.label.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      <Highlighted text={item.label} term={term} />
                    </span>
                    {item.context && <span className="block truncate text-xs text-muted-foreground">{item.context}</span>}
                  </span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </>
  )
}
