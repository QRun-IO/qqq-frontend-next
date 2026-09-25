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
 * @file DataCell — dispatches to the correct cell renderer based on QQQ field type and adornments. Handles LINK, CHIP, ERROR, RENDER_HTML, REVEAL, FILE_DOWNLOAD, TOOLTIP adornments (backend value keys) and type-based fallbacks.
 */

'use client'

// DataCell — dispatches to the correct renderer based on field type and adornments

import React, { useState } from 'react'
import Link from 'next/link'
import { sanitizeHtml } from '@/lib/utils/sanitize-html'
import type { QFieldMetaData, QRecord } from '@/types'
import { chipStyle, CHIP_COLOR_CLASSES, fileDownload, linkTarget, tooltipText } from '@/lib/utils/adornment-utils'

/**
 * Props for the DataCell component.
 */
interface DataCellProps {
  /** Metadata for the field this cell represents, including type and adornments. */
  field: QFieldMetaData
  /** Raw value from the record for this field (may be any JSON-compatible type). */
  value: unknown
  /** Pre-formatted display string from the server; takes precedence over raw value formatting. */
  displayValue: string | undefined
  /** The full parent record, used by adornments such as ERROR to access `record.errors`. */
  record: QRecord
}

/**
 * Renders a single table cell for the DataGrid.
 *
 * Adornments are evaluated first (in array order); the first matching adornment
 * short-circuits the render. If no adornment matches, a type-appropriate renderer
 * is chosen based on `field.type`. HTML values are sanitized with DOMPurify before
 * being injected via `dangerouslySetInnerHTML`.
 *
 * @param props - Component properties.
 * @returns The rendered cell element.
 */
export function DataCell({ field, value, displayValue, record }: DataCellProps) {
  const display = displayValue ?? (value != null ? String(value) : '')

  // Check adornments for special rendering
  for (const adornment of field.adornments ?? []) {
    switch (adornment.type) {
      case 'LINK': {
        const target = linkTarget(field, record)
        if (target?.kind === 'record') {
          return (
            <Link
              href={`/app/${encodeURIComponent(target.tableName)}/${encodeURIComponent(target.primaryKey)}`}
              className="text-primary underline hover:text-primary/90"
              data-qqq-id={`grid-cell-link-${field.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              {display}
            </Link>
          )
        }
        if (target?.kind === 'url') {
          return (
            <a
              href={target.href}
              className="text-primary underline hover:text-primary/90"
              target={target.target}
              rel={target.target === '_blank' ? 'noopener noreferrer' : undefined}
              data-qqq-id={`grid-cell-${field.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              {display}
            </a>
          )
        }
        break
      }

      case 'CHIP': {
        if (!display) break
        const { color } = chipStyle(field, value)
        return (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CHIP_COLOR_CLASSES[color]}`}
            data-qqq-id={`grid-cell-${field.name}`}
            data-chip-color={color}
          >
            {display}
          </span>
        )
      }

      case 'ERROR': {
        const errors = record.errors ?? []
        if (errors.length > 0) {
          return (
            <span
              className="text-red-600 text-sm"
              title={errors.join('\n')}
              data-qqq-id={`grid-cell-${field.name}`}
            >
              {display}
            </span>
          )
        }
        break
      }

      case 'RENDER_HTML': {
        return (
          <span
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(display) }}
            data-qqq-id={`grid-cell-${field.name}`}
            className="text-sm"
          />
        )
      }

      case 'REVEAL': {
        return <RevealCell value={display} fieldName={field.name} />
      }

      case 'FILE_DOWNLOAD': {
        const file = fileDownload(field, record)
        if (file) {
          return (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/90 text-sm"
              data-qqq-id={`grid-cell-${field.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              {file.fileName}
            </a>
          )
        }
        break
      }

      case 'TOOLTIP': {
        const tooltip = tooltipText(field, record)
        return (
          <span
            title={tooltip ?? display}
            className="cursor-help border-b border-dashed border-border text-sm"
            data-qqq-id={`grid-cell-${field.name}`}
          >
            {display}
          </span>
        )
      }

      default:
        break
    }
  }

  // Type-based rendering (when no matching adornment)
  switch (field.type) {
    case 'BOOLEAN': {
      if (value == null || value === '') return <EmptyCell fieldName={field.name} />
      const boolVal = value === true || value === 'true' || value === 1
      return (
        <span
          className={`text-sm font-medium ${boolVal ? 'text-green-700' : 'text-muted-foreground'}`}
          data-qqq-id={`grid-cell-${field.name}`}
        >
          {boolVal ? 'Yes' : 'No'}
        </span>
      )
    }

    case 'DATE': {
      if (!value) return <EmptyCell fieldName={field.name} />
      return (
        <span className="text-sm text-foreground" data-qqq-id={`grid-cell-${field.name}`}>
          {display || formatDate(String(value))}
        </span>
      )
    }

    case 'DATE_TIME': {
      if (!value) return <EmptyCell fieldName={field.name} />
      return (
        <span className="text-sm text-foreground" data-qqq-id={`grid-cell-${field.name}`}>
          {displayValue && displayValue !== String(value) ? displayValue : formatDateTime(String(value))}
        </span>
      )
    }

    case 'PASSWORD': {
      return (
        <span className="text-sm text-muted-foreground" data-qqq-id={`grid-cell-${field.name}`}>
          ••••••••
        </span>
      )
    }

    case 'BLOB': {
      if (!value) return <EmptyCell fieldName={field.name} />
      return (
        <span className="text-sm text-muted-foreground" data-qqq-id={`grid-cell-${field.name}`}>
          [Binary data]
        </span>
      )
    }

    case 'HTML': {
      return (
        <span
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(display) }}
          data-qqq-id={`grid-cell-${field.name}`}
          className="text-sm"
        />
      )
    }

    case 'INTEGER':
    case 'LONG':
    case 'DECIMAL': {
      if (value == null || value === '') return <EmptyCell fieldName={field.name} />
      return (
        <span
          className="text-sm text-foreground tabular-nums"
          data-qqq-id={`grid-cell-${field.name}`}
        >
          {display || String(value)}
        </span>
      )
    }

    default: {
      // STRING, TEXT, TIME, and anything else
      if (value == null || value === '') return <EmptyCell fieldName={field.name} />
      return (
        <span
          className="text-sm text-foreground truncate block max-w-xs"
          title={display}
          data-qqq-id={`grid-cell-${field.name}`}
        >
          {display}
        </span>
      )
    }
  }
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

/**
 * Renders an em-dash placeholder for null or empty field values.
 *
 * @param props - Component properties.
 * @returns The rendered empty cell span.
 */
function EmptyCell({ fieldName }: { fieldName: string }) {
  return (
    <span className="text-sm text-muted-foreground" data-qqq-id={`grid-cell-${fieldName}`}>
      —
    </span>
  )
}

/**
 * Renders a toggle button that hides a sensitive value behind dots until the user clicks to reveal it.
 *
 * Used for fields with the `REVEAL` adornment (e.g., API keys, tokens).
 *
 * @param props - Component properties.
 * @returns The rendered reveal toggle button.
 */
function RevealCell({ value, fieldName }: { value: string; fieldName: string }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setRevealed((r) => !r)
      }}
      className="text-sm text-muted-foreground underline cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
      aria-label={revealed ? `Hide ${fieldName}` : `Reveal ${fieldName}`}
      data-qqq-id={`grid-cell-${fieldName}`}
    >
      {revealed ? value : '••••••••'}
    </button>
  )
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

/**
 * Formats an ISO date string using the browser's locale date formatting.
 *
 * Returns the original string unchanged if parsing fails.
 *
 * @param value - An ISO 8601 date string (e.g., `"2024-06-15"`).
 * @returns A locale-formatted date string (e.g., `"6/15/2024"`).
 */
function formatDate(value: string): string {
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    return d.toLocaleDateString()
  } catch {
    return value
  }
}

/**
 * Formats an ISO datetime string using the browser's locale date-time formatting.
 *
 * Returns the original string unchanged if parsing fails.
 *
 * @param value - An ISO 8601 datetime string (e.g., `"2024-06-15T14:30:00Z"`).
 * @returns A locale-formatted datetime string (e.g., `"6/15/2024, 2:30:00 PM"`).
 */
function formatDateTime(value: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  const hours = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12
  const zone = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? ''
  // Material's "yyyy-MM-dd hh:mm:ss AM TZ", in the browser's time zone
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hours)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'} ${zone}`.trim()
}
