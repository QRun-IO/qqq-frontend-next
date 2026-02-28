/** FieldValue — read-only renderer for a single QQQ field value, supporting all adornment types */
'use client'

// FieldValue — renders a single field value in read-only display mode
// Handles all QFieldType values with appropriate formatting
// Supports adornment types: LINK, CHIP, FILE_DOWNLOAD, REVEAL, SIZE, RENDER_HTML,
// CODE_EDITOR, TOOLTIP, ERROR

import React, { useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink, Download, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import DOMPurify from 'dompurify'

import type { QFieldMetaData, QTableMetaData, QRecord, FieldAdornment } from '@/types'
import { cn } from '@/lib/utils/cn'
import { isHttpUrl, isRelativeUrl, isEmail } from '@/lib/utils/string-utils'
import { RecordHoverCard } from './RecordHoverCard'

/**
 * Props for the {@link FieldValue} component.
 */
interface FieldValueProps {
  /** Metadata describing the field's type, adornments, and source. */
  field: QFieldMetaData
  /** The record whose values and display values are rendered. */
  record: QRecord
  /** Full table metadata map — enables record link hover previews */
  allTables?: Record<string, QTableMetaData>
  /** Source page info for back navigation — appended as ?from=&fromLabel= to record links */
  navigateFrom?: { path: string; label: string }
  /** Additional CSS classes applied to the outermost rendered element. */
  className?: string
}

/**
 * Renders a single QQQ field value in read-only display mode.
 *
 * Adornment priority (first match wins): LINK, FILE_DOWNLOAD, SIZE, CHIP,
 * RENDER_HTML, CODE_EDITOR, TOOLTIP, ERROR, record-reference link.
 * After adornments, rendering falls back to `field.type`-based formatting
 * (BOOLEAN badge, PASSWORD reveal, BLOB download, TEXT pre-wrap).
 * Auto-links bare http(s) URLs and e-mail addresses in the default case.
 *
 * @param props - See {@link FieldValueProps}.
 * @returns A React element appropriate for the field type and adornments,
 *   or an em-dash span when the value is empty.
 */
export function FieldValue({ field, record, allTables, navigateFrom, className }: FieldValueProps) {
  const rawValue = record.values[field.name]
  const displayValue = record.displayValues?.[field.name]

  // Use displayValue when available (formatted by backend)
  const value = displayValue ?? rawValue

  // MED-4: memoize DOMPurify sanitization so it only re-runs when value changes
  const sanitizedHtml = useMemo(
    () => DOMPurify.sanitize(String(value)),
    [value]
  )

  if (value === null || value === undefined || value === '') {
    return (
      <span
        className={cn('text-muted-foreground text-sm', className)}
        data-qqq-id={`field-value-${field.name}`}
      >
        —
      </span>
    )
  }

  // Record reference link — field with possibleValueSourceName matching a known table
  const pvsTable = field.possibleValueSourceName
  const refTableMeta = pvsTable ? allTables?.[pvsTable] : undefined
  const isRecordLink = Boolean(refTableMeta) && rawValue != null

  // Check adornments
  const hasLink = field.adornments?.some((a) => a.type === 'LINK')
  const hasChip = field.adornments?.some((a) => a.type === 'CHIP')
  const hasFileDownload = field.adornments?.some((a) => a.type === 'FILE_DOWNLOAD')
  const hasReveal = field.adornments?.some((a) => a.type === 'REVEAL')
  const hasSize = field.adornments?.some((a) => a.type === 'SIZE')
  const hasRenderHtml = field.adornments?.some((a) => a.type === 'RENDER_HTML')
  const hasCodeEditor = field.adornments?.some((a) => a.type === 'CODE_EDITOR')
  const hasTooltipAdornment = field.adornments?.some((a) => a.type === 'TOOLTIP')
  const hasError = field.adornments?.some((a) => a.type === 'ERROR')

  // LINK adornment — render as anchor
  if (hasLink) {
    const linkAdornment = field.adornments?.find(
      (a): a is Extract<FieldAdornment, { type: 'LINK' }> => a.type === 'LINK'
    )
    const href = linkAdornment?.values?.linkURL ?? String(value)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 underline',
          className
        )}
        data-qqq-id={`field-value-${field.name}`}
      >
        {String(value)}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    )
  }

  // FILE_DOWNLOAD adornment
  if (hasFileDownload) {
    const href = displayValue ?? String(rawValue)
    return (
      <a
        href={href}
        download
        className={cn(
          'inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 underline',
          className
        )}
        data-qqq-id={`field-value-${field.name}`}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Download
      </a>
    )
  }

  // SIZE adornment — format bytes
  if (hasSize) {
    const bytes = Number(rawValue)
    const formatted = formatBytes(bytes)
    return (
      <span
        className={cn('text-sm text-foreground', className)}
        data-qqq-id={`field-value-${field.name}`}
      >
        {formatted}
      </span>
    )
  }

  // CHIP adornment — render as badge
  if (hasChip) {
    const chipAdornment = field.adornments?.find(
      (a): a is Extract<FieldAdornment, { type: 'CHIP' }> => a.type === 'CHIP'
    )
    const colorMap: Record<string, string> = chipAdornment?.values?.colorMap ?? {}
    const color = colorMap[String(value)] ?? 'gray'
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
          getChipClasses(color),
          className
        )}
        data-qqq-id={`field-value-${field.name}`}
      >
        {String(value)}
      </span>
    )
  }

  // RENDER_HTML adornment — render sanitized HTML
  if (hasRenderHtml || field.type === 'HTML') {
    return (
      <div
        className={cn('prose prose-sm max-w-none dark:prose-invert text-sm', className)}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        data-qqq-id={`field-value-${field.name}`}
      />
    )
  }

  // CODE_EDITOR adornment — render in a monospace code block
  if (hasCodeEditor) {
    return (
      <pre
        className={cn(
          'overflow-auto rounded-md border border-border bg-muted p-3 text-sm',
          className
        )}
        data-qqq-id={`field-value-${field.name}`}
      >
        <code className="font-mono text-foreground whitespace-pre-wrap">
          {String(value)}
        </code>
      </pre>
    )
  }

  // TOOLTIP adornment — wrap displayed value in a tooltip
  if (hasTooltipAdornment) {
    const tooltipAdornment = field.adornments?.find(
      (a): a is Extract<FieldAdornment, { type: 'TOOLTIP' }> => a.type === 'TOOLTIP'
    )
    const tooltipText =
      tooltipAdornment?.values?.tooltipText ??
      tooltipAdornment?.values?.text ??
      tooltipAdornment?.values?.tooltip ??
      ''

    if (tooltipText) {
      return (
        <TooltipPrimitive.Provider delayDuration={300}>
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <span
                className={cn(
                  'text-sm text-foreground cursor-help underline decoration-dotted decoration-muted-foreground',
                  className
                )}
                data-qqq-id={`field-value-${field.name}`}
                tabIndex={0}
              >
                {String(value)}
              </span>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={4}
                className={cn(
                  'z-50 max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm shadow-md',
                  'text-foreground',
                  'animate-in fade-in-0 zoom-in-95'
                )}
              >
                {tooltipText}
                <TooltipPrimitive.Arrow className="fill-border" />
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
      )
    }

    // Intentional fallthrough: when the TOOLTIP adornment exists but no tooltip text
    // can be resolved (all value keys return empty), we fall through to type-based
    // or default rendering below. The value itself is still rendered -- only the
    // tooltip wrapper is omitted since there is no text to display.
  }

  // ERROR adornment — render with error icon and destructive styling
  if (hasError) {
    const errorAdornment = field.adornments?.find(
      (a): a is Extract<FieldAdornment, { type: 'ERROR' }> => a.type === 'ERROR'
    )
    const errorText =
      errorAdornment?.values?.errorText ??
      errorAdornment?.values?.text ??
      ''

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-sm',
          className
        )}
        data-qqq-id={`field-value-${field.name}`}
      >
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <span className="text-destructive">
          {String(value)}
          {errorText && (
            <span className="ml-1 text-xs text-destructive">({errorText})</span>
          )}
        </span>
      </span>
    )
  }

  // Record reference — render as a link with hover preview card
  if (isRecordLink && refTableMeta) {
    const fromParams = navigateFrom
      ? `?from=${encodeURIComponent(navigateFrom.path)}&fromLabel=${encodeURIComponent(navigateFrom.label)}`
      : ''
    const link = (
      <Link
        href={`/app/${pvsTable}/${rawValue}${fromParams}`}
        className={cn(
          'text-sm text-primary hover:text-primary/80 hover:underline',
          className
        )}
        data-qqq-id={`field-value-${field.name}`}
      >
        {String(value)}
      </Link>
    )

    return (
      <RecordHoverCard
        tableName={pvsTable!}
        primaryKey={rawValue as string | number}
        tableMetaData={refTableMeta}
      >
        {link}
      </RecordHoverCard>
    )
  }

  // Type-based rendering
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
          data-qqq-id={`field-value-${field.name}`}
        >
          {boolVal ? 'Yes' : 'No'}
        </span>
      )
    }

    case 'PASSWORD': {
      return <RevealField value={String(value)} fieldName={field.name} className={className} />
    }

    case 'BLOB': {
      // BLOB — show as file download if we have a URL, otherwise indicate large binary
      if (typeof value === 'string' && (isHttpUrl(value) || isRelativeUrl(value))) {
        return (
          <a
            href={value}
            download
            className={cn(
              'inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 underline',
              className
            )}
            data-qqq-id={`field-value-${field.name}`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download file
          </a>
        )
      }
      return (
        <span
          className={cn('text-sm text-muted-foreground', className)}
          data-qqq-id={`field-value-${field.name}`}
        >
          [Binary data]
        </span>
      )
    }

    case 'TEXT': {
      return (
        <div
          className={cn('whitespace-pre-wrap text-sm text-foreground', className)}
          data-qqq-id={`field-value-${field.name}`}
        >
          {String(value)}
        </div>
      )
    }

    default: {
      // REVEAL adornment on non-password fields
      if (hasReveal) {
        return <RevealField value={String(value)} fieldName={field.name} className={className} />
      }

      // Auto-link URLs — detect http(s):// values and render as external links
      const strValue = String(value)
      if (isHttpUrl(strValue)) {
        return (
          <a
            href={strValue}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 hover:underline',
              className
            )}
            data-qqq-id={`field-value-${field.name}`}
          >
            {strValue}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )
      }

      // Auto-link emails — detect email addresses and render as mailto links
      if (isEmail(strValue)) {
        return (
          <a
            href={`mailto:${strValue}`}
            className={cn(
              'text-sm text-primary hover:text-primary/80 hover:underline',
              className
            )}
            data-qqq-id={`field-value-${field.name}`}
          >
            {strValue}
          </a>
        )
      }

      return (
        <span
          className={cn('text-sm text-foreground', className)}
          data-qqq-id={`field-value-${field.name}`}
        >
          {strValue}
        </span>
      )
    }
  }
}

// --- Helper components ---

/**
 * Renders a masked value with a toggle button to reveal or hide it.
 *
 * Used for PASSWORD field types and any field with a REVEAL adornment.
 *
 * @param value - The plaintext value to optionally display.
 * @param fieldName - The field name used to build the `data-qqq-id` attribute.
 * @param className - Optional additional CSS classes for the wrapper span.
 */
function RevealField({
  value,
  fieldName,
  className,
}: {
  value: string
  fieldName: string
  className?: string
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span
        className="text-sm text-foreground font-mono"
        data-qqq-id={`field-value-${fieldName}`}
      >
        {revealed ? value : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? 'Hide value' : 'Show value'}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {revealed ? (
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </span>
  )
}

// --- Utilities ---

/**
 * Formats a byte count into a human-readable string with the appropriate unit.
 *
 * Returns `"\u2014"` (em-dash) for `NaN` inputs and `"0 B"` for zero.
 *
 * @param bytes - The number of bytes to format.
 * @returns A formatted string such as `"1.5 MB"`.
 */
function formatBytes(bytes: number): string {
  if (isNaN(bytes)) return '\u2014'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

/**
 * Maps a semantic color name to Tailwind chip badge classes.
 *
 * Uses `-950` (near-black tinted) text on `-100` backgrounds for WCAG-compliant
 * contrast.  Falls back to `gray` for unknown color names.
 *
 * @param color - A semantic color name (e.g. `"green"`, `"red"`, `"blue"`).
 * @returns A Tailwind class string for the chip badge background and text color.
 */
function getChipClasses(color: string): string {
  // Use -950 (near-black tinted) text on -100 bg for guaranteed readability
  const colorMap: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100',
    red: 'bg-red-100 text-red-950 dark:bg-red-900/50 dark:text-red-100',
    yellow: 'bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100',
    blue: 'bg-blue-100 text-blue-950 dark:bg-blue-900/50 dark:text-blue-100',
    purple: 'bg-purple-100 text-purple-950 dark:bg-purple-900/50 dark:text-purple-100',
    orange: 'bg-orange-100 text-orange-950 dark:bg-orange-900/50 dark:text-orange-100',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  }
  return colorMap[color.toLowerCase()] ?? colorMap.gray
}
