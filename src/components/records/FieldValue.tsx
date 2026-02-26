'use client'

// FieldValue — renders a single field value in read-only display mode
// Handles all QFieldType values with appropriate formatting

import React from 'react'
import { ExternalLink, Download, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import type { QFieldMetaData, QRecord } from '@/types'
import { cn } from '@/lib/utils/cn'

interface FieldValueProps {
  field: QFieldMetaData
  record: QRecord
  className?: string
}

export function FieldValue({ field, record, className }: FieldValueProps) {
  const rawValue = record.values[field.name]
  const displayValue = record.displayValues?.[field.name]

  // Use displayValue when available (formatted by backend)
  const value = displayValue ?? rawValue

  if (value === null || value === undefined || value === '') {
    return (
      <span
        className={cn('text-gray-400 dark:text-gray-600 italic text-sm', className)}
        data-qqq-id={`field-value-${field.name}`}
      >
        —
      </span>
    )
  }

  // Check adornments
  const hasLink = field.adornments?.some((a) => a.type === 'LINK')
  const hasChip = field.adornments?.some((a) => a.type === 'CHIP')
  const hasFileDownload = field.adornments?.some((a) => a.type === 'FILE_DOWNLOAD')
  const hasReveal = field.adornments?.some((a) => a.type === 'REVEAL')
  const hasSize = field.adornments?.some((a) => a.type === 'SIZE')
  const hasRenderHtml = field.adornments?.some((a) => a.type === 'RENDER_HTML')

  // LINK adornment — render as anchor
  if (hasLink) {
    const linkAdornment = field.adornments?.find((a) => a.type === 'LINK')
    const href = (linkAdornment?.values?.['linkURL'] ?? String(value)) as string
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline',
          'dark:text-blue-400 dark:hover:text-blue-300',
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
          'inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline',
          'dark:text-blue-400 dark:hover:text-blue-300',
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
        className={cn('text-sm text-gray-900 dark:text-gray-100', className)}
        data-qqq-id={`field-value-${field.name}`}
      >
        {formatted}
      </span>
    )
  }

  // CHIP adornment — render as badge
  if (hasChip) {
    const chipAdornment = field.adornments?.find((a) => a.type === 'CHIP')
    const colorMap = (chipAdornment?.values?.['colorMap'] ?? {}) as Record<string, string>
    const color = colorMap[String(value)] ?? 'gray'
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          getChipClasses(color),
          className
        )}
        data-qqq-id={`field-value-${field.name}`}
      >
        {String(value)}
      </span>
    )
  }

  // RENDER_HTML adornment — render raw HTML
  if (hasRenderHtml || field.type === 'HTML') {
    return (
      <div
        className={cn('prose prose-sm max-w-none dark:prose-invert text-sm', className)}
        dangerouslySetInnerHTML={{ __html: String(value) }}
        data-qqq-id={`field-value-${field.name}`}
      />
    )
  }

  // Type-based rendering
  switch (field.type) {
    case 'BOOLEAN': {
      const boolVal = rawValue === true || rawValue === 'true' || rawValue === 1
      return (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            boolVal
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
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
      if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('/'))) {
        return (
          <a
            href={value}
            download
            className={cn(
              'inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline',
              'dark:text-blue-400 dark:hover:text-blue-300',
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
          className={cn('text-sm text-gray-500 dark:text-gray-400 italic', className)}
          data-qqq-id={`field-value-${field.name}`}
        >
          [Binary data]
        </span>
      )
    }

    case 'TEXT': {
      return (
        <div
          className={cn('whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100', className)}
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

      return (
        <span
          className={cn('text-sm text-gray-900 dark:text-gray-100', className)}
          data-qqq-id={`field-value-${field.name}`}
        >
          {String(value)}
        </span>
      )
    }
  }
}

// --- Helper components ---

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
        className="text-sm text-gray-900 dark:text-gray-100 font-mono"
        data-qqq-id={`field-value-${fieldName}`}
      >
        {revealed ? value : '••••••••'}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? 'Hide value' : 'Show value'}
        className="rounded p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

function formatBytes(bytes: number): string {
  if (isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function getChipClasses(color: string): string {
  const colorMap: Record<string, string> = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }
  return colorMap[color.toLowerCase()] ?? colorMap.gray
}
