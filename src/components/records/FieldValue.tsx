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
 * @file FieldValue — renders a single field value from metadata: adornments first
 * (LINK, REVEAL, RENDER_HTML, CHIP, CODE_EDITOR, ERROR, FILE_DOWNLOAD, WIDGET,
 * TOOLTIP), then type-specific formatting.
 */

'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, Copy, Download, ExternalLink, Eye, EyeOff } from 'lucide-react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { sanitizeHtml } from '@/lib/utils/sanitize-html'

import type { QFieldMetaData, QTableMetaData, QRecord, QWidgetMetaData } from '@/types'
import { useFocusSafeTooltip } from '@/lib/hooks/use-focus-safe-tooltip'
import { cn } from '@/lib/utils/cn'
import { isHttpUrl, isEmail } from '@/lib/utils/string-utils'
import { formatDateTime } from '@/lib/utils/datetime-utils'
import {
  attachmentUrl, chipStyle, CHIP_COLOR_CLASSES, fileDownload, findAdornment, linkTarget, tooltipText,
} from '@/lib/utils/adornment-utils'
import { WidgetRenderer } from '@/components/widgets/WidgetRenderer'
import { RecordHoverCard } from './RecordHoverCard'

/**
 * Link values are the only control in their row, so on a touch screen they take a 44 px tall
 * target (WCAG 2.5.5); mouse layouts keep the text-sized link.
 */
const TOUCH_LINK = 'pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center'

/**
 * Props for the {@link FieldValue} component.
 */
interface FieldValueProps {
  /** Field metadata that drives the rendering strategy (type and adornments). */
  field: QFieldMetaData
  /** The record containing the raw value and optional pre-formatted display value. */
  record: QRecord
  /** Full table metadata map, used for record links and their hover previews. */
  allTables?: Record<string, QTableMetaData>
  /** Navigation context appended to outgoing record links so the target can link back. */
  navigateFrom?: { path: string; label: string }
  /** Widget metadata, for WIDGET-adorned fields. */
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  /** Full metadata of the record's table (primary key and label for file names). */
  tableMetaData?: QTableMetaData
  /** Additional CSS classes applied to the root element. */
  className?: string
}

/**
 * Renders a single QQQ field value, driven entirely by field metadata.
 *
 * Adornments are applied in the order the QQQ dashboards use (one per value), and
 * a TOOLTIP adornment wraps whatever is rendered. Without an adornment, the value
 * is formatted by type: DATE_TIME in the viewer's time zone (unless the backend
 * supplied a zoned display value), BOOLEAN as Yes/No, TEXT with line breaks, HTML
 * sanitized, and everything else as the backend display value. Empty values render
 * an em dash.
 *
 * @param props - See {@link FieldValueProps}.
 * @returns The rendered value.
 */
export function FieldValue({ field, record, allTables, navigateFrom, widgetMetaDataMap, tableMetaData, className }: FieldValueProps) {
  const content = <FieldValueContent field={field} record={record} allTables={allTables}
    navigateFrom={navigateFrom} widgetMetaDataMap={widgetMetaDataMap} tableMetaData={tableMetaData} className={className} />
  const tooltip = tooltipText(field, record)
  const tooltipState = useFocusSafeTooltip()
  if (!tooltip) return content
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root open={tooltipState.open} onOpenChange={tooltipState.onOpenChange}>
        <TooltipPrimitive.Trigger asChild onFocus={tooltipState.onFocus} onBlur={tooltipState.onBlur} onKeyDown={tooltipState.onKeyDown}
          onPointerDown={tooltipState.onPointerDown} onClick={tooltipState.onClick}>
          <span tabIndex={0} className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-4"
            data-qqq-id={`field-value-tooltip-trigger-${field.name}`}>
            {content}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content side="top" sideOffset={4} data-qqq-id={`field-value-tooltip-${field.name}`}
            className="z-50 max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-md">
            {tooltip}
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

/**
 * The value itself, without the TOOLTIP wrapper.
 *
 * @param props - See {@link FieldValueProps}.
 * @returns The rendered value.
 */
function FieldValueContent({ field, record, allTables, navigateFrom, widgetMetaDataMap, tableMetaData, className }: FieldValueProps) {
  const rawValue = record.values[field.name]
  const displayValue = record.displayValues?.[field.name]
  const value = displayValue ?? rawValue
  const dataQqqId = `field-value-${field.name}`

  const widget = findAdornment(field, 'WIDGET')
  if (widget) {
    const widgetName = typeof widget.values?.widgetName === 'string' ? widget.values.widgetName : ''
    const widgetMetaData = widgetMetaDataMap?.[widgetName]
    if (!widgetMetaData) {
      return <span role="alert" className={cn('text-sm text-destructive', className)} data-qqq-id={dataQqqId}>
        Error: Could not load widget [{widgetName}]
      </span>
    }
    if (rawValue === null || rawValue === undefined) return <EmptyValue fieldName={field.name} className={className} />
    return <div className={className} data-qqq-id={dataQqqId}><WidgetRenderer widgetMetaData={widgetMetaData} data={rawValue} /></div>
  }

  if (value === null || value === undefined || value === '') {
    return <EmptyValue fieldName={field.name} className={className} />
  }

  const fromParams = navigateFrom
    ? `?from=${encodeURIComponent(navigateFrom.path)}&fromLabel=${encodeURIComponent(navigateFrom.label)}`
    : ''

  if (findAdornment(field, 'LINK')) {
    const target = linkTarget(field, record)
    if (target?.kind === 'record') {
      return <RecordLink tableName={target.tableName} primaryKey={target.primaryKey} label={String(value)}
        allTables={allTables} fromParams={fromParams} dataQqqId={dataQqqId} className={className} />
    }
    if (target?.kind === 'url') {
      if (target.external) {
        return (
          <a href={target.href} target={target.target} rel={target.target === '_blank' ? 'noopener noreferrer' : undefined}
            className={cn('inline-flex items-center gap-1 text-sm text-primary underline hover:text-primary/80', TOUCH_LINK, className)}
            data-qqq-id={dataQqqId}>
            {String(value)}
            {target.target === '_blank' && <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
            {target.target === '_blank' && <span className="sr-only">(opens in a new tab)</span>}
          </a>
        )
      }
      return <Link href={target.href} className={cn('text-sm text-primary underline hover:text-primary/80', TOUCH_LINK, className)}
        data-qqq-id={dataQqqId}>{String(value)}</Link>
    }
    return <PlainValue value={String(value)} dataQqqId={dataQqqId} className={className} />
  }

  if (findAdornment(field, 'REVEAL')) {
    return <RevealField value={String(value)} field={field} className={className} />
  }

  if (findAdornment(field, 'RENDER_HTML')) {
    return <SanitizedHtml html={String(rawValue ?? '')} dataQqqId={dataQqqId} className={className} />
  }

  if (findAdornment(field, 'CHIP')) {
    const { color, icon } = chipStyle(field, rawValue)
    return (
      <span
        className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', CHIP_COLOR_CLASSES[color], className)}
        data-qqq-id={dataQqqId}
        data-chip-color={color}
        data-chip-icon={icon}
      >
        {String(value)}
      </span>
    )
  }

  const codeEditor = findAdornment(field, 'CODE_EDITOR')
  if (codeEditor) {
    const languageMode = typeof codeEditor.values?.languageMode === 'string' ? codeEditor.values.languageMode : 'text'
    return <CodeViewer code={String(rawValue ?? value)} languageMode={languageMode} fieldName={field.name} className={className} />
  }

  if (findAdornment(field, 'ERROR')) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200', className)}
        data-qqq-id={dataQqqId} role="note">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {String(rawValue ?? value)}
      </span>
    )
  }

  if (findAdornment(field, 'FILE_DOWNLOAD')) {
    const file = fileDownload(field, record)
    if (!file) return <EmptyValue fieldName={field.name} className={className} />
    return <FileLinks url={file.url} fileName={file.fileName} dataQqqId={dataQqqId} className={className} />
  }

  // Record reference — a possible-value field whose source is a known table.
  const pvsTable = field.possibleValueSourceName
  if (pvsTable && allTables?.[pvsTable] && rawValue !== null && rawValue !== undefined) {
    return <RecordLink tableName={pvsTable} primaryKey={String(rawValue)} label={String(value)}
      allTables={allTables} fromParams={fromParams} dataQqqId={dataQqqId} className={className} />
  }

  switch (field.type) {
    case 'BOOLEAN': {
      const boolVal = rawValue === true || rawValue === 'true' || rawValue === 1
      return (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
            boolVal
              ? 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
            className
          )}
          data-qqq-id={dataQqqId}
        >
          {boolVal ? 'Yes' : 'No'}
        </span>
      )
    }

    case 'DATE_TIME': {
      // A zoned display value from the backend (e.g. a fixed or per-record zone) wins;
      // otherwise the instant is shown in the viewer's time zone.
      const text = displayValue && displayValue !== rawValue ? displayValue : (formatDateTime(rawValue) ?? String(value))
      return <time dateTime={typeof rawValue === 'string' ? rawValue : undefined} className={cn('text-sm text-foreground', className)}
        data-qqq-id={dataQqqId}>{text}</time>
    }

    case 'BLOB': {
      if (typeof rawValue !== 'string') return <PlainValue value="[Binary data]" dataQqqId={dataQqqId} className={className} />
      const table = tableMetaData ?? allTables?.[record.tableName]
      const primaryKey = table?.primaryKeyField ? record.values[table.primaryKeyField] : undefined
      const fileName = `${table?.label ?? record.tableName} ${primaryKey ?? ''} ${field.label}`.replace(/\s+/g, ' ').trim()
      return <FileLinks url={`data:application/octet-stream;base64,${rawValue}`} fileName={fileName} dataQqqId={dataQqqId}
        className={className} inline={false} />
    }

    case 'TEXT': {
      return (
        <div className={cn('whitespace-pre-wrap text-sm text-foreground', className)} data-qqq-id={dataQqqId}>
          {String(value)}
        </div>
      )
    }

    case 'HTML': {
      return <SanitizedHtml html={String(rawValue ?? value)} dataQqqId={dataQqqId} className={className} />
    }

    default: {
      const strValue = String(value)
      if (field.type === 'STRING' && isHttpUrl(strValue)) {
        return (
          <a href={strValue} target="_blank" rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 hover:underline', TOUCH_LINK, className)}
            data-qqq-id={dataQqqId}>
            {strValue}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )
      }
      if (field.type === 'STRING' && isEmail(strValue)) {
        return <a href={`mailto:${strValue}`} className={cn('text-sm text-primary hover:text-primary/80 hover:underline', TOUCH_LINK, className)}
          data-qqq-id={dataQqqId}>{strValue}</a>
      }
      return <PlainValue value={strValue} dataQqqId={dataQqqId} className={className} />
    }
  }
}

// --- Helper components ---

/**
 * Em dash for an empty value.
 *
 * @param props - Component properties.
 * @param props.fieldName - Field name for the `data-qqq-id`.
 * @param props.className - Optional classes.
 * @returns The placeholder span.
 */
function EmptyValue({ fieldName, className }: { fieldName: string; className?: string }) {
  return <span className={cn('text-muted-foreground text-sm', className)} data-qqq-id={`field-value-${fieldName}`}>—</span>
}

/**
 * Plain text value.
 *
 * @param props - Component properties.
 * @param props.value - Text to show.
 * @param props.dataQqqId - `data-qqq-id` of the span.
 * @param props.className - Optional classes.
 * @returns The span.
 */
function PlainValue({ value, dataQqqId, className }: { value: string; dataQqqId: string; className?: string }) {
  return <span className={cn('text-sm text-foreground', className)} data-qqq-id={dataQqqId}>{value}</span>
}

/**
 * Sanitized HTML (scripts, handlers and unsafe URLs removed).
 *
 * @param props - Component properties.
 * @param props.html - Untrusted HTML.
 * @param props.dataQqqId - `data-qqq-id` of the container.
 * @param props.className - Optional classes.
 * @returns The rendered HTML container.
 */
function SanitizedHtml({ html, dataQqqId, className }: { html: string; dataQqqId: string; className?: string }) {
  const sanitized = useMemo(() => sanitizeHtml(html), [html])
  return <div className={cn('prose prose-sm max-w-none dark:prose-invert text-sm', className)} data-qqq-id={dataQqqId}
    dangerouslySetInnerHTML={{ __html: sanitized }} />
}

/**
 * Link to another record, with a hover preview when its table metadata is known.
 *
 * @param props - Component properties.
 * @param props.tableName - Target table.
 * @param props.primaryKey - Target record key.
 * @param props.label - Link text (the display value).
 * @param props.allTables - Table metadata map.
 * @param props.fromParams - Back-navigation query string.
 * @param props.dataQqqId - `data-qqq-id` of the link.
 * @param props.className - Optional classes.
 * @returns The link.
 */
function RecordLink({ tableName, primaryKey, label, allTables, fromParams, dataQqqId, className }: {
  tableName: string; primaryKey: string; label: string; allTables?: Record<string, QTableMetaData>
  fromParams: string; dataQqqId: string; className?: string
}) {
  const link = (
    <Link href={`/app/${encodeURIComponent(tableName)}/${encodeURIComponent(primaryKey)}${fromParams}`}
      className={cn('text-sm text-primary hover:text-primary/80 hover:underline', TOUCH_LINK, className)} data-qqq-id={dataQqqId}>
      {label}
    </Link>
  )
  const tableMetaData = allTables?.[tableName]
  if (!tableMetaData) return link
  return <RecordHoverCard tableName={tableName} primaryKey={primaryKey} tableMetaData={tableMetaData}>{link}</RecordHoverCard>
}

/**
 * File name with "Open file" and "Download file" actions.
 *
 * @param props - Component properties.
 * @param props.url - File URL.
 * @param props.fileName - File name to show and save as.
 * @param props.dataQqqId - `data-qqq-id` of the container.
 * @param props.className - Optional classes.
 * @param props.inline - When false (inline data), only the download action is offered.
 * @returns The file links.
 */
function FileLinks({ url, fileName, dataQqqId, className, inline = true }: {
  url: string; fileName: string; dataQqqId: string; className?: string; inline?: boolean
}) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2 text-sm', className)} data-qqq-id={dataQqqId}>
      <span className="text-foreground">{fileName}</span>
      {inline && (
        <a href={url} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1 text-primary underline hover:text-primary/80', TOUCH_LINK)}
          data-qqq-id={`${dataQqqId}-open`}>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open file<span className="sr-only">: {fileName} (opens in a new tab)</span>
        </a>
      )}
      <a href={inline ? attachmentUrl(url) : url} download={fileName} className={cn('inline-flex items-center gap-1 text-primary underline hover:text-primary/80', TOUCH_LINK)}
        data-qqq-id={`${dataQqqId}-download`}>
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Download file<span className="sr-only">: {fileName}</span>
      </a>
    </span>
  )
}

/**
 * Read-only code display for CODE_EDITOR fields, with JSON formatting.
 *
 * @param props - Component properties.
 * @param props.code - The code text.
 * @param props.languageMode - The adornment's `languageMode`.
 * @param props.fieldName - Field name for `data-qqq-id`s.
 * @param props.className - Optional classes.
 * @returns The code block.
 */
function CodeViewer({ code, languageMode, fieldName, className }: { code: string; languageMode: string; fieldName: string; className?: string }) {
  const [formatted, setFormatted] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)
  const pretty = useMemo(() => {
    if (!formatted) return code
    try {
      return JSON.stringify(JSON.parse(code), null, 2)
    } catch {
      return code
    }
  }, [code, formatted])
  return (
    <div className={cn('w-full space-y-1', className)} data-qqq-id={`field-value-${fieldName}`} data-language-mode={languageMode}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="rounded bg-muted px-2 py-0.5 font-medium uppercase">{languageMode}</span>
        {languageMode.toLowerCase() === 'json' && (
          <button type="button" className="rounded px-2 py-0.5 text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id={`button-format-${fieldName}`}
            onClick={() => {
              if (!formatted) {
                try { JSON.parse(code); setFormatError(null) } catch (error) { setFormatError(`Error formatting code: ${error instanceof Error ? error.message : String(error)}`); return }
              }
              setFormatted((current) => !current)
            }}>
            {formatted ? 'Reset Format' : 'Format JSON'}
          </button>
        )}
      </div>
      {formatError && <p role="alert" className="text-xs text-destructive">{formatError}</p>}
      <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted p-3 text-sm">
        <code className="whitespace-pre-wrap font-mono text-foreground">{pretty}</code>
      </pre>
    </div>
  )
}

/**
 * Masked value with show/hide and copy controls (REVEAL adornment).
 *
 * @param props - Component properties.
 * @param props.value - The secret value.
 * @param props.field - Field metadata (label for accessible names).
 * @param props.className - Optional classes.
 * @returns The masked value and controls.
 */
function RevealField({ value, field, className }: { value: string; field: QFieldMetaData; className?: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="font-mono text-sm text-foreground" data-qqq-id={`field-value-${field.name}`} data-revealed={revealed}>
        {revealed ? value : '•'.repeat(8)}
      </span>
      <button type="button" onClick={() => setRevealed((current) => !current)}
        aria-label={revealed ? `Hide ${field.label}` : `Show ${field.label}`} aria-pressed={revealed}
        data-qqq-id={`button-reveal-${field.name}`}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
        {revealed ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      {revealed && (
        <button type="button" aria-label={`Copy ${field.label}`} data-qqq-id={`button-copy-${field.name}`}
          onClick={() => { void navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      )}
      {copied && <span role="status" className="text-xs text-muted-foreground">Copied To Clipboard</span>}
    </span>
  )
}
