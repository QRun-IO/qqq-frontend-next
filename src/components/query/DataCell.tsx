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

/** DataCell — dispatches to the correct cell renderer based on QQQ field type and adornments. Handles LINK, CHIP, SIZE, ERROR, RENDER_HTML, REVEAL, FILE_DOWNLOAD, TOOLTIP adornments and type-based fallbacks. */
'use client'

// DataCell — dispatches to the correct renderer based on field type and adornments

import React, { useState } from 'react'
import DOMPurify from 'dompurify'
import type { QFieldMetaData, QRecord } from '@/types'

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
 * @param field - Metadata describing the field (type, adornments, name, label).
 * @param value - The raw record value for this field.
 * @param displayValue - Optional server-provided display string (used instead of raw value when available).
 * @param record - The full parent QRecord, needed by adornments that reference record-level data.
 */
export function DataCell({ field, value, displayValue, record }: DataCellProps) {
  const display = displayValue ?? (value != null ? String(value) : '')

  // Check adornments for special rendering
  for (const adornment of field.adornments ?? []) {
    switch (adornment.type) {
      case 'LINK': {
        const url = adornment.values?.linkURL ?? (typeof value === 'string' ? value : undefined)
        if (url) {
          return (
            <a
              href={url}
              className="text-primary underline hover:text-primary/90"
              target="_blank"
              rel="noopener noreferrer"
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
        const color = adornment.values?.color ?? 'blue'
        const colorMap: Record<string, string> = {
          blue: 'bg-blue-100 text-blue-800',
          green: 'bg-green-100 text-green-800',
          red: 'bg-red-100 text-red-800',
          yellow: 'bg-yellow-100 text-yellow-800',
          gray: 'bg-gray-100 text-gray-800',
          purple: 'bg-purple-100 text-purple-800',
        }
        const colorClass = colorMap[color] ?? colorMap['blue']!
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
            data-qqq-id={`grid-cell-${field.name}`}
          >
            {display}
          </span>
        )
      }

      case 'SIZE': {
        return (
          <span data-qqq-id={`grid-cell-${field.name}`} className="text-sm text-muted-foreground">
            {formatBytes(typeof value === 'number' ? value : Number(value))}
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
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(display) }}
            data-qqq-id={`grid-cell-${field.name}`}
            className="text-sm"
          />
        )
      }

      case 'REVEAL': {
        return <RevealCell value={display} fieldName={field.name} />
      }

      case 'FILE_DOWNLOAD': {
        const downloadUrl = adornment.values?.downloadUrl
        if (downloadUrl) {
          return (
            <a
              href={downloadUrl}
              download
              className="text-primary underline hover:text-primary/90 text-sm"
              data-qqq-id={`grid-cell-${field.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              {display || 'Download'}
            </a>
          )
        }
        break
      }

      case 'TOOLTIP': {
        const tooltip = adornment.values?.tooltip
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
          {display || formatDateTime(String(value))}
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
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(display) }}
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
 * @param fieldName - The field name used for the `data-qqq-id` attribute.
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
 * @param value - The sensitive string value to reveal when toggled.
 * @param fieldName - The field name used for the `data-qqq-id` attribute and aria-label.
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
 * Converts a byte count into a human-readable string with the appropriate unit (B, KB, MB, GB, TB).
 *
 * @param bytes - The number of bytes to format.
 * @returns A formatted string such as `"1.4 MB"` or `"0 B"`.
 */
function formatBytes(bytes: number): string {
  if (isNaN(bytes) || bytes < 0) return '0 B'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const idx = Math.min(i, units.length - 1)
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

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
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    return d.toLocaleString()
  } catch {
    return value
  }
}
