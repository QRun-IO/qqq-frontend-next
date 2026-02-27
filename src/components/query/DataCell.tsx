'use client'

// DataCell — dispatches to the correct renderer based on field type and adornments

import React, { useState } from 'react'
import type { QFieldMetaData, QRecord } from '@/types'

interface DataCellProps {
  field: QFieldMetaData
  value: unknown
  displayValue: string | undefined
  record: QRecord
}

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
            dangerouslySetInnerHTML={{ __html: display }}
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
          dangerouslySetInnerHTML={{ __html: display }}
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

function EmptyCell({ fieldName }: { fieldName: string }) {
  return (
    <span className="text-sm text-muted-foreground" data-qqq-id={`grid-cell-${fieldName}`}>
      —
    </span>
  )
}

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

function formatBytes(bytes: number): string {
  if (isNaN(bytes) || bytes < 0) return '0 B'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const idx = Math.min(i, units.length - 1)
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

function formatDate(value: string): string {
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    return d.toLocaleDateString()
  } catch {
    return value
  }
}

function formatDateTime(value: string): string {
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    return d.toLocaleString()
  } catch {
    return value
  }
}
