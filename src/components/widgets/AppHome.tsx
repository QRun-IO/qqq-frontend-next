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
 * @file AppHome — Dashboard page for a QQQ application.
 */
/**
 * AppHome — Dashboard page for a QQQ application.
 *
 * Reads widget names and section navigation items from app metadata and renders
 * the full dashboard: a responsive widget grid followed by table/process shortcuts.
 */
'use client'

import React from 'react'
import Link from 'next/link'
import { Table2, Workflow } from 'lucide-react'

import type { QAppMetaData, QWidgetMetaData } from '@/types'
import { WidgetGrid } from './WidgetGrid'
import type { WidgetGridItem } from './WidgetGrid'
import { ConnectedWidget } from './ConnectedWidget'

/** Props accepted by the AppHome component. */
interface AppHomeProps {
  /** Full metadata for the app whose dashboard is being rendered. */
  appMetaData: QAppMetaData
  /** Map of all known widget metadata objects, keyed by widget name. */
  widgetRegistry: Record<string, QWidgetMetaData>
}

/**
 * Determines the column span a widget should occupy in the dashboard grid.
 *
 * Prefers the explicit `gridColumns` value from widget metadata, and falls back
 * to a type-based heuristic: record-grid and chart widgets get 2 columns, all
 * others get 1 column.
 *
 * @param widgetMeta - Metadata for the widget being measured.
 * @returns Column span value compatible with WidgetGridItem.span (1, 2, or 3).
 */
function resolveWidgetSpan(
  widgetMeta: QWidgetMetaData
): WidgetGridItem['span'] {
  // Prefer the explicit gridColumns from metadata
  if (widgetMeta.gridColumns !== undefined) {
    const cols = widgetMeta.gridColumns
    if (cols >= 3) return 3
    if (cols === 2) return 2
    return 1
  }

  // Fallback heuristic: record grid and chart widgets get 2 columns; stats get 1
  const type = widgetMeta.type
  if (type === 'recordGrid' || type === 'lineChart' || type === 'barChart') return 2
  if (type === 'chart') return 2
  return 1
}

/**
 * Renders the full dashboard for a QQQ app.
 *
 * Displays the app label as a page heading, a responsive 3-column widget grid
 * for any widgets declared in appMetaData.widgets (filtered to those with
 * permission), and navigation shortcut cards for each table and process in
 * appMetaData.sections. Shows an empty-state placeholder when no content is
 * configured.
 *
 * @param props - Component properties.
 * @returns The rendered app home dashboard.
 */
export function AppHome({ appMetaData, widgetRegistry }: AppHomeProps) {
  const { name, label, widgets: widgetNames, sections } = appMetaData

  // Build the widget grid items from declared widget names
  const widgetItems: WidgetGridItem[] = widgetNames.flatMap((wName) => {
    const meta = widgetRegistry[wName]
    if (!meta || !meta.hasPermission) return []
    return [{
      key: wName,
      span: resolveWidgetSpan(meta),
      children: <ConnectedWidget key={wName} widgetMetaData={meta} />,
    }]
  })

  return (
    <div className="space-y-6" data-qqq-id={`app-home-${name}`}>
      {/* App heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{label}</h1>
        <p className="text-sm text-muted-foreground">Welcome to your {label} dashboard</p>
      </div>

      {/* Widget grid */}
      {widgetItems.length > 0 && (
        <section aria-label="Dashboard widgets">
          <WidgetGrid items={widgetItems} columns={3} />
        </section>
      )}

      {/* App sections -- navigation shortcuts to tables / processes */}
      {sections && sections.length > 0 && (
        <div className="space-y-6" data-qqq-id={`app-sections-${name}`}>
          {sections.map((section) => (
            <section
              key={section.name}
              aria-label={section.label}
              data-qqq-id={`app-section-${section.name}`}
            >
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                {section.label}
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {section.tables.map((tableName) => (
                  <Link
                    key={tableName}
                    href={`/app/${tableName}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                    data-qqq-id={`app-section-table-${tableName}`}
                  >
                    <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {tableName}
                  </Link>
                ))}
                {section.processes.map((processName) => (
                  <Link
                    key={processName}
                    href={`/app/${processName}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground transition-colors hover:border-accent-foreground/30 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    data-qqq-id={`app-section-process-${processName}`}
                  >
                    <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {processName}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Empty state when no widgets and no sections */}
      {widgetItems.length === 0 && (!sections || sections.every((s) => s.tables.length === 0 && s.processes.length === 0)) && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center"
          data-qqq-id={`app-home-empty-${name}`}
        >
          <p className="text-muted-foreground">
            No dashboard content configured for this app
          </p>
        </div>
      )}
    </div>
  )
}
