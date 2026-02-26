'use client'

// AppHome -- Dashboard page for an app
// Fetches and renders all widgets declared in the app metadata

import React from 'react'
import Link from 'next/link'
import { Table2, Workflow } from 'lucide-react'

import type { QAppMetaData, QWidgetMetaData } from '@/types'
import { WidgetGrid } from './WidgetGrid'
import type { WidgetGridItem } from './WidgetGrid'
import { ConnectedWidget } from './ConnectedWidget'

interface AppHomeProps {
  appMetaData: QAppMetaData
  widgetRegistry: Record<string, QWidgetMetaData>
}

// Resolve widget span from metadata gridColumns, falling back to heuristic
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
