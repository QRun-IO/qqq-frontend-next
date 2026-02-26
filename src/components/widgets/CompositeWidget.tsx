'use client'

// CompositeWidget -- Renders a parent widget that contains child widgets
// Each child is wrapped in its own ConnectedWidget for independent data fetching

import React from 'react'

import type { QWidgetMetaData } from '@/types'
import { ConnectedWidget } from './ConnectedWidget'

interface CompositeWidgetChild {
  widgetMetaData: QWidgetMetaData
  params?: Record<string, string | number | boolean>
}

export interface CompositeWidgetProps {
  widgetMetaData: QWidgetMetaData
  childWidgets: CompositeWidgetChild[]
}

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
