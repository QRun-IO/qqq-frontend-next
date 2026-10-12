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

import React, { useRef } from 'react'
import Link from 'next/link'
import { Eye, ExternalLink, Link2 } from 'lucide-react'
import { toast } from 'sonner'

import type { QIcon } from '@/types'
import type { RecordSearchResult } from '@/lib/api/record-search'
import { recordSearchResultPath } from '@/lib/utils/record-search'
import { cn } from '@/lib/utils/cn'
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
  /** Whether this result is the one previewed. */
  active?: boolean
  /** Makes this result the previewed one (pointer over it, or keyboard focus on it). */
  onActivate?: () => void
  /** Opens the preview (its button, or a long press on touch screens). */
  onPreview?: () => void
  /** Relevance relative to the best result shown, 0..1, when the provider sent scores. */
  relevance?: number
}

/** Long-press duration that opens the preview on touch screens. */
const LONG_PRESS_MS = 500

/**
 * A three-step relevance meter.
 *
 * @param props - Component properties.
 * @param props.value - Relevance, 0..1.
 * @returns The meter.
 */
function RelevanceMeter({ value }: { value: number }) {
  const steps = value >= 0.75 ? 3 : value >= 0.4 ? 2 : 1
  const label = steps === 3 ? 'Strong match' : steps === 2 ? 'Good match' : 'Partial match'
  return (
    <span className="inline-flex items-center gap-1" title={`${label} (${Math.round(value * 100)}% of the best result)`} data-qqq-id="search-result-relevance">
      <span className="flex items-end gap-px" aria-hidden="true">
        {[1, 2, 3].map((step) => (
          <span key={step} className={cn('w-1 rounded-sm', step === 1 ? 'h-1.5' : step === 2 ? 'h-2' : 'h-2.5', step <= steps ? 'bg-primary' : 'bg-muted-foreground/30')} />
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
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
export function SearchResultCard({ result, tableLabel, icon, term, showTable = false, active = false, onActivate, onPreview, relevance }: SearchResultCardProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  /** Cancels a pending long press. */
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = null
  }
  const path = recordSearchResultPath(result)
  const highlights = (result.highlights ?? []).filter((highlight) => highlight.text.trim()).slice(0, 3)
  const details = (result.details ?? []).filter((detail) => detail.displayValue.trim()).slice(0, 4)

  return (
    <li
      className={cn('group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40 sm:px-6', active && 'bg-accent/60 shadow-[inset_3px_0_0_var(--color-primary)]')}
      data-qqq-id="search-result-card"
      data-active={active || undefined}
      onMouseEnter={onActivate}
      onPointerDown={(event) => {
        if (event.pointerType !== 'touch' || !onPreview) return
        longPressed.current = false
        cancelPress()
        pressTimer.current = setTimeout(() => {
          longPressed.current = true
          onPreview()
        }, LONG_PRESS_MS)
      }}
      onPointerUp={cancelPress}
      onPointerMove={(event) => { if (event.pointerType === 'touch' && (Math.abs(event.movementX) > 4 || Math.abs(event.movementY) > 4)) cancelPress() }}
      onPointerCancel={cancelPress}
      onClickCapture={(event) => {
        // a long press opened the preview: do not also follow the link
        if (longPressed.current) {
          event.preventDefault()
          event.stopPropagation()
          longPressed.current = false
        }
      }}
      onContextMenu={(event) => { if (longPressed.current) event.preventDefault() }}
    >
      <MetadataIcon icon={icon} kind="table" className="mt-0.5 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link
            href={path}
            prefetch={false}
            className="min-w-0 break-words font-medium text-foreground after:absolute after:inset-0 after:content-[''] hover:underline focus:outline-none focus-visible:underline"
            data-qqq-id="search-result-link"
            data-result-key={`${result.tableName}:${result.recordId}`}
            onFocus={onActivate}
          >
            <HighlightedText text={result.recordLabel} term={term} />
          </Link>
          {showTable && <span className="text-xs text-muted-foreground">{tableLabel}</span>}
          {relevance !== undefined && <RelevanceMeter value={relevance} />}
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
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className={ACTION_CLASS}
            aria-label={`Preview ${result.recordLabel}`}
            aria-pressed={active}
            title="Preview"
            data-qqq-id="search-result-preview"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
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
