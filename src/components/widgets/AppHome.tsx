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
    <div className="space-y-8" data-qqq-id={`app-home-${name}`}>
      {/* App label */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{label}</h1>
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
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {section.label}
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {section.tables.map((tableName) => (
                  <Link
                    key={tableName}
                    href={`/app/${tableName}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-600 dark:hover:bg-blue-950/20 dark:hover:text-blue-400"
                    data-qqq-id={`app-section-table-${tableName}`}
                  >
                    <Table2 className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    {tableName}
                  </Link>
                ))}
                {section.processes.map((processName) => (
                  <Link
                    key={processName}
                    href={`/app/${processName}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-purple-600 dark:hover:bg-purple-950/20 dark:hover:text-purple-400"
                    data-qqq-id={`app-section-process-${processName}`}
                  >
                    <Workflow className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
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
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center dark:border-gray-700 dark:bg-gray-800/30"
          data-qqq-id={`app-home-empty-${name}`}
        >
          <p className="text-gray-500 dark:text-gray-400">
            No dashboard content configured for this app
          </p>
        </div>
      )}
    </div>
  )
}
