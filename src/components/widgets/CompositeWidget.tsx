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
 * @file CompositeWidget — Renders a parent widget that lays out multiple child widgets.
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
 * Dispatched by `WidgetRenderer` for `'composite'` and `'parent'`-type widgets.
 * Column count is derived from `widgetMetaData.gridColumns` (defaults to 2);
 * supported values are 1, 2, 3, and 4+ (which maps to a `lg:grid-cols-4` grid).
 * Each child is rendered as a `ConnectedWidget` so data is fetched independently.
 * Shows an empty-state message when `childWidgets` is empty.
 *
 * @param props - Component properties; `widgetMetaData.gridColumns` sets the
 *   column count, and `childWidgets` provides the ordered child descriptor array.
 * @returns A CSS grid `<div>` containing one `ConnectedWidget` per child, or an
 *   empty-state `<p>` when no children are configured.
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
