/**
 * CompositeWidget — Renders a parent widget that lays out multiple child widgets.
 *
 * Each child is wrapped in its own ConnectedWidget so that each widget fetches
 * its data independently. Column count derives from the parent widget's
 * gridColumns metadata field.
 */
'use client'

import React from 'react'

import type { QWidgetMetaData } from '@/types'
import { ConnectedWidget } from './ConnectedWidget'

/** Descriptor for a single child widget inside a composite parent widget. */
interface CompositeWidgetChild {
  /** Metadata for the child widget to render. */
  widgetMetaData: QWidgetMetaData
  /** Optional extra query parameters forwarded to the child widget's data fetch. */
  params?: Record<string, string | number | boolean>
}

/** Props accepted by the CompositeWidget component. */
export interface CompositeWidgetProps {
  /** Metadata for the parent composite widget, used for naming and column count. */
  widgetMetaData: QWidgetMetaData
  /** Ordered array of child widget descriptors to lay out in the grid. */
  childWidgets: CompositeWidgetChild[]
}

/**
 * Renders a responsive grid of child ConnectedWidgets within a parent composite container.
 *
 * Column count is derived from `widgetMetaData.gridColumns` (defaults to 2).
 * Shows an empty-state message when no child widgets are configured.
 *
 * @param widgetMetaData - Metadata for the parent widget (label, name, gridColumns).
 * @param childWidgets - Array of child widget descriptors to render.
 */
export function CompositeWidget({ widgetMetaData, childWidgets }: CompositeWidgetProps) {
  if (childWidgets.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-qqq-id={`composite-widget-empty-${widgetMetaData.name}`}
      >
        No child widgets configured
      </p>
    )
  }

  // Use gridColumns from parent metadata to determine column count, default to 2
  const columns = widgetMetaData.gridColumns ?? 2
  const gridColsClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : columns === 3
          ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'

  return (
    <div
      className={`grid gap-4 ${gridColsClass}`}
      data-qqq-id={`composite-widget-${widgetMetaData.name}`}
      aria-label={`${widgetMetaData.label} child widgets`}
    >
      {childWidgets.map((child) => (
        <ConnectedWidget
          key={child.widgetMetaData.name}
          widgetMetaData={child.widgetMetaData}
          params={child.params}
        />
      ))}
    </div>
  )
}
