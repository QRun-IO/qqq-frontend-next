'use client'

// WidgetRenderer — Master dispatcher: receives widget metadata + data, renders the right component

import React from 'react'

import type { QWidgetMetaData } from '@/types'
import { StatisticsWidget } from './StatisticsWidget'
import type { StatisticsWidgetPayload } from './StatisticsWidget'
import { BarChartWidget } from './BarChartWidget'
import type { BarChartWidgetPayload } from './BarChartWidget'
import { LineChartWidget } from './LineChartWidget'
import type { LineChartWidgetPayload } from './LineChartWidget'
import { PieChartWidget } from './PieChartWidget'
import type { PieChartWidgetPayload } from './PieChartWidget'
import { RecordGridWidget } from './RecordGridWidget'
import type { RecordGridWidgetPayload } from './RecordGridWidget'
import { BlockWidget } from './BlockWidget'
import type { BlockWidgetPayload } from './BlockWidget'
import { DividerWidget } from './DividerWidget'
import type { DividerWidgetPayload } from './DividerWidget'
import { QuickLinksWidget } from './QuickLinksWidget'
import type { QuickLinksWidgetPayload } from './QuickLinksWidget'
import { AlertWidget } from './AlertWidget'
import type { AlertWidgetPayload } from './AlertWidget'
import { ProcessSummaryWidget } from './ProcessSummaryWidget'
import type { ProcessSummaryWidgetPayload } from './ProcessSummaryWidget'

interface WidgetRendererProps {
  widgetMetaData: QWidgetMetaData
  data: unknown
}

export function WidgetRenderer({ widgetMetaData, data }: WidgetRendererProps) {
  const { name, type } = widgetMetaData

  // Determine widget type from metadata.type, or fall back to data.type
  const resolvedType = type ?? (isObject(data) ? (data as Record<string, unknown>).type : null)

  switch (resolvedType) {
    case 'statistics':
      return (
        <StatisticsWidget
          data={data as StatisticsWidgetPayload}
          widgetName={name}
        />
      )

    case 'barChart':
      return (
        <BarChartWidget
          data={data as BarChartWidgetPayload}
          widgetName={name}
        />
      )

    case 'lineChart':
      return (
        <LineChartWidget
          data={data as LineChartWidgetPayload}
          widgetName={name}
        />
      )

    case 'pieChart':
      return (
        <PieChartWidget
          data={data as PieChartWidgetPayload}
          widgetName={name}
        />
      )

    case 'recordGrid':
      return (
        <RecordGridWidget
          data={data as RecordGridWidgetPayload}
          widgetName={name}
        />
      )

    case 'html':
      return (
        <BlockWidget
          data={data as BlockWidgetPayload}
          widgetName={name}
        />
      )

    case 'divider':
      return (
        <DividerWidget
          data={data as DividerWidgetPayload}
          widgetName={name}
        />
      )

    case 'quickLinks':
      return (
        <QuickLinksWidget
          data={data as QuickLinksWidgetPayload}
          widgetName={name}
        />
      )

    case 'alert':
      return (
        <AlertWidget
          data={data as AlertWidgetPayload}
          widgetName={name}
        />
      )

    case 'processSummary':
      return (
        <ProcessSummaryWidget
          data={data as ProcessSummaryWidgetPayload}
          widgetName={name}
        />
      )

    // The existing mock data uses 'chart' type with chartType discriminator
    case 'chart':
      return <ChartTypeDispatcher data={data} widgetName={name} />

    default:
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 py-6 text-center"
          data-qqq-id={`widget-unknown-${name}`}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Unknown widget type:{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs dark:bg-gray-800">
              {String(resolvedType ?? 'unknown')}
            </code>
          </p>
        </div>
      )
  }
}

// ------------------------------------------------------------------
// Internal: dispatches 'chart' type by chartType discriminator
// ------------------------------------------------------------------
interface ChartTypeDispatcherProps {
  data: unknown
  widgetName: string
}

function ChartTypeDispatcher({ data, widgetName }: ChartTypeDispatcherProps) {
  if (!isObject(data)) {
    return null
  }
  const chartType = (data as Record<string, unknown>).chartType

  switch (chartType) {
    case 'bar':
      return <BarChartWidget data={data as unknown as BarChartWidgetPayload} widgetName={widgetName} />
    case 'line':
    case 'area':
      return <LineChartWidget data={data as unknown as LineChartWidgetPayload} widgetName={widgetName} />
    case 'pie':
    case 'donut':
      return <PieChartWidget data={data as unknown as PieChartWidgetPayload} widgetName={widgetName} />
    default:
      return <BarChartWidget data={data as unknown as BarChartWidgetPayload} widgetName={widgetName} />
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
