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
 * fields (the table's first-tier sections, as on the record view) as text, Yes/No and links,
 * the fields that matched the search, and quick actions (open, open in a new tab, copy link,
 * edit when permitted). Loaded on demand by the search page. File thumbnails and chips are
 * left to the record view: their modules measured +9.3 KB total JS here.
 */

'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ExternalLink, Link2, Loader2, Pencil, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

import type { QFieldMetaData, QIcon, QRecord, QTableMetaData } from '@/types'
import type { RecordSearchResult } from '@/lib/api/record-search'
import { getRecord } from '@/lib/api/tables'
import { loadTableMetaData } from '@/lib/api/metadata'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { findAdornment } from '@/lib/utils/adornment-utils'
import { cn } from '@/lib/utils/cn'
import { isEmail, isHttpUrl } from '@/lib/utils/string-utils'
import { recordSearchResultPath } from '@/lib/utils/record-search'
import { MetadataIcon } from '@/components/layout/MetadataIcon'
import { HighlightedText } from './HighlightedText'

/** Most fields shown in a preview. */
const MAX_PREVIEW_FIELDS = 10

/**
 * The fields a preview shows: the visible fields of the table's first-tier sections (as the
 * record view's T1 cards), else all visible fields; never heavy fields, the primary key, secrets,
 * widgets, code, HTML or binary data.
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
    .filter((field): field is QFieldMetaData => Boolean(field) && !field.isHidden && !field.isHeavy && field.name !== table.primaryKeyField && previewable(field))
    .slice(0, MAX_PREVIEW_FIELDS)
}

/** Adornments whose fields a glance does not show: secrets, embedded widgets, code and markup. */
const NOT_PREVIEWED = ['REVEAL', 'WIDGET', 'CODE_EDITOR', 'RENDER_HTML'] as const

/**
 * Whether a preview shows a field: never secrets (REVEAL), widgets, code, HTML or binary data.
 *
 * @param field - The field.
 * @returns True when the preview shows it.
 */
function previewable(field: QFieldMetaData): boolean {
  if (field.type === 'BLOB' || field.type === 'HTML') return false
  return !NOT_PREVIEWED.some((type) => findAdornment(field, type))
}

/** Link classes (taller touch targets on coarse pointers). */
const LINK_CLASS = 'text-primary hover:text-primary/80 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center'

/**
 * A field's value at a glance: Yes/No, email and web links, else the display value (which
 * QQQ formats for dates, possible values and files). Lighter than the record view's
 * FieldValue (no widgets), so the preview loads quickly.
 *
 * @param props - Component properties.
 * @param props.field - The field.
 * @param props.record - The record.
 * @param props.table - Its table.
 * @returns The value.
 */
function PreviewValue({ field, record, table }: { field: QFieldMetaData; record: QRecord; table: QTableMetaData }) {
  const rawValue = record.values[field.name]
  const displayValue = record.displayValues?.[field.name]
  const value = displayValue ?? rawValue
  const dataQqqId = `search-preview-value-${field.name}`

  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground" data-qqq-id={dataQqqId}>—</span>

  if (field.type === 'BOOLEAN') {
    const yes = rawValue === true || rawValue === 'true' || rawValue === 1
    return <span data-qqq-id={dataQqqId}>{yes ? 'Yes' : 'No'}</span>
  }
  const text = String(value)
  if (field.type === 'STRING' && isHttpUrl(text)) {
    return <a href={text} target="_blank" rel="noopener noreferrer" className={cn('break-all', LINK_CLASS)} data-qqq-id={dataQqqId}>{text}<span className="sr-only"> (opens in a new tab)</span></a>
  }
  if (field.type === 'STRING' && isEmail(text)) {
    return <a href={`mailto:${text}`} className={cn('break-all', LINK_CLASS)} data-qqq-id={dataQqqId}>{text}</a>
  }
  return <span className={cn('whitespace-pre-wrap', field.type === 'TEXT' && 'line-clamp-3')} data-qqq-id={dataQqqId}>{text}</span>
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
  // The queries of useTableMetaData and useRecord (same keys, so the caches are shared),
  // called directly: importing those hooks here re-bundles them into more screen chunks
  // (measured +12 KB total JS with Turbopack)
  const metadata = useQuery<QTableMetaData>({
    queryKey: queryKeys.tableMetadata(result.tableName),
    queryFn: () => loadTableMetaData(result.tableName),
    staleTime: 30 * 60_000, // as useTableMetaData
  })
  const recordQuery = useQuery({
    queryKey: [...queryKeys.tableRecord(result.tableName, result.recordId), { includeAssociations: false }],
    queryFn: () => getRecord(result.tableName, result.recordId, { includeAssociations: false }),
    enabled: Boolean(metadata.data) && !metadata.isError,
    staleTime: 60_000,
    meta: HANDLES_OWN_ERRORS,
  })
  const record = recordQuery.data
  const { isLoading, isError } = recordQuery
  const table = metadata.data
  const fields = table ? previewFields(table) : []
  // as canEditRecords: the edit permission and the TABLE_UPDATE capability
  const canEdit = Boolean(table?.editPermission) && Boolean(table?.capabilities?.includes('TABLE_UPDATE'))
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
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2" data-qqq-id="search-preview-fields">
          {fields.map((field) => (
            <div key={field.name} className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
              <dd className="min-w-0 break-words text-sm text-foreground">
                <PreviewValue field={field} record={record} table={table} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}
