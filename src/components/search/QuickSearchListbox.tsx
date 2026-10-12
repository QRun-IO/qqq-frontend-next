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
 * @file QuickSearchListbox — the results of a search-as-you-type combobox: record search
 * status (searching, the failure class with a retry, or a provider fallback notice), then
 * grouped options (Top hits, Pages, one group per table with its count, Recently viewed,
 * "search everything"), as an ARIA listbox driven by `aria-activedescendant`.
 */

'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, History, Loader2, RotateCw } from 'lucide-react'

import type { QuickSearchController } from '@/lib/hooks/use-quick-search'
import type { QuickSearchOption } from '@/lib/search/search-model'
import { cn } from '@/lib/utils/cn'
import { MetadataIcon } from '@/components/layout/MetadataIcon'
import { SearchOptionContent } from './SearchOptionContent'

/**
 * DOM id of an option (referenced by the combobox's `aria-activedescendant`).
 *
 * @param listboxId - The listbox id.
 * @param optionId - The option id.
 * @returns A DOM-safe id.
 */
export function quickSearchOptionDomId(listboxId: string, optionId: string): string {
  return `${listboxId}-${optionId.replace(/[^A-Za-z0-9_-]/g, (char) => `_${char.charCodeAt(0).toString(16)}`)}`
}

/** Props for {@link QuickSearchListbox}. */
export interface QuickSearchListboxProps {
  /** DOM id of the listbox (the combobox's `aria-controls`). */
  id: string
  /** The search controller. */
  search: QuickSearchController
  /** Classes for the scrolling list (e.g. its max height). */
  listClassName?: string
}

/**
 * Whether a link click should be left to the browser (new tab or window, download).
 *
 * @param event - The click.
 * @returns `true` for modified or non-primary clicks.
 */
function isBrowserClick(event: React.MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

/**
 * Renders the status line, the grouped options and the empty state.
 *
 * @param props - Component properties.
 * @returns The status region and the listbox.
 */
export function QuickSearchListbox({ id, search, listClassName }: QuickSearchListboxProps) {
  const { term, groups, activeId, setActiveId, choose, recordSearch, clearRecent } = search
  const trimmed = term.trim()
  const activeDomId = activeId ? quickSearchOptionDomId(id, activeId) : undefined

  // keep the active option visible while moving with the keyboard
  useEffect(() => {
    if (activeDomId) document.getElementById(activeDomId)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeDomId])

  const searching = recordSearch.isSearching
  const { failure, fallback } = recordSearch
  const matches = groups.some((group) => group.kind !== 'actions' && group.options.length > 0)
  const recentSearchGroup = !trimmed && groups.some((group) => group.kind === 'recent-searches')

  /**
   * Renders one option.
   *
   * @param option - The option.
   * @param showTable - Show the record's table (mixed-table groups).
   * @returns The option element.
   */
  const renderOption = (option: QuickSearchOption, showTable: boolean) => {
    const active = option.id === activeId
    const className = cn(
      'flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left outline-none transition-colors pointer-coarse:min-h-11',
      active ? 'bg-accent' : 'hover:bg-accent/50'
    )
    const common = {
      id: quickSearchOptionDomId(id, option.id),
      role: 'option' as const,
      'aria-selected': active,
      // mousemove, not mouseenter: results rendering under a resting pointer must not steal the keyboard selection
      onMouseMove: () => { if (!active) setActiveId(option.id) },
      className,
      'data-qqq-id': `search-option-${option.kind}`,
      'data-option-id': option.id,
    }
    if (option.kind === 'query') {
      return (
        <div key={option.id} {...common} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
          <SearchOptionContent option={option} term={trimmed} />
        </div>
      )
    }
    return (
      <Link
        key={option.id}
        {...common}
        href={option.path}
        prefetch={false}
        tabIndex={-1}
        // keep focus in the input
        onMouseDown={(event) => { if (event.button === 0) event.preventDefault() }}
        onClick={(event) => {
          if (isBrowserClick(event)) return
          event.preventDefault()
          choose(option)
        }}
      >
        <SearchOptionContent option={option} term={trimmed} showTable={showTable} />
      </Link>
    )
  }

  return (
    <>
      {/* Record search progress, failure and fallback, announced politely (outside the listbox: not options) */}
      <div role="status" aria-live="polite" data-qqq-id="search-results-status">
        {searching && !failure && (
          <p className="flex items-center gap-2 px-3 pt-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Searching records…
          </p>
        )}
        {failure && (
          <div className="mx-2 mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs" data-qqq-id="search-failure" data-failure-kind={failure.kind}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{failure.title}</p>
              {failure.detail && <p className="break-words text-muted-foreground">{failure.detail}</p>}
              <p className="text-muted-foreground">Showing pages and recently viewed records only.</p>
            </div>
            {failure.retryable && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={recordSearch.retry}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-qqq-id="button-search-retry"
              >
                <RotateCw className="h-3 w-3" aria-hidden="true" />
                Retry
              </button>
            )}
          </div>
        )}
        {fallback && !failure && (
          <div className="mx-2 mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs" data-qqq-id="search-fallback">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{fallback.title}</p>
              {fallback.detail && <p className="break-words text-muted-foreground">{fallback.detail}</p>}
            </div>
          </div>
        )}
      </div>

      <div
        id={id}
        role="listbox"
        aria-label="Search results"
        aria-busy={searching}
        className={cn('overflow-y-auto overscroll-contain py-1', recordSearch.isStale && 'opacity-80', listClassName)}
        data-qqq-id="search-results"
      >
        {trimmed && !matches && !searching && (
          <p className="px-3 py-5 text-center text-sm text-muted-foreground" data-qqq-id="search-results-empty">
            {recordSearch.available && !failure ? 'No pages or records match' : 'No pages or recent records match'} &ldquo;{trimmed}&rdquo;
          </p>
        )}
        {!trimmed && groups.length === 0 && (
          <p className="px-3 py-5 text-center text-sm text-muted-foreground" data-qqq-id="search-results-hint">
            {recordSearch.available ? 'Type to find an app, table, process or record.' : 'Type to find an app, table, process or recent record.'}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.id} role="group" aria-labelledby={`${id}-group-${group.id.replace(/[^A-Za-z0-9_-]/g, '_')}`} data-qqq-id={`search-group-${group.kind}`}>
            <div
              id={`${id}-group-${group.id.replace(/[^A-Za-z0-9_-]/g, '_')}`}
              className="flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {group.kind === 'recent' && <Clock className="h-3 w-3" aria-hidden="true" />}
              {group.kind === 'recent-searches' && <History className="h-3 w-3" aria-hidden="true" />}
              {group.kind === 'table' && <MetadataIcon icon={group.icon} kind="table" className="h-3 w-3" />}
              <span className="truncate">{group.heading}</span>
              {group.count && (
                <>
                  <span className="ml-auto rounded-full bg-muted px-1.5 py-px text-[0.65rem] font-medium normal-case tracking-normal tabular-nums" aria-hidden="true">
                    {group.count}
                  </span>
                  <span className="sr-only">{` ${group.count} matches`}</span>
                </>
              )}
            </div>
            {group.options.map((option) => renderOption(option, group.kind === 'top'))}
          </div>
        ))}
      </div>

      {recentSearchGroup && (
        <div className="flex justify-end border-t border-border px-3 py-1.5">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearRecent}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-qqq-id="button-clear-recent-searches"
          >
            Clear recent searches
          </button>
        </div>
      )}
    </>
  )
}
