/**
 * WidgetRenderer — Master type dispatcher for dashboard widgets.
 *
 * Receives widget metadata and raw API data, resolves the widget type from
 * metadata.type (falling back to data.type), and renders the appropriate
 * typed widget component. For the generic 'chart' type, a secondary dispatch
 * on chartType selects the correct chart variant.
 */
'use client'

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
import { CompositeWidget } from './CompositeWidget'
import type { CompositeWidgetProps } from './CompositeWidget'

/** Props accepted by the WidgetRenderer component. */
interface WidgetRendererProps {
  /** Widget metadata providing the type discriminator, name, and label. */
  widgetMetaData: QWidgetMetaData
  /** Raw API response data whose shape depends on the resolved widget type. */
  data: unknown
}

/**
 * Resolves the widget type and renders the matching typed widget component.
 *
 * Type resolution order: metadata.type → data.type. Renders an "unknown widget
 * type" placeholder when no matching case is found in the switch statement.
 * The 'chart' type delegates further dispatch to ChartTypeDispatcher using the
 * `chartType` field from the data payload.
 *
 * @param widgetMetaData - Widget metadata containing the type discriminator and widget name.
 * @param data - Untyped API response; cast to the appropriate typed payload per matched case.
 */
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

    case 'block':
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

    case 'composite':
    case 'parent': {
      const compositeData = data as { childWidgets?: CompositeWidgetProps['childWidgets'] }
      return (
        <CompositeWidget
          widgetMetaData={widgetMetaData}
          childWidgets={compositeData.childWidgets ?? []}
        />
      )
    }

    // The existing mock data uses 'chart' type with chartType discriminator
    case 'chart':
      return <ChartTypeDispatcher data={data} widgetName={name} />

    default:
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 py-6 text-center"
          data-qqq-id={`widget-unknown-${name}`}
        >
          <p className="text-sm text-muted-foreground">
            Unknown widget type:{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              {String(resolvedType ?? 'unknown')}
            </code>
          </p>
        </div>
      )
  }
}

/** Props accepted by the internal ChartTypeDispatcher helper. */
interface ChartTypeDispatcherProps {
  /** Raw API response data containing a `chartType` discriminator field. */
  data: unknown
  /** Widget name forwarded to the resolved chart component for data-qqq-id scoping. */
  widgetName: string
}

/**
 * Secondary dispatcher for widgets whose top-level type is 'chart'.
 *
 * Reads the `chartType` field from the data payload and renders the appropriate
 * chart component: 'bar' → BarChartWidget, 'line'/'area' → LineChartWidget,
 * 'pie'/'donut' → PieChartWidget. Falls back to BarChartWidget for unknown values.
 * Returns null when `data` is not a plain object.
 *
 * @param data - Raw widget data payload expected to contain a `chartType` string.
 * @param widgetName - Widget name forwarded to the selected chart component.
 */
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

/**
 * Type guard that returns true when value is a non-null, non-array plain object.
 *
 * @param value - Any runtime value to test.
 * @returns True if value is a Record-compatible plain object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
