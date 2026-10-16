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
 * @file AssistantRenders — structured tool-result renders (records table, record, count,
 * history, widget) and record chips. Everything comes from server payloads, never from
 * model-written HTML; links pass the same-origin `/app` check.
 */

'use client'

import React, { Suspense, lazy } from 'react'
import Link from 'next/link'
import { ArrowRight, Table2 } from 'lucide-react'

import type {
  AssistantCountRender,
  AssistantHistoryRender,
  AssistantRecordRef,
  AssistantRecordRender,
  AssistantRecordsRender,
  AssistantRender,
  AssistantWidgetRender,
} from '@/types/assistant'
import { internalAppHref } from '@/lib/utils/assistant-links'
import { formatDateTime } from '@/lib/utils/datetime-utils'
import { RecordHoverCard } from '@/components/records/RecordHoverCard'

const PendingActionCard = lazy(() => import('./AssistantPendingActionCard'))
const WidgetRenderer = lazy(() => import('@/components/widgets/WidgetRenderer').then((m) => ({ default: m.WidgetRenderer })))

/** Widget types the panel renders inline (charts and statistics); others link to their screen. */
const INLINE_WIDGET_TYPES = new Set([
  'barChart', 'horizontalBarChart', 'stackedBarChart', 'lineChart', 'smallLineChart', 'pieChart', 'chart', 'statistics', 'multiStatistics',
])

/** Classes of a link styled as a small action. */
const ACTION_LINK = 'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded pointer-coarse:min-h-11'

/**
 * A same-origin link, or plain text when the href fails the check.
 *
 * @param props - Component properties.
 * @param props.href - The server-built href.
 * @param props.children - Link content.
 * @param props.className - Classes.
 * @param props.qqqId - The `data-qqq-id`.
 * @returns The link or a span.
 */
function SafeLink({ href, children, className, qqqId }: { href: string | undefined; children: React.ReactNode; className?: string; qqqId?: string }) {
  const internal = internalAppHref(href)
  if (!internal) return <span className={className} data-qqq-id={qqqId}>{children}</span>
  return <Link href={internal} className={className} data-qqq-id={qqqId}>{children}</Link>
}

/**
 * Record references as chips that open the record; hovering previews it.
 *
 * @param props - Component properties.
 * @param props.refs - The references.
 * @returns The chip list.
 */
export function RecordChips({ refs }: { refs: AssistantRecordRef[] }) {
  if (!refs.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Records" data-qqq-id="assistant-record-refs">
      {refs.map((ref) => {
        const href = internalAppHref(ref.href)
        const chip = (
          <span className="inline-flex max-w-full items-center gap-1.5 truncate">
            <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{ref.label || `${ref.tableLabel} #${ref.id}`}</span>
            <span className="sr-only">, {ref.tableLabel}</span>
          </span>
        )
        const chipClass = 'inline-flex max-w-full items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground pointer-coarse:min-h-11'
        return (
          <li key={`${ref.tableName}:${ref.id}`} className="max-w-full">
            {href ? (
              <RecordHoverCard tableName={ref.tableName} primaryKey={ref.id} tableMetaData={{ label: ref.tableLabel }}>
                <Link href={href} className={`${chipClass} hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`} data-qqq-id="assistant-record-chip">
                  {chip}
                </Link>
              </RecordHoverCard>
            ) : (
              <span className={chipClass} data-qqq-id="assistant-record-chip">{chip}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Query results: a table where the panel is wide enough, cards where it is narrow.
 *
 * @param props - Component properties.
 * @param props.render - The records payload.
 * @returns The records view.
 */
function RecordsView({ render }: { render: AssistantRecordsRender }) {
  // Older servers omit empty lists (a query that matched nothing): treat as [].
  const rows = Array.isArray(render.rows) ? render.rows : []
  const columns = Array.isArray(render.columns) ? render.columns : []
  const shown = rows.length
  const total = render.totalCount ?? shown
  const caption = `${render.tableLabel}: ${shown === total ? `${total} ${total === 1 ? 'row' : 'rows'}` : `${shown} of ${total} rows`}`
  const [firstColumn, ...otherColumns] = columns
  if (shown === 0) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2" data-qqq-id="assistant-records">
        <span className="truncate text-xs text-muted-foreground">{render.tableLabel}: no rows match</span>
        <SafeLink href={render.openHref} className={ACTION_LINK} qqqId="assistant-open-query">
          Open in Query screen<ArrowRight className="h-3 w-3" aria-hidden="true" />
        </SafeLink>
      </div>
    )
  }
  return (
    <div className="@container rounded-lg border border-border bg-card" data-qqq-id="assistant-records">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="truncate text-xs font-medium text-foreground">{caption}</span>
        <SafeLink href={render.openHref} className={ACTION_LINK} qqqId="assistant-open-query">
          Open in Query screen<ArrowRight className="h-3 w-3" aria-hidden="true" />
        </SafeLink>
      </div>
      {/* wide: a table (scrolls sideways inside its own box when it has many columns) */}
      <div className="hidden overflow-x-auto @lg:block" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {columns.map((column) => <th key={column.name} scope="col" className="whitespace-nowrap px-3 py-1.5 font-medium">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-b border-border last:border-0">
                {columns.map((column, index) => (
                  <td key={column.name} className="max-w-[16rem] truncate px-3 py-1.5 text-foreground">
                    {index === 0 ? (
                      <SafeLink href={row.href} className="font-medium text-primary hover:underline">{row.values?.[column.name] ?? String(row.id)}</SafeLink>
                    ) : (row.values?.[column.name] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* narrow: one card per row */}
      <ul className="divide-y divide-border @lg:hidden">
        {rows.map((row) => (
          <li key={String(row.id)} className="px-3 py-2">
            {firstColumn && (
              <SafeLink href={row.href} className="block truncate text-sm font-medium text-primary hover:underline">
                {row.values?.[firstColumn.name] ?? String(row.id)}
              </SafeLink>
            )}
            <dl className="mt-1 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
              {otherColumns.slice(0, 4).map((column) => (
                <React.Fragment key={column.name}>
                  <dt className="truncate text-muted-foreground">{column.label}</dt>
                  <dd className="truncate text-foreground">{row.values?.[column.name] ?? ''}</dd>
                </React.Fragment>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {render.truncated && <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">More rows match; open the query screen to see them all.</p>}
    </div>
  )
}

/**
 * One record's fields.
 *
 * @param props - Component properties.
 * @param props.render - The record payload.
 * @returns The record card.
 */
function RecordView({ render }: { render: AssistantRecordRender }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2" data-qqq-id="assistant-record">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{render.tableLabel} #{render.id}</span>
        <SafeLink href={render.href} className={ACTION_LINK}>Open<ArrowRight className="h-3 w-3" aria-hidden="true" /></SafeLink>
      </div>
      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
        {(render.fields ?? []).map((field) => (
          <React.Fragment key={field.name}>
            <dt className="truncate text-muted-foreground">{field.label}</dt>
            <dd className="break-words text-foreground">{field.value ?? '—'}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  )
}

/**
 * A record count.
 *
 * @param props - Component properties.
 * @param props.render - The count payload.
 * @returns The count card.
 */
function CountView({ render }: { render: AssistantCountRender }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2" data-qqq-id="assistant-count">
      <div className="min-w-0">
        <p className="text-xl font-semibold tabular-nums text-foreground">{render.count.toLocaleString()}</p>
        <p className="truncate text-xs text-muted-foreground">{render.tableLabel}</p>
      </div>
      <SafeLink href={render.openHref} className={ACTION_LINK} qqqId="assistant-open-query">
        Open in Query screen<ArrowRight className="h-3 w-3" aria-hidden="true" />
      </SafeLink>
    </div>
  )
}

/**
 * A record's change history.
 *
 * @param props - Component properties.
 * @param props.render - The history payload.
 * @returns The history list.
 */
function HistoryView({ render }: { render: AssistantHistoryRender }) {
  if (!render.entries?.length) return <p className="text-xs text-muted-foreground">No changes recorded.</p>
  return (
    <ol className="space-y-2 rounded-lg border border-border bg-card px-3 py-2" data-qqq-id="assistant-history">
      {render.entries.map((entry, index) => (
        <li key={index} className="text-xs">
          <p className="text-muted-foreground">{formatTimestamp(entry.timestamp)} · {entry.user}</p>
          <p className="text-foreground">{entry.message}</p>
          {(entry.details?.length ?? 0) > 0 && (
            <ul className="mt-0.5 space-y-0.5 pl-3">
              {(entry.details ?? []).map((detail, detailIndex) => (
                <li key={detailIndex} className="break-words text-muted-foreground">
                  <span className="font-medium text-foreground">{detail.field}</span>: {detail.oldValue ?? '—'} {'→'} {detail.newValue ?? '—'}{detail.truncated ? ' …' : ''}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

/**
 * Formats an ISO timestamp for display, keeping unparseable values as they are.
 *
 * @param value - The timestamp.
 * @returns The formatted date and time.
 */
function formatTimestamp(value: string): string {
  try {
    return formatDateTime(value) || value
  } catch {
    return value
  }
}

/**
 * A widget payload rendered by the dashboard's own chart and statistics widgets.
 *
 * @param props - Component properties.
 * @param props.render - The widget payload.
 * @returns The widget, or its label when the type is not rendered inline.
 */
function WidgetView({ render }: { render: AssistantWidgetRender }) {
  if (!INLINE_WIDGET_TYPES.has(render.widgetType)) {
    return <p className="text-xs text-muted-foreground">{render.label}: this widget type is shown on its dashboard only.</p>
  }
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-2" data-qqq-id="assistant-widget">
      <p className="mb-1 truncate text-xs font-medium text-foreground">{render.label}</p>
      <Suspense fallback={<div className="h-40 rounded bg-muted motion-safe:animate-pulse" />}>
        <WidgetRenderer widgetMetaData={{ name: render.widgetName, label: render.label, type: render.widgetType, hasPermission: true }} data={render.data} />
      </Suspense>
    </div>
  )
}

/**
 * Renders a tool result payload.
 *
 * @param props - Component properties.
 * @param props.render - The payload.
 * @returns The matching view, or null for an unknown type.
 */
export function AssistantRenderView({ render }: { render: AssistantRender }) {
  switch (render.type) {
    case 'records':
      return <RecordsView render={render} />
    case 'record':
      return <RecordView render={render} />
    case 'count':
      return <CountView render={render} />
    case 'history':
      return <HistoryView render={render} />
    case 'widget':
      return <WidgetView render={render} />
    case 'pending_action':
      return (
        <Suspense fallback={<div className="h-24 rounded-lg bg-muted motion-safe:animate-pulse" />}>
          <PendingActionCard render={render} />
        </Suspense>
      )
    default:
      return null
  }
}
