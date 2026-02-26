'use client'

// WidgetBlock -- Container wrapper for all dashboard widgets
// Shows label header, loading skeleton, error state, reload button, export button, dropdowns

import React from 'react'
import { RefreshCw, HelpCircle, Download } from 'lucide-react'

import type { QWidgetMetaData, QWidgetDropdown } from '@/types'
import { cn } from '@/lib/utils/cn'
import { WidgetErrorBoundary } from './WidgetErrorBoundary'

interface WidgetBlockProps {
  widgetMetaData: QWidgetMetaData
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  onReload?: () => void
  onExport?: () => void
  children: React.ReactNode
  className?: string
  /** Optional: skip rendering the card border/header (for sub-widgets) */
  bare?: boolean
  /** Dropdown configuration from widget metadata */
  dropdowns?: QWidgetDropdown[]
  /** Pre-fetched options for each dropdown, keyed by dropdown name */
  dropdownOptions?: Record<string, Array<{ label: string; value: string }>>
  /** Current dropdown selection values */
  dropdownValues?: Record<string, string>
  /** Callback when a dropdown value changes */
  onDropdownChange?: (name: string, value: string) => void
}

export function WidgetBlock({
  widgetMetaData,
  isLoading = false,
  isError = false,
  error = null,
  onReload,
  onExport,
  children,
  className,
  bare = false,
  dropdowns,
  dropdownOptions,
  dropdownValues,
  onDropdownChange,
}: WidgetBlockProps) {
  const { name, label, helpContent, showReloadButton, showExportButton } = widgetMetaData

  // Show reload button by default for backward compat, but respect the flag when set
  const shouldShowReload = showReloadButton !== false && onReload
  const shouldShowExport = showExportButton === true

  if (bare) {
    return (
      <WidgetErrorBoundary widgetName={name}>
        {isLoading ? <WidgetSkeleton /> : isError ? (
          <WidgetErrorState error={error} onReload={onReload} widgetName={name} />
        ) : (
          children
        )}
      </WidgetErrorBoundary>
    )
  }

  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border bg-card shadow-sm',
        className
      )}
      data-qqq-id={`widget-${name}`}
      aria-label={label}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <h3
            className="text-base font-semibold text-card-foreground"
            data-qqq-id={`widget-label-${name}`}
          >
            {label}
          </h3>
          {helpContent?.content && (
            <button
              type="button"
              aria-label={`Help for ${label}`}
              title={helpContent.content}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={`button-widget-help-${name}`}
            >
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Dropdown selects */}
          {dropdowns?.map((dropdown) => (
            <select
              key={dropdown.name}
              value={dropdownValues?.[dropdown.name] ?? ''}
              onChange={(e) => onDropdownChange?.(dropdown.name, e.target.value)}
              className="text-sm border border-input rounded px-2 py-1 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={dropdown.label}
              data-qqq-id={`widget-dropdown-${dropdown.name}`}
            >
              <option value="">-- {dropdown.label} --</option>
              {(dropdownOptions?.[dropdown.name] ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ))}

          {/* Export button */}
          {shouldShowExport && (
            <button
              type="button"
              onClick={onExport}
              aria-label={`Export ${label}`}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={`button-widget-export-${name}`}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          {/* Reload button */}
          {shouldShowReload && (
            <button
              type="button"
              onClick={onReload}
              aria-label={`Reload ${label}`}
              disabled={isLoading}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              data-qqq-id={`button-widget-reload-${name}`}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6" data-qqq-id={`widget-content-${name}`}>
        <WidgetErrorBoundary widgetName={name}>
          {isLoading ? (
            <WidgetSkeleton />
          ) : isError ? (
            <WidgetErrorState error={error} onReload={onReload} widgetName={name} />
          ) : (
            children
          )}
        </WidgetErrorBoundary>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------
// Loading skeleton
// ------------------------------------------------------------------
function WidgetSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading widget">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
      <div className="h-20 w-full rounded bg-muted" />
      <div className="h-4 w-2/3 rounded bg-muted" />
    </div>
  )
}

// ------------------------------------------------------------------
// Error state
// ------------------------------------------------------------------
function WidgetErrorState({
  error,
  onReload,
  widgetName,
}: {
  error: Error | null
  onReload?: () => void
  widgetName: string
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-4 text-center"
      role="alert"
      data-qqq-id={`widget-error-state-${widgetName}`}
    >
      <p className="text-sm text-destructive">
        {error?.message ?? 'Failed to load widget data'}
      </p>
      {onReload && (
        <button
          type="button"
          onClick={onReload}
          className="inline-flex items-center gap-1.5 text-xs text-primary underline hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id={`button-widget-retry-inline-${widgetName}`}
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  )
}
