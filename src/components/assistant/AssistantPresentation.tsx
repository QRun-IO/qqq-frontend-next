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

/** @file Structured assistant answers, with safe navigation and markdown fallback. */
'use client'

import React, { lazy, Suspense } from 'react'
import Link from 'next/link'

import type { AssistantPresentationBlock, AssistantPresentationPart, AssistantPresentationTable } from '@/types/assistant'
import { internalAppHref } from '@/lib/utils/assistant-links'
import { AssistantMarkdown } from './AssistantMarkdown'

const Chart = lazy(() => import('./AssistantPresentationChart').then((module) => ({ default: module.AssistantPresentationChart })))
const LINK = 'rounded text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const CHIP = 'inline-flex max-w-full items-center rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

/** Send behavior shared with the composer; unavailable or busy actions are disabled. */
export interface AssistantPresentationActions {
  onSend?: (prompt: string) => void
  sending?: boolean
}

/**
 * Checks known kinds before narrowing the forward-compatible wire union.
 * @param block - A server block.
 * @returns Whether this version can render nonempty content.
 */
function isRenderable(block: AssistantPresentationPart['blocks'][number]): block is AssistantPresentationBlock {
  switch (block.kind) {
    case 'metrics': case 'filterLinks': case 'recordLinks': case 'actions':
      return Array.isArray(block.items) && block.items.length > 0
    case 'table':
      return Array.isArray(block.columns) && block.columns.length > 0 && Array.isArray(block.rows)
    case 'chart':
      return ['bar', 'pie', 'line'].includes(String(block.chartType)) && Array.isArray(block.points) && block.points.length > 0
    default:
      return false
  }
}

/**
 * Applies the same href policy as assistant markdown to every presentation link.
 * @param props - Destination, content and styling.
 * @returns An internal Next link or plain text.
 */
export function PresentationLink({ href, children, className = LINK }: { href?: string; children: React.ReactNode; className?: string }) {
  const safe = internalAppHref(href)
  return safe
    ? <Link href={safe} className={className} data-qqq-id="assistant-presentation-link">{children}</Link>
    : <span>{children}</span>
}

/**
 * Keeps up to three columns within the panel, wrapping even unbroken cell values.
 * @param props - Table payload.
 * @returns A semantic table; only wider tables get a scroll region.
 */
function PresentationTable({ block }: { block: AssistantPresentationTable }) {
  const wide = block.columns.length > 3
  const alignments = block.columns.map((column) => column.align ?? (
    block.rows.some((row) => typeof row.cells[column.key] === 'number') ? 'right' : 'left'
  ))
  return (
    <div className={wide ? 'overflow-x-auto focus-visible:ring-2 focus-visible:ring-ring' : 'min-w-0'} role={wide ? 'region' : undefined} tabIndex={wide ? 0 : undefined} aria-label={wide ? block.title ?? 'Results table' : undefined}>
      <table className={`w-full border-collapse text-sm ${wide ? '' : 'table-fixed'}`}>
        <caption className="mb-2 text-left font-medium">{block.title ?? 'Results'}</caption>
        <thead className="bg-muted">
          <tr>{block.columns.map((column, index) => <th key={column.key} scope="col" style={{ textAlign: alignments[index] }} className="border border-border px-2 py-1.5 [overflow-wrap:anywhere]">{column.label}</th>)}</tr>
        </thead>
        <tbody>{block.rows.map((row, index) => (
          <tr key={index}>{block.columns.map((column, cellIndex) => {
            const value = row.display?.[column.key] ?? String(row.cells[column.key] ?? '—')
            return <td key={column.key} style={{ textAlign: alignments[cellIndex] }} className="border border-border px-2 py-1.5 align-top tabular-nums [overflow-wrap:anywhere]">{cellIndex === 0 ? <PresentationLink href={row.href}>{value}</PresentationLink> : value}</td>
          })}</tr>
        ))}</tbody>
      </table>
    </div>
  )
}

/**
 * Renders one known block, using the existing panel send path for follow-up prompts.
 * @param props - Block and send behavior.
 * @returns Block content.
 */
function BlockView({ block, onSend, sending }: { block: AssistantPresentationBlock } & AssistantPresentationActions) {
  switch (block.kind) {
    case 'metrics':
      return <dl className="flex flex-wrap gap-2">{block.items.map((item, index) => (
        <div key={index} className="min-w-0 max-w-full flex-auto rounded-lg border border-border bg-muted/40 p-3 [overflow-wrap:anywhere]">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums"><PresentationLink href={item.href}>{item.display ?? item.value}</PresentationLink></dd>
        </div>
      ))}</dl>
    case 'table':
      return <PresentationTable block={block} />
    case 'chart':
      return <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading chart…</p>}><Chart block={block} /></Suspense>
    case 'filterLinks': case 'recordLinks':
      return <ul aria-label={block.kind === 'filterLinks' ? 'Filtered lists' : 'Records'} className="flex flex-wrap gap-2">{block.items.map((item, index) => <li key={index} className="min-w-0 max-w-full [overflow-wrap:anywhere]"><PresentationLink href={item.href} className={CHIP}>{item.label}</PresentationLink></li>)}</ul>
    case 'actions':
      return <div className="flex flex-wrap gap-2">{block.items.map((item, index) => item.prompt !== undefined ? (
        <button key={index} type="button" disabled={!onSend || sending} onClick={() => onSend?.(item.prompt)} className={`${CHIP} [overflow-wrap:anywhere]`} data-qqq-id="assistant-presentation-action">{item.label}</button>
      ) : <PresentationLink key={index} href={item.href} className={CHIP}>{item.label}</PresentationLink>)}</div>
  }
}

/**
 * Shows the direct answer first and preserves server block order.
 * @param props - Presentation and composer callback.
 * @returns The answer or its whole-part markdown fallback.
 */
export function AssistantPresentation({ part, onSend, sending }: { part: AssistantPresentationPart } & AssistantPresentationActions) {
  const blocks = part.blocks.filter(isRenderable)
  if (!blocks.length) return <AssistantMarkdown text={part.markdown || part.summary} />
  return (
    <div className="min-w-0 space-y-3 text-foreground [overflow-wrap:anywhere]" data-qqq-id="assistant-presentation">
      <p className="text-base font-semibold leading-snug" data-qqq-id="assistant-presentation-summary">{part.summary}</p>
      {blocks.map((block, index) => <div key={index} className="min-w-0" data-qqq-id={`assistant-presentation-${block.kind}`}><BlockView block={block} onSend={onSend} sending={sending} /></div>)}
    </div>
  )
}
