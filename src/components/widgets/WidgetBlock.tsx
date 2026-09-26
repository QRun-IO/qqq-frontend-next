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
 * @file WidgetBlock — standard chrome for every dashboard and record widget.
 *
 * Renders the widget card (or plain container when `isCard` is false) with its
 * header — label (or the payload's label override), sublabel, icons, tooltip,
 * help, dropdown controls, export and reload buttons — and a body that shows a
 * loading skeleton, the error state, the permission message, the "please select"
 * message for required dropdowns, or the widget content; then the footer HTML.
 */
'use client'

import React from 'react'
import { AlertCircle, Download, HelpCircle, RefreshCw } from 'lucide-react'

import type { QWidgetHelpContent, QWidgetMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'
import { HoverTooltip } from './HoverTooltip'
import { SafeHtml } from './SafeHtml'
import { WidgetErrorBoundary } from './WidgetErrorBoundary'
import { WidgetIcon } from './WidgetIcon'

/** One dropdown control resolved from the widget payload and metadata. */
export interface WidgetDropdownControl {
  /** Query parameter the selection is sent under. */
  paramName: string
  /** Dropdown label (the control is labelled `Select <label>`). */
  label: string
  /** Control kind. */
  type: 'POSSIBLE_VALUE_SOURCE' | 'DATE_PICKER'
  /** Options for possible-value dropdowns. */
  options: Array<{ id: string; label: string }>
  /** Currently selected option id or ISO date, or null. */
  value: string | null
  /** Label of an explicit "no selection" option. */
  labelForNullValue?: string
}

/** Common payload fields every QQQ widget may carry. */
export interface WidgetChromeData {
  label?: string
  sublabel?: string
  footerHTML?: string
  hasPermission?: boolean
  dropdownNeedsSelectedText?: string
}

/** Props accepted by the WidgetBlock container component. */
interface WidgetBlockProps {
  /** Widget metadata (label, tooltip, icons, help, card and button flags). */
  widgetMetaData: QWidgetMetaData
  /** The widget payload, for label/sublabel/footer overrides and permission/selection messages. */
  data?: WidgetChromeData
  /** True during the first load (no data yet). */
  isLoading?: boolean
  /** True while re-fetching with data already shown. */
  isFetching?: boolean
  /** True when the widget data request failed. */
  isError?: boolean
  /** The request failure. */
  error?: Error | null
  /** Re-fetch callback for the reload and retry buttons. */
  onReload?: () => void
  /** Export callback; the button shows when metadata enables export. */
  onExport?: () => void
  /** Status text from the last export attempt (e.g. nothing to export). */
  exportMessage?: string | null
  /** Dropdown controls resolved from the payload. */
  dropdowns?: WidgetDropdownControl[]
  /** Called with a dropdown's parameter name and the new selection (null to clear). */
  onDropdownChange?: (paramName: string, selection: { id: string; label: string } | null) => void
  /** Widget content. */
  children: React.ReactNode
  /** Extra classes for the outer element. */
  className?: string
  /** Renders only the body (no chrome), e.g. for tab panels. */
  bare?: boolean
}

/**
 * Normalizes the two help-content shapes (a single `{content}` or the full-route
 * slot map) to the `label` slot's HTML/text entries.
 *
 * @param helpContent - Metadata help content.
 * @returns Help entries for the label slot.
 */
function labelHelp(helpContent: QWidgetMetaData['helpContent']): QWidgetHelpContent[] {
  if (!helpContent) return []
  if ('content' in helpContent && typeof helpContent.content === 'string') return [{ content: helpContent.content, format: 'TEXT' }]
  const slot = (helpContent as Record<string, QWidgetHelpContent[]>).label
  return Array.isArray(slot) ? slot.filter((entry) => typeof entry?.content === 'string') : []
}

/**
 * Renders the widget chrome around `children`.
 *
 * @param props - See {@link WidgetBlockProps}.
 * @returns The widget section.
 */
export function WidgetBlock({
  widgetMetaData, data, isLoading = false, isFetching = false, isError = false, error = null, onReload, onExport,
  exportMessage, dropdowns, onDropdownChange, children, className, bare = false,
}: WidgetBlockProps) {
  const { name } = widgetMetaData
  const label = data?.label ?? widgetMetaData.label
  const isCard = widgetMetaData.isCard !== false
  const help = labelHelp(widgetMetaData.helpContent)
  const footer = data?.footerHTML ?? widgetMetaData.footerHTML
  const topLeft = widgetMetaData.icons?.topLeftInsideCard
  const topRight = widgetMetaData.icons?.topRightInsideCard
  const deniedByData = data?.hasPermission === false

  const body = (
    <WidgetErrorBoundary widgetName={name}>
      {isLoading ? (
        <WidgetSkeleton />
      ) : isError ? (
        <WidgetErrorState error={error} onReload={onReload} widgetName={name} />
      ) : deniedByData ? (
        <p className="py-4 text-center text-sm text-muted-foreground" data-qqq-id={`widget-no-permission-${name}`}>
          You do not have permission to view this data.
        </p>
      ) : data?.dropdownNeedsSelectedText ? (
        <p className="py-2 text-right text-sm text-muted-foreground" data-qqq-id={`widget-needs-selection-${name}`}>
          {data.dropdownNeedsSelectedText}
        </p>
      ) : (
        children
      )}
    </WidgetErrorBoundary>
  )

  if (bare) {
    return <div data-qqq-id={`widget-content-${name}`}>{body}</div>
  }

  const labelElement = label ? (
    <h3 className="text-base font-semibold text-card-foreground" data-qqq-id={`widget-label-${name}`}>{label}</h3>
  ) : null

  return (
    <section
      className={cn('flex h-full flex-col', isCard ? 'rounded-xl border border-border bg-card shadow-sm' : 'bg-transparent', className)}
      data-qqq-id={`widget-${name}`}
      data-widget-type={widgetMetaData.type}
      aria-label={label || widgetMetaData.name}
      aria-busy={isLoading || isFetching}
      style={widgetMetaData.minHeight ? { minHeight: widgetMetaData.minHeight } : undefined}
    >
      <div className={cn('flex flex-wrap items-start justify-between gap-2', isCard ? 'px-5 pt-4' : 'pb-2')}>
        <div className="flex min-w-0 items-center gap-2">
          {topLeft?.name && (
            <WidgetIcon name={topLeft.name} color={topLeft.color} className="h-7 w-7 rounded p-1 text-lg" qqqId={`widget-icon-topLeftInsideCard-${name}`} />
          )}
          <div className="min-w-0">
            {labelElement && (widgetMetaData.tooltip
              ? <HoverTooltip content={widgetMetaData.tooltip} qqqId={`widget-tooltip-${name}`}>{labelElement}</HoverTooltip>
              : labelElement)}
            {data?.sublabel && (
              <p className="text-xs text-muted-foreground" data-qqq-id={`widget-sublabel-${name}`}>{data.sublabel}</p>
            )}
          </div>
          {help.length > 0 && (
            <HoverTooltip
              qqqId={`widget-help-${name}`}
              content={help.map((entry, index) => entry.format === 'HTML'
                ? <SafeHtml key={index} html={entry.content ?? ''} as="span" />
                : <span key={index}>{entry.content}</span>)}
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" aria-label={`Help for ${label}`} data-qqq-id={`button-widget-help-${name}`} />
            </HoverTooltip>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dropdowns?.map((dropdown) => dropdown.type === 'DATE_PICKER' ? (
            <input
              key={dropdown.paramName}
              type="date"
              value={dropdown.value ?? ''}
              onChange={(event) => onDropdownChange?.(dropdown.paramName, event.target.value ? { id: event.target.value, label: event.target.value } : null)}
              aria-label={`Select ${dropdown.label}`}
              className="rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={`widget-dropdown-${name}-${dropdown.paramName}`}
            />
          ) : (
            <select
              key={dropdown.paramName}
              value={dropdown.value ?? ''}
              onChange={(event) => {
                const option = dropdown.options.find((candidate) => candidate.id === event.target.value)
                onDropdownChange?.(dropdown.paramName, option ?? null)
              }}
              aria-label={`Select ${dropdown.label}`}
              className="max-w-[16rem] rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:h-11"
              data-qqq-id={`widget-dropdown-${name}-${dropdown.paramName}`}
            >
              <option value="">{dropdown.labelForNullValue ?? `Select ${dropdown.label}`}</option>
              {dropdown.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          ))}

          {widgetMetaData.showExportButton && onExport && (
            <button
              type="button"
              onClick={onExport}
              aria-label={`Export ${label}`}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={`button-widget-export-${name}`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {widgetMetaData.showReloadButton && onReload && (
            <button
              type="button"
              onClick={onReload}
              aria-label={`Reload ${label}`}
              disabled={isLoading || isFetching}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              data-qqq-id={`button-widget-reload-${name}`}
            >
              <RefreshCw className={cn('h-4 w-4', (isLoading || isFetching) && 'animate-spin')} aria-hidden="true" />
            </button>
          )}

          {topRight?.name && (
            <WidgetIcon name={topRight.name} color={topRight.color} className="h-7 w-7 rounded p-1 text-lg" qqqId={`widget-icon-topRightInsideCard-${name}`} />
          )}
        </div>
      </div>

      {exportMessage && (
        <p role="status" className="px-5 pt-2 text-sm text-muted-foreground" data-qqq-id={`widget-export-message-${name}`}>{exportMessage}</p>
      )}

      <div className={cn('flex-1', isCard ? 'p-5 pt-3' : 'pt-1')} data-qqq-id={`widget-content-${name}`}>
        {body}
      </div>

      {footer && !isError && (
        <SafeHtml html={footer} className={cn('text-sm text-muted-foreground', isCard ? 'px-5 pb-4' : 'pt-2')} qqqId={`widget-footer-${name}`} />
      )}
    </section>
  )
}

/**
 * Pulse skeleton shown while widget data loads.
 *
 * @returns The skeleton.
 */
function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-3" role="status" aria-label="Loading widget">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
      <div className="h-20 w-full rounded bg-muted" />
    </div>
  )
}

/**
 * Error state for a failed widget data request, with a retry button.
 *
 * @param props - Error state properties.
 * @param props.error - The failure; its message is shown as detail.
 * @param props.onReload - Retry callback.
 * @param props.widgetName - Widget name for `data-qqq-id` scoping.
 * @returns The error state.
 */
function WidgetErrorState({ error, onReload, widgetName }: { error: Error | null; onReload?: () => void; widgetName: string }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 p-4 text-center text-sm" data-qqq-id={`widget-error-${widgetName}`}>
      <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      <p className="font-medium text-foreground">An error occurred loading widget content.</p>
      {error?.message && <p className="text-xs text-muted-foreground" data-qqq-id={`widget-error-detail-${widgetName}`}>{error.message}</p>}
      {onReload && (
        <button
          type="button"
          onClick={onReload}
          className="text-xs text-primary underline hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id={`button-widget-retry-inline-${widgetName}`}
        >
          Retry
        </button>
      )}
    </div>
  )
}
