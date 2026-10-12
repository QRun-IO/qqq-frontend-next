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
 * @file SearchResultCard — one record on the search page: highlighted label, matched field
 * snippets, secondary values, last update, and quick actions (open, open in a new tab,
 * copy link).
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { ExternalLink, Link2 } from 'lucide-react'
import { toast } from 'sonner'

import type { QIcon } from '@/types'
import type { RecordSearchResult } from '@/lib/api/record-search'
import { recordSearchResultPath } from '@/lib/utils/record-search'
import { MetadataIcon } from '@/components/layout/MetadataIcon'
import { DateTimeText } from '@/components/ui/DateTimeText'
import { HighlightedText } from './HighlightedText'

/** Props for {@link SearchResultCard}. */
export interface SearchResultCardProps {
  /** The record. */
  result: RecordSearchResult
  /** Table label (shown when `showTable`). */
  tableLabel: string
  /** Table icon. */
  icon?: QIcon
  /** Search text (highlights labels and snippets without backend ranges). */
  term: string
  /** Show the table label (results of several tables mix). */
  showTable?: boolean
}

/**
 * Copies a record link to the clipboard and confirms with a toast.
 *
 * @param path - App path of the record.
 */
async function copyLink(path: string): Promise<void> {
  const url = new URL(path, window.location.origin).toString()
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Link copied')
  } catch {
    toast.error('Could not copy the link')
  }
}

/** Classes of a quick action button. */
const ACTION_CLASS = 'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Renders one record result as a list item.
 *
 * @param props - Component properties.
 * @returns An `<li>` with the record link and its quick actions.
 */
export function SearchResultCard({ result, tableLabel, icon, term, showTable = false }: SearchResultCardProps) {
  const path = recordSearchResultPath(result)
  const highlights = (result.highlights ?? []).filter((highlight) => highlight.text.trim()).slice(0, 3)
  const details = (result.details ?? []).filter((detail) => detail.displayValue.trim()).slice(0, 4)

  return (
    <li className="group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40 sm:px-6" data-qqq-id="search-result-card">
      <MetadataIcon icon={icon} kind="table" className="mt-0.5 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link
            href={path}
            prefetch={false}
            className="min-w-0 break-words font-medium text-foreground after:absolute after:inset-0 after:content-[''] hover:underline focus:outline-none focus-visible:underline"
            data-qqq-id="search-result-link"
          >
            <HighlightedText text={result.recordLabel} term={term} />
          </Link>
          {showTable && <span className="text-xs text-muted-foreground">{tableLabel}</span>}
        </div>
        {highlights.length > 0 && (
          <dl className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {highlights.map((highlight) => (
              <div key={highlight.fieldName} className="flex min-w-0 gap-1.5">
                {highlight.fieldLabel && <dt className="shrink-0 text-muted-foreground/80">{highlight.fieldLabel}:</dt>}
                <dd className="min-w-0 break-words">
                  <HighlightedText text={highlight.text} matches={highlight.matches.length > 0 ? highlight.matches : undefined} term={term} />
                </dd>
              </div>
            ))}
          </dl>
        )}
        {(details.length > 0 || result.updatedAt) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {details.map((detail) => (
              <span key={detail.fieldName} className="min-w-0 break-words">
                {detail.fieldLabel && <span className="text-muted-foreground/80">{detail.fieldLabel}: </span>}
                {detail.displayValue}
              </span>
            ))}
            {result.updatedAt && (
              <span className="inline-flex items-center gap-1">
                Updated <DateTimeText value={result.updatedAt} type="DATE_TIME" relative className="text-xs text-muted-foreground" />
              </span>
            )}
          </div>
        )}
      </div>
      {/* Quick actions sit above the stretched link */}
      <div className="relative z-10 flex shrink-0 items-center gap-0.5 sm:opacity-60 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION_CLASS}
          aria-label={`Open ${result.recordLabel} in a new tab`}
          title="Open in new tab"
          data-qqq-id="search-result-new-tab"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={() => void copyLink(path)}
          className={ACTION_CLASS}
          aria-label={`Copy link to ${result.recordLabel}`}
          title="Copy link"
          data-qqq-id="search-result-copy-link"
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}
