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
 * @file CommandRecordResults — record search inside the command palette: status (searching,
 * failure class, provider fallback) and one cmdk group per table with its count, records
 * with highlighted snippets, and a "see all" entry. Loaded on demand by the palette, only
 * when the metadata lists searchable tables.
 */

'use client'

import React, { useEffect, useMemo } from 'react'
import { Command } from 'cmdk'
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'

import { useRecordSearch } from '@/lib/hooks/use-record-search'
import { QUICK_SEARCH_RECORDS_PER_TABLE } from '@/lib/hooks/use-quick-search'
import { UI_API_EXTENSION, useUiApiExtensionInstalled } from '@/lib/api/ui-api-extensions'
import { recordSearchResultPath, type SearchableTable } from '@/lib/utils/record-search'
import { groupResultsByTable, tableCountLabel, tableHasMore } from '@/lib/search/search-model'
import { searchPagePath } from '@/lib/search/search-url'
import { SearchOptionContent } from './SearchOptionContent'

/** Records listed per table in the palette. */
export const PALETTE_RECORDS_PER_TABLE = 5

/** Props for {@link CommandRecordResults}. */
export interface CommandRecordResultsProps {
  /** Palette search text. */
  search: string
  /** Whether the palette is open. */
  open: boolean
  /** Searchable tables (non-empty). */
  tables: SearchableTable[]
  /** cmdk's highlighted value. */
  selectedValue: string
  /** Sets cmdk's highlighted value. */
  setSelectedValue: (value: string) => void
  /** Value of the first entry listed before the records (actions, pages), if any. */
  firstValueBefore?: string
  /** Value of the first entry listed after the records (recently viewed), if any. */
  firstValueAfter?: string
  /** Opens a path. */
  onSelect: (path: string) => void
  /** Reports how many records are listed and whether a search is pending. */
  onState: (state: { count: number; searching: boolean }) => void
  /** Class of a palette entry. */
  itemClassName: string
  /** Renders a group heading. */
  heading: (text: string) => React.ReactNode
}

/**
 * Renders record search status and results as cmdk groups.
 *
 * @param props - Component properties.
 * @returns Status and record groups.
 */
export function CommandRecordResults(props: CommandRecordResultsProps) {
  const { search, open, tables, selectedValue, setSelectedValue, firstValueBefore, firstValueAfter, onSelect, onState, itemClassName, heading } = props
  const trimmed = search.trim()
  const suggest = useUiApiExtensionInstalled(UI_API_EXTENSION.quickSearch, open)
  const recordSearch = useRecordSearch(open ? search : '', tables, suggest ? QUICK_SEARCH_RECORDS_PER_TABLE : PALETTE_RECORDS_PER_TABLE, { suggest })
  const groups = useMemo(
    () => groupResultsByTable(recordSearch.results, recordSearch.summaries, tables, trimmed),
    [recordSearch.results, recordSearch.summaries, tables, trimmed]
  )
  const count = groups.reduce((sum, group) => sum + group.results.length, 0)

  useEffect(() => onState({ count, searching: recordSearch.isSearching }), [count, recordSearch.isSearching, onState])

  // Records arrive after cmdk highlighted the first entry on typing; when that was the
  // search-everything entry (nothing else matched yet), highlight the new first entry instead.
  useEffect(() => {
    const first = firstValueBefore
      ?? (groups[0] ? `record:${recordSearchResultPath(groups[0].results[0])}` : undefined)
      ?? firstValueAfter
    if (first && selectedValue === `search:${searchPagePath({ q: trimmed })}`) setSelectedValue(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only new record results move the highlight
  }, [groups])

  const notice = recordSearch.failure ?? recordSearch.fallback
  return (
    <>
      {recordSearch.isSearching && !recordSearch.failure && (
        <p className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground" data-qqq-id="command-menu-searching">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Searching records…
        </p>
      )}
      {notice && (
        <p className="mx-3 my-1 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground" data-qqq-id="command-menu-search-status">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span className="min-w-0 break-words">
            <span className="font-medium text-foreground">{notice.title}</span>
            {notice.detail && <> — {notice.detail}</>}
          </span>
        </p>
      )}
      {groups.map((group) => (
        <Command.Group
          key={group.tableName}
          heading={heading(`${group.tableLabel} · ${tableCountLabel(group.results.length, group.summary)}`)}
          data-qqq-id={`command-group-records-${group.tableName}`}
        >
          {group.results.map((result) => {
            const path = recordSearchResultPath(result)
            return (
              <Command.Item
                key={path}
                value={`record:${path}`}
                onSelect={() => onSelect(path)}
                className={itemClassName}
                data-qqq-id={`command-record-${result.tableName}-${result.recordId}`}
              >
                <SearchOptionContent
                  option={{ id: path, kind: 'record', path, label: result.recordLabel, tableLabel: group.tableLabel, icon: group.icon, result }}
                  term={trimmed}
                />
              </Command.Item>
            )
          })}
          {tableHasMore(group.results.length, group.summary, PALETTE_RECORDS_PER_TABLE) && (
            <Command.Item
              value={`search:${searchPagePath({ q: trimmed, tables: [group.tableName] })}`}
              onSelect={() => onSelect(searchPagePath({ q: trimmed, tables: [group.tableName] }))}
              className={itemClassName}
              data-qqq-id={`command-more-${group.tableName}`}
            >
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1 truncate text-muted-foreground">See all matches in {group.tableLabel}</span>
            </Command.Item>
          )}
        </Command.Group>
      ))}
    </>
  )
}
