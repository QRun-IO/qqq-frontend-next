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
 * @file RecordPreview — a search result's record without leaving the results: its key
 * fields (the table's first-tier sections, as on the record view), file thumbnails, the
 * fields that matched the search, and quick actions (open, open in a new tab, copy link,
 * edit when permitted). Loaded on demand by the search page.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { ExternalLink, Link2, Loader2, Pencil, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

import type { QFieldMetaData, QIcon, QTableMetaData } from '@/types'
import type { RecordSearchResult } from '@/lib/api/record-search'
import { useRecord } from '@/lib/hooks/use-record'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { canEditRecords } from '@/lib/auth/permissions'
import { recordSearchResultPath } from '@/lib/utils/record-search'
import { MetadataIcon } from '@/components/layout/MetadataIcon'
import { FieldValue } from '@/components/records/FieldValue'
import { HighlightedText } from './HighlightedText'

/** Most fields shown in a preview. */
const MAX_PREVIEW_FIELDS = 10

/**
 * The fields a preview shows: the visible fields of the table's first-tier sections (as the
 * record view's T1 cards), else all visible fields; never heavy fields or the primary key.
 *
 * @param table - Full table metadata.
 * @returns Up to {@link MAX_PREVIEW_FIELDS} fields.
 */
export function previewFields(table: QTableMetaData): QFieldMetaData[] {
  const fields = table.fields ?? {}
  const t1 = (table.sections ?? []).filter((section) => !section.isHidden && (!section.tier || section.tier === 'T1' || section.tier === 'basic'))
  const names = t1.length > 0 ? t1.flatMap((section) => section.fieldNames ?? []) : Object.keys(fields)
  return [...new Set(names)]
    .map((name) => fields[name])
    .filter((field): field is QFieldMetaData => Boolean(field) && !field.isHidden && !field.isHeavy && field.name !== table.primaryKeyField)
    .slice(0, MAX_PREVIEW_FIELDS)
}

/** Props for {@link RecordPreview}. */
export interface RecordPreviewProps {
  /** The search result to preview. */
  result: RecordSearchResult
  /** Table label. */
  tableLabel: string
  /** Table icon. */
  icon?: QIcon
  /** Search text (highlights the label and matched fields). */
  term: string
  /** Heading level of the record label (2 in the split view, 2 in the sheet). */
  headingId?: string
}

/** Classes of a quick action. */
const ACTION_CLASS = 'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11'

/**
 * Renders a record preview: header, quick actions, matched fields and key fields.
 *
 * @param props - Component properties.
 * @returns The preview.
 */
export function RecordPreview({ result, tableLabel, icon, term, headingId }: RecordPreviewProps) {
  const path = recordSearchResultPath(result)
  const metadata = useTableMetaData(result.tableName)
  const { record, isLoading, isError } = useRecord({
    tableName: result.tableName,
    primaryKey: result.recordId,
    enabled: Boolean(metadata.data) && !metadata.isError,
    includeAssociations: false,
    staleTime: 60_000,
  })
  const table = metadata.data
  const fields = table ? previewFields(table) : []
  const canEdit = canEditRecords(table)
  const highlights = (result.highlights ?? []).filter((highlight) => highlight.text.trim())

  /** Copies the record's link. */
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString())
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <article className="space-y-4" aria-labelledby={headingId} data-qqq-id="search-record-preview">
      <header className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <MetadataIcon icon={icon} kind="table" className="h-5 w-5 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="break-words text-lg font-semibold leading-tight text-foreground">
            <HighlightedText text={record?.recordLabel || result.recordLabel} term={term} />
          </h2>
          <p className="text-sm text-muted-foreground">{tableLabel} · #{result.recordId}</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" data-qqq-id="search-preview-actions">
        <Link href={path} prefetch={false} className={`${ACTION_CLASS} border-primary bg-primary text-primary-foreground hover:bg-primary/90`} data-qqq-id="search-preview-open">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          Open
        </Link>
        <a href={path} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS} data-qqq-id="search-preview-new-tab">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          New tab
        </a>
        <button type="button" onClick={() => void copyLink()} className={ACTION_CLASS} data-qqq-id="search-preview-copy-link">
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Copy link
        </button>
        {canEdit && (
          <Link href={`${path}/edit`} prefetch={false} className={ACTION_CLASS} data-qqq-id="search-preview-edit">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        )}
      </div>

      {highlights.length > 0 && (
        <section aria-label="Why it matched" className="rounded-lg bg-muted/50 px-3 py-2">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Matched</h3>
          <dl className="space-y-0.5 text-sm">
            {highlights.map((highlight) => (
              <div key={highlight.fieldName} className="flex min-w-0 gap-1.5">
                <dt className="shrink-0 text-muted-foreground">{highlight.fieldLabel ?? highlight.fieldName}:</dt>
                <dd className="min-w-0 break-words text-foreground">
                  <HighlightedText text={highlight.text} matches={highlight.matches.length > 0 ? highlight.matches : undefined} term={term} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {metadata.isError || isError ? (
        <p role="alert" className="text-sm text-muted-foreground" data-qqq-id="search-preview-error">
          The record&rsquo;s details could not be loaded. Open it to see why.
        </p>
      ) : !table || isLoading || !record ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading details…
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2" data-qqq-id="search-preview-fields">
          {fields.map((field) => (
            <div key={field.name} className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
              <dd className="min-w-0 break-words text-sm text-foreground">
                <FieldValue field={field} record={record} tableMetaData={table} thumbnailSize={96} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}
