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
 * @file DeveloperPanelView — renders one provider's developer panel (QRun-IO/qqq#1076) from its
 * generic blocks: key/values, text, code, table, links and process actions. No provider-specific
 * code: any module or qbit's panel renders the same way.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { AlertTriangle, ExternalLink, Info, Play } from 'lucide-react'

import type { DeveloperPanel, DeveloperPanelBlock, DeveloperPanelTone } from '@/lib/api/developer-panels'
import type { CodeLanguage } from '@/lib/utils/code-highlight'
import { cn } from '@/lib/utils/cn'
import { processRunHref } from '@/lib/utils/material-links'
import { CodeBlock } from '@/components/scripts/HighlightedCode'
import { CopyButton, DeveloperSection } from './DeveloperSection'

const CODE_LANGUAGES = new Set<CodeLanguage>(['javascript', 'java', 'python', 'json', 'sql', 'velocity', 'html', 'text'])

/**
 * A safe link target: app-relative paths and http(s) URLs only.
 * @param href - Target from the backend.
 * @returns The target, or null for anything else (e.g. `javascript:`).
 */
export function safeHref(href: string | undefined): string | null {
  if (!href) return null
  if (href.startsWith('/') && !href.startsWith('//')) return href
  try {
    const url = new URL(href)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * A link that uses client navigation for app paths and a new tab for other sites.
 * @param props - Target, label and styling.
 * @param props.href - Target.
 * @param props.external - Force a new tab.
 * @param props.children - Link content.
 * @param props.className - Extra classes.
 * @returns The link, or the content alone for an unsafe target.
 */
export function PanelLink({ href, external, children, className }: { href?: string; external?: boolean; children: React.ReactNode; className?: string }) {
  const target = safeHref(href)
  if (!target) return <>{children}</>
  if (target.startsWith('/') && !external) return <Link href={target} className={cn('text-primary hover:underline', className)}>{children}</Link>
  return (
    <a href={target} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1 text-primary hover:underline', className)}>
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

const TEXT_TONES: Record<DeveloperPanelTone, string> = {
  INFO: 'border-border bg-muted/50 text-foreground',
  SUCCESS: 'border-green-600/30 bg-green-600/5 text-foreground',
  WARNING: 'border-amber-500/40 bg-amber-500/10 text-foreground',
  ERROR: 'border-destructive/40 bg-destructive/10 text-destructive',
}

/** Props for {@link DeveloperPanelView}. */
export interface DeveloperPanelViewProps {
  panel: DeveloperPanel
  /** The record's table (default table for process actions). */
  tableName: string
  /** The record's primary key (selected record for process actions). */
  primaryKey: string | number
  /** Path to return to after a launched process (this page). */
  returnTo: string
}

/**
 * Renders a developer panel as a collapsible section.
 *
 * @param props - See {@link DeveloperPanelViewProps}.
 * @returns The panel section.
 */
export function DeveloperPanelView({ panel, tableName, primaryKey, returnTo }: DeveloperPanelViewProps) {
  return (
    <DeveloperSection
      id={`panel-${panel.id}`}
      title={panel.title}
      description={panel.description}
      badge={panel.error ? { label: 'Error', tone: 'ERROR' } : panel.statusLabel ? { label: panel.statusLabel, tone: panel.statusTone } : undefined}
    >
      {panel.error && (
        <p role="alert" className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', TEXT_TONES.ERROR)}>
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {panel.error}
        </p>
      )}
      {panel.blocks.map((block, index) => (
        <PanelBlock key={index} block={block} tableName={tableName} primaryKey={primaryKey} returnTo={returnTo} panelId={panel.id} index={index} />
      ))}
    </DeveloperSection>
  )
}

/**
 * Renders one block.
 *
 * @param props - The block and its context.
 * @returns The block's markup.
 */
function PanelBlock({ block, tableName, primaryKey, returnTo, panelId, index }: {
  block: DeveloperPanelBlock
  tableName: string
  primaryKey: string | number
  returnTo: string
  panelId: string
  index: number
}) {
  const qqqId = `dev-panel-${panelId}-block-${index}`
  const heading = block.label ? <h3 className="mb-2 text-sm font-semibold text-foreground">{block.label}</h3> : null

  switch (block.type) {
    case 'TEXT':
      return (
        <div className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', TEXT_TONES[block.tone ?? 'INFO'])} data-qqq-id={qqqId}>
          {block.tone === 'WARNING' || block.tone === 'ERROR'
            ? <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            : <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
          <div className="min-w-0 whitespace-pre-line break-words">{block.label ? <strong>{block.label}: </strong> : null}{block.text}</div>
        </div>
      )
    case 'KEY_VALUES':
      return (
        <div data-qqq-id={qqqId}>
          {heading}
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(8rem,max-content)_1fr]">
            {(block.items ?? []).map((item, itemIndex) => (
              <React.Fragment key={itemIndex}>
                <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{item.label}</dt>
                <dd className={cn('m-0 min-w-0 break-words text-sm text-foreground [overflow-wrap:anywhere]', item.monospace && 'font-mono text-xs')}>
                  {item.value == null || item.value === ''
                    ? <span className="italic text-muted-foreground">—</span>
                    : <PanelLink href={item.href}>{item.value}</PanelLink>}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )
    case 'CODE': {
      const language = CODE_LANGUAGES.has(block.language as CodeLanguage) ? block.language as CodeLanguage : 'text'
      const code = block.code ?? ''
      return (
        <div data-qqq-id={qqqId}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            {block.label ? <h3 className="m-0 text-sm font-semibold text-foreground">{block.label}</h3> : <span />}
            <CopyButton text={code} label={`Copy ${block.label ?? 'code'}`} />
          </div>
          <CodeBlock code={code} language={language} className="max-h-96" />
        </div>
      )
    }
    case 'TABLE':
      return (
        <div data-qqq-id={qqqId}>
          {heading}
          <PanelTable columns={block.columns ?? []} rows={block.rows ?? []} />
        </div>
      )
    case 'LINKS':
      return (
        <div data-qqq-id={qqqId}>
          {heading}
          <ul className="m-0 list-none space-y-1.5 p-0">
            {(block.links ?? []).map((link, linkIndex) => (
              <li key={linkIndex} className="text-sm">
                <PanelLink href={link.href} external={link.external}>{link.label}</PanelLink>
                {link.description && <span className="text-muted-foreground"> — {link.description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'ACTIONS':
      return (
        <div data-qqq-id={qqqId}>
          {heading}
          <div className="flex flex-wrap gap-2">
            {(block.actions ?? []).map((action, actionIndex) => (
              <Link
                key={actionIndex}
                href={processRunHref(action.processName, {
                  recordId: action.includeRecordId === false ? undefined : primaryKey,
                  returnTo,
                  tableName: action.tableName ?? tableName,
                })}
                title={action.description}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-qqq-id={`dev-panel-action-${action.processName}`}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      )
  }
}

/**
 * A responsive table: a real table from the small breakpoint up, stacked label/value cards on
 * phones (no sideways scrolling at 360px).
 *
 * @param props - Columns and rows of display strings.
 * @param props.columns - Column headings.
 * @param props.rows - Rows.
 * @returns The table.
 */
export function PanelTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-sm italic text-muted-foreground">None.</p>
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              {columns.map((column) => <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-foreground">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border align-top">
                {columns.map((column, columnIndex) => (
                  <td key={column} className="max-w-[28rem] break-words px-3 py-2 text-xs text-foreground [overflow-wrap:anywhere]">{row[columnIndex] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="m-0 list-none space-y-2 p-0 sm:hidden">
        {rows.map((row, rowIndex) => (
          <li key={rowIndex} className="rounded-lg border border-border p-3">
            <dl className="m-0 space-y-1">
              {columns.map((column, columnIndex) => (
                <div key={column} className="flex gap-2 text-xs">
                  <dt className="w-28 flex-shrink-0 font-medium text-muted-foreground">{column}</dt>
                  <dd className="m-0 min-w-0 break-words text-foreground [overflow-wrap:anywhere]">{row[columnIndex] ?? ''}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
