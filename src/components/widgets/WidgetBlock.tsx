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
 * header — main icon tile, label (or the payload's label override, as the page title
 * for a parent widget that asks for it), sublabel, header icons, tooltip, help,
 * dropdown controls, export and reload buttons, and the collapse toggle of a
 * collapsible widget — and a body that shows a loading skeleton, the error state, the
 * permission message, the "please select" message for required dropdowns, or the
 * widget content; then the footer HTML.
 */
'use client'

import React, { useId, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp, Download, HelpCircle, RefreshCw } from 'lucide-react'

import type { QHelpContent, QWidgetMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'
import { useCompositeHost } from './blocks/composite-host'
import { useHelpHelpActive } from '@/lib/context/q-context'
import { WIDGET_HELP_ROLES } from '@/lib/utils/help-utils'
import { HelpContent } from '@/components/records/HelpContent'
import { HoverTooltip } from './HoverTooltip'
import { SafeHtml } from './SafeHtml'
import { WidgetDropdownMenu } from './WidgetDropdownMenu'
import type { WidgetDropdownControl } from './WidgetDropdownMenu'
import { WidgetErrorBoundary } from './WidgetErrorBoundary'
import { WidgetIconTile } from './WidgetIcon'
import { WidgetMetaDataContext } from './widget-context'
import { widgetSlotHelp } from './widget-utils'

export type { WidgetDropdownControl } from './WidgetDropdownMenu'

/** Local-storage key root of a collapsible widget's open state (shared with Material). */
export const WIDGET_COLLAPSIBLE_STORAGE_ROOT = 'qqq.widget.collapsibleOpenState'

/**
 * Whether a collapsible widget starts open: its remembered state, else `initiallyOpen`
 * (Material `getInitialCollapsibleOpenState`). A widget that is not collapsible is open.
 *
 * @param widgetMetaData - Widget metadata.
 * @returns The initial open state.
 */
export function initialCollapsibleOpenState(widgetMetaData: QWidgetMetaData): boolean {
  if (!widgetMetaData.collapsible?.isCollapsible) return true
  try {
    const stored = window.localStorage.getItem(`${WIDGET_COLLAPSIBLE_STORAGE_ROOT}.${widgetMetaData.name}`)
    if (stored !== null) return stored === 'true'
  } catch {
    // storage unavailable: use the metadata default
  }
  return widgetMetaData.collapsible.initiallyOpen === true
}

/** Common payload fields every QQQ widget may carry. */
export interface WidgetChromeData {
  label?: string
  sublabel?: string
  footerHTML?: string
  hasPermission?: boolean
  dropdownNeedsSelectedText?: string
  /** A parent widget whose label is the page title (Material `isLabelPageTitle`). */
  isLabelPageTitle?: boolean
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
  /** Specialized export control rendered in the existing header position. */
  exportControl?: React.ReactNode
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
  /** Hides the header reload control even when metadata enables it (Material `showReloadControl={false}` for process widgets). */
  hideReload?: boolean
}

/**
 * Renders the widget chrome around `children`.
 *
 * @param props - See {@link WidgetBlockProps}.
 * @returns The widget section.
 */
export function WidgetBlock({
  widgetMetaData, data, isLoading = false, isFetching = false, isError = false, error = null, onReload, onExport,
  exportMessage, exportControl, dropdowns, onDropdownChange, children, className, bare = false, hideReload = false,
}: WidgetBlockProps) {
  const { name } = widgetMetaData
  const bodyId = useId()
  const isCard = widgetMetaData.isCard !== false
  const processHost = useCompositeHost()
  const compact = Boolean(processHost) && !isCard
  const helpHelpActive = useHelpHelpActive()
  const help = widgetSlotHelp(widgetMetaData, 'label', WIDGET_HELP_ROLES, helpHelpActive) as QHelpContent | undefined
  const footer = data?.footerHTML ?? widgetMetaData.footerHTML
  const topLeft = widgetMetaData.icons?.topLeftInsideCard
  const topRight = widgetMetaData.icons?.topRightInsideCard
  const deniedByData = data?.hasPermission === false

  // Collapsible widgets (Material `collapsible`): the header toggles the body; the state is remembered.
  const isCollapsible = widgetMetaData.collapsible?.isCollapsible === true
  const [open, setOpen] = useState(() => initialCollapsibleOpenState(widgetMetaData))
  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      window.localStorage.setItem(`${WIDGET_COLLAPSIBLE_STORAGE_ROOT}.${name}`, String(next))
    } catch {
      // storage is a convenience
    }
  }

  // A parent widget may use its label as the page title, and keeps the last label it showed
  // while a reload briefly has none (Material `isLabelPageTitle`).
  const isParentWidget = widgetMetaData.type === 'parentWidget'
  const lastLabel = useRef<{ label: string; asTitle: boolean } | null>(null)
  let label = data?.label ?? widgetMetaData.label
  if (label && label !== lastLabel.current?.label) lastLabel.current = { label, asTitle: data?.isLabelPageTitle === true }
  if (!label && isParentWidget && lastLabel.current?.asTitle) label = lastLabel.current.label
  const labelAsTitle = isParentWidget && (data?.isLabelPageTitle === true || (lastLabel.current?.asTitle === true && label === lastLabel.current.label))

  const body = (
    <WidgetMetaDataContext.Provider value={widgetMetaData}>
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
    </WidgetMetaDataContext.Provider>
  )

  if (bare) {
    return <div data-qqq-id={`widget-content-${name}`}><WidgetErrorBoundary widgetName={name} onRetry={onReload} resetKey={data}>{body}</WidgetErrorBoundary></div>
  }

  const labelElement = label ? (labelAsTitle ? (
    <h2 className="text-2xl font-bold tracking-tight text-card-foreground" data-qqq-id={`widget-label-${name}`} data-page-title="true">{label}</h2>
  ) : (
    <h3 className={cn('font-semibold text-card-foreground', compact ? 'text-sm' : 'text-base')} data-qqq-id={`widget-label-${name}`}>{label}</h3>
  )) : null

  /**
   * A click on the header bar (not on one of its controls) toggles a collapsible widget,
   * as in Material; the chevron button is the keyboard and screen-reader control.
   *
   * @param event - The click.
   */
  const onHeaderClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isCollapsible) return
    const target = event.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, [role="combobox"], [role="listbox"]')) return
    toggle()
  }

  const canExport = open && widgetMetaData.showExportButton && !isLoading && !isError && !deniedByData
  const renderedWidget = (
    <section
      className={cn(
        'flex flex-col',
        open && 'h-full',
        isCard ? 'rounded-xl border border-border bg-card shadow-sm' : 'bg-transparent',
        widgetMetaData.icon && 'mt-6',
        className,
      )}
      data-qqq-id={`widget-${name}`}
      data-widget-type={widgetMetaData.type}
      data-collapsed={isCollapsible ? String(!open) : undefined}
      aria-label={label || widgetMetaData.name}
      aria-busy={isLoading || isFetching}
      style={widgetMetaData.minHeight && open ? { minHeight: widgetMetaData.minHeight } : undefined}
    >
      <div
        className={cn('flex flex-wrap items-start justify-between gap-2', isCard ? 'px-5 pt-4' : compact ? undefined : 'pb-2', isCard && !open && 'pb-4', isCollapsible && 'cursor-pointer')}
        onClick={onHeaderClick}
        data-qqq-id={`widget-header-${name}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {widgetMetaData.icon && (
            <WidgetIconTile name={widgetMetaData.icon} className="-mt-9 mr-2 h-16 w-16 rounded-lg text-2xl shadow-md" qqqId={`widget-main-icon-${name}`} />
          )}
          {open && (topLeft?.name || topLeft?.path) && (
            <WidgetIconTile name={topLeft.name} path={topLeft.path} color={topLeft.color} filled={false} qqqId={`widget-icon-topLeftInsideCard-${name}`} />
          )}
          <div className="min-w-0">
            {labelElement && (widgetMetaData.tooltip
              ? <HoverTooltip content={widgetMetaData.tooltip} qqqId={`widget-tooltip-${name}`}>{labelElement}</HoverTooltip>
              : labelElement)}
            {data?.sublabel && (
              <p className="text-xs text-muted-foreground" data-qqq-id={`widget-sublabel-${name}`}>{data.sublabel}</p>
            )}
          </div>
          {help && (
            <HoverTooltip qqqId={`widget-help-${name}`} content={<HelpContent helpContent={help} />}>
              <HelpCircle className="h-4 w-4 text-muted-foreground" aria-label={`Help for ${label}`} data-qqq-id={`button-widget-help-${name}`} />
            </HoverTooltip>
          )}
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-2">
          {open && dropdowns?.map((dropdown) => (
            <WidgetDropdownMenu
              key={dropdown.paramName}
              widgetName={name}
              control={dropdown}
              onChange={(selection) => onDropdownChange?.(dropdown.paramName, selection)}
            />
          ))}

          {canExport && !data?.dropdownNeedsSelectedText && exportControl}
          {canExport && !exportControl && onExport && (
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

          {open && widgetMetaData.showReloadButton && onReload && !hideReload && (
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

          {open && (topRight?.name || topRight?.path) && (
            <WidgetIconTile name={topRight.name} path={topRight.path} color={topRight.color} filled={false} qqqId={`widget-icon-topRightInsideCard-${name}`} />
          )}

          {isCollapsible && (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={bodyId}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${label || name}`}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              data-qqq-id={`button-widget-collapse-${name}`}
            >
              {open ? <ChevronUp className="h-6 w-6" aria-hidden="true" /> : <ChevronDown className="h-6 w-6" aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>

      {open && exportMessage && (
        <p role="status" className="px-5 pt-2 text-sm text-muted-foreground" data-qqq-id={`widget-export-message-${name}`}>{exportMessage}</p>
      )}

      <div id={bodyId} className={cn('flex-1', isCard ? 'p-5 pt-3' : compact ? undefined : 'pt-1')} hidden={!open} data-qqq-id={`widget-content-${name}`}>
        {open && body}
      </div>

      {open && footer && !isError && (
        <SafeHtml html={footer} className={cn('text-sm text-muted-foreground', isCard ? 'px-5 pb-4' : 'pt-2')} qqqId={`widget-footer-${name}`} />
      )}
    </section>
  )
  return <WidgetErrorBoundary widgetName={name} onRetry={onReload} resetKey={data}>{renderedWidget}</WidgetErrorBoundary>
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
