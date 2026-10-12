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
 * @file SearchOptionContent — the inside of one quick search entry: icon, highlighted label,
 * a secondary line (matched field snippet, secondary values, or where a page lives) and,
 * for records, when it was last updated. Shared by the header search, the `/` dialog and
 * the command palette.
 */

import React from 'react'
import { ArrowRight, History, Search } from 'lucide-react'

import type { RecordSearchResult } from '@/lib/api/record-search'
import type { QuickSearchOption } from '@/lib/search/search-model'
import { MetadataIcon, type MetadataIconKind } from '@/components/layout/MetadataIcon'
import { DateTimeText } from '@/components/ui/DateTimeText'
import { HighlightedText } from './HighlightedText'

/** Fallback icon kind for each app-tree node type. */
const ICON_KIND: Record<string, MetadataIconKind> = { APP: 'app', TABLE: 'table', PROCESS: 'process', REPORT: 'report' }

/** Type shown for each app-tree node type. */
const TYPE_LABEL: Record<string, string> = { APP: 'App', TABLE: 'Table', PROCESS: 'Process', REPORT: 'Report' }

/**
 * The secondary line of a record result: its first matched field as a snippet, else its
 * secondary values.
 *
 * @param props - Component properties.
 * @param props.result - The record search result.
 * @param props.term - Search text.
 * @returns The line, or `null` when the result has neither.
 */
export function RecordSnippet({ result, term }: { result: RecordSearchResult; term: string }) {
  const highlight = result.highlights?.find((candidate) => candidate.text.trim())
  if (highlight) {
    return (
      <>
        {highlight.fieldLabel && <span className="text-muted-foreground/80">{highlight.fieldLabel}: </span>}
        <HighlightedText text={highlight.text} matches={highlight.matches.length > 0 ? highlight.matches : undefined} term={term} />
      </>
    )
  }
  const details = result.details?.filter((detail) => detail.displayValue.trim()).slice(0, 3)
  if (details && details.length > 0) {
    return <>{details.map((detail) => detail.displayValue).join(' · ')}</>
  }
  return null
}

/** Props for {@link SearchOptionContent}. */
export interface SearchOptionContentProps {
  /** The entry. */
  option: QuickSearchOption
  /** Search text (for highlighting). */
  term: string
  /** Show the table label beside a record (where records of several tables mix, e.g. "Top hits"). */
  showTable?: boolean
}

/**
 * Renders one quick search entry's content (the caller supplies the interactive element).
 *
 * @param props - Component properties.
 * @returns Icon, label and secondary content.
 */
export function SearchOptionContent({ option, term, showTable = false }: SearchOptionContentProps) {
  if (option.kind === 'query') {
    const Icon = option.completion ? Search : History
    return (
      <>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {option.completion && option.term.toLowerCase().startsWith(term.trim().toLowerCase())
            ? <>{option.term.slice(0, term.trim().length)}<span className="font-semibold">{option.term.slice(term.trim().length)}</span></>
            : option.term}
        </span>
      </>
    )
  }
  if (option.kind === 'more') {
    return (
      <>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          See all {option.count ? `${option.count} ` : ''}matches in {option.tableLabel}
        </span>
      </>
    )
  }
  if (option.kind === 'all') {
    return (
      <>
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          Search everything for <span className="font-medium">&ldquo;{option.term}&rdquo;</span>
        </span>
      </>
    )
  }

  let icon: React.ReactNode
  let secondary: React.ReactNode = null
  let aside: React.ReactNode = null
  if (option.kind === 'page') {
    icon = <MetadataIcon icon={option.icon} kind={option.nodeType ? ICON_KIND[option.nodeType] : 'app'} className="text-muted-foreground" />
    const type = option.nodeType ? TYPE_LABEL[option.nodeType] : undefined
    secondary = [type, option.context].filter(Boolean).join(' · ') || null
  } else if (option.kind === 'recent') {
    icon = <MetadataIcon icon={option.icon} kind="table" className="text-muted-foreground" />
    secondary = option.tableLabel
  } else {
    icon = <MetadataIcon icon={option.icon} kind="table" className="text-muted-foreground" />
    secondary = <RecordSnippet result={option.result} term={term} />
    aside = (
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-muted-foreground">
        {showTable && <span className="max-w-[9rem] truncate">{option.tableLabel}</span>}
        {option.result.updatedAt && <DateTimeText value={option.result.updatedAt} type="DATE_TIME" relative className="text-xs text-muted-foreground" />}
      </span>
    )
  }

  return (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          <HighlightedText text={option.label} term={term} />
        </span>
        {secondary && <span className="block truncate text-xs text-muted-foreground">{secondary}</span>}
      </span>
      {aside}
    </>
  )
}
