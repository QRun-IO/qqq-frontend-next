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
 * @file WidgetRenderer — Master type dispatcher for dashboard and record widgets.
 *
 * Resolves the widget type from `metadata.type` (falling back to the payload's
 * `type`, e.g. an untyped widget whose renderer emits `chart`) and renders the
 * matching component for every canonical QQQ `WidgetType`:
 * alert, barChart, chart, divider, fieldValueList, generic, horizontalBarChart,
 * html, lineChart, smallLineChart, location, multiStatistics, multiTable,
 * pieChart, quickSightChart, statistics, stackedBarChart, stepper, table, usaMap,
 * process, parentWidget, composite, childRecordList, customComponent, cronUI,
 * dynamicForm, dataBagViewer, pivotTableSetup, filterAndColumnsSetup, rowBuilder,
 * scriptViewer — plus the demo shapes (recordGrid, quickLinks, processSummary,
 * block, parent) used by the mocked development API.
 *
 * Chart components are loaded lazily so Recharts is split out of the initial bundle.
 */
'use client'

import React, { lazy, Suspense } from 'react'

import type { QWidgetMetaData } from '@/types'
import type { BlockActionCallback, QqqChartPayload, QqqCompositeData, WidgetRecordContext } from './widget-types'
import { isPlainObject } from './widget-types'
import { StatisticsWidget } from './StatisticsWidget'
import type { StatisticsWidgetPayload } from './StatisticsWidget'
import type { BarChartWidgetPayload } from './BarChartWidget'
import type { LineChartWidgetPayload } from './LineChartWidget'
import type { PieChartWidgetPayload } from './PieChartWidget'
import type { QqqChartVariant } from './QqqChartWidget'
import { RecordGridWidget } from './RecordGridWidget'
import type { RecordGridWidgetPayload } from './RecordGridWidget'
import { BlockWidget } from './BlockWidget'
import type { BlockWidgetPayload } from './BlockWidget'
import { DividerWidget } from './DividerWidget'
import { QuickLinksWidget } from './QuickLinksWidget'
import type { QuickLinksWidgetPayload } from './QuickLinksWidget'
import { AlertWidget } from './AlertWidget'
import type { AlertWidgetPayload } from './AlertWidget'
import { ProcessSummaryWidget } from './ProcessSummaryWidget'
import type { ProcessSummaryWidgetPayload } from './ProcessSummaryWidget'
import { CompositeWidget } from './CompositeWidget'
import type { CompositeWidgetProps } from './CompositeWidget'
import { QqqComposite } from './blocks/QqqComposite'
import { MultiStatisticsWidget, QqqStatisticsWidget } from './QqqStatisticsWidgets'
import { QqqMultiTableWidget, QqqTableWidget } from './QqqTableWidget'
import {
  QqqAlertWidget, QqqFieldValueListWidget, QqqGenericWidget, QqqHtmlWidget, QqqLocationWidget, QqqQuickSightWidget,
  QqqStepperWidget, QqqUsaMapWidget,
} from './QqqDisplayWidgets'
import { QqqCustomComponentWidget, QqqParentWidget, QqqProcessWidget } from './QqqContainerWidgets'
import { ChildRecordListWidget } from './ChildRecordListWidget'
import { CronUIWidget } from './CronUIWidget'
import { DataBagViewerWidget } from './DataBagViewerWidget'
import { DynamicFormWidget } from './DynamicFormWidget'
import { FilterAndColumnsSetupWidget } from './FilterAndColumnsSetupWidget'
import { PivotTableSetupWidget } from './PivotTableSetupWidget'
import { RowBuilderWidget } from './RowBuilderWidget'
import { ScriptViewerWidget } from './ScriptViewerWidget'

const QqqChartWidget = lazy(() => import('./QqqChartWidget').then((m) => ({ default: m.QqqChartWidget })))
const BarChartWidget = lazy(() => import('./BarChartWidget').then((m) => ({ default: m.BarChartWidget })))
const LineChartWidget = lazy(() => import('./LineChartWidget').then((m) => ({ default: m.LineChartWidget })))
const PieChartWidget = lazy(() => import('./PieChartWidget').then((m) => ({ default: m.PieChartWidget })))

/** Fallback while a lazy chart chunk loads; matches the default chart height. */
const ChartFallback = <div className="h-60 animate-pulse rounded bg-muted" />

/** Canonical chart widget types and the chart variant each renders. */
const CHART_VARIANTS: Record<string, QqqChartVariant> = {
  barChart: 'bar',
  horizontalBarChart: 'horizontalBar',
  stackedBarChart: 'stackedBar',
  lineChart: 'line',
  smallLineChart: 'smallLine',
  pieChart: 'pie',
  chart: 'bar',
}

/** Props accepted by the WidgetRenderer component. */
interface WidgetRendererProps {
  /** Widget metadata; `type` is the primary discriminator. */
  widgetMetaData: QWidgetMetaData
  /** The widget payload from `GET /widget/{name}`. */
  data: unknown
  /** Record context for record-view widgets. */
  recordContext?: WidgetRecordContext
  /** Interactive block callback (process steps). */
  actionCallback?: BlockActionCallback
  /** All widget metadata, for parent widgets. */
  widgetRegistry?: Record<string, QWidgetMetaData>
  /** Parameters a parent passes to its children. */
  childParams?: Record<string, string | number | boolean>
  /** Re-fetch callback. */
  onReload?: () => void
}

/**
 * True for a canonical QQQ chart payload (as opposed to the demo chart shapes).
 *
 * @param data - Payload.
 * @returns Whether the payload came from a QQQ ChartData renderer.
 */
function isCanonicalChart(data: Record<string, unknown>): boolean {
  return 'chartData' in data || (data.type === 'chart' && !('chartType' in data) && !('seriesData' in data) && !Array.isArray(data.data))
}

/**
 * Resolves the widget type and renders the matching component.
 *
 * @param props - Component properties.
 * @returns The rendered widget body, or an "unknown widget type" placeholder.
 */
export function WidgetRenderer({ widgetMetaData, data, recordContext, actionCallback, widgetRegistry, childParams, onReload }: WidgetRendererProps) {
  const { name } = widgetMetaData
  if (!isPlainObject(data)) return null
  const resolvedType = widgetMetaData.type ?? (typeof data.type === 'string' ? data.type : null)
  const common = { widgetMetaData, recordContext, actionCallback, onReload }

  if (resolvedType && CHART_VARIANTS[resolvedType] && isCanonicalChart(data)) {
    return (
      <Suspense fallback={ChartFallback}>
        <QqqChartWidget widgetMetaData={widgetMetaData} data={data as QqqChartPayload} variant={CHART_VARIANTS[resolvedType]} />
      </Suspense>
    )
  }

  switch (resolvedType) {
    case 'statistics':
      return 'count' in data
        ? <QqqStatisticsWidget {...common} data={data} />
        : <StatisticsWidget data={data as unknown as StatisticsWidgetPayload} widgetName={name} />
    case 'multiStatistics':
      return <MultiStatisticsWidget {...common} data={data} />
    case 'table':
      return <QqqTableWidget {...common} data={data} />
    case 'multiTable':
      return <QqqMultiTableWidget {...common} data={data} />
    case 'stepper':
      return <QqqStepperWidget {...common} data={data} />
    case 'html':
      return Array.isArray(data.blocks)
        ? <BlockWidget data={data as unknown as BlockWidgetPayload} widgetName={name} />
        : <QqqHtmlWidget {...common} data={data} />
    case 'alert':
      return 'message' in data
        ? <AlertWidget data={data as unknown as AlertWidgetPayload} widgetName={name} />
        : <QqqAlertWidget {...common} data={data} />
    case 'divider':
      return <DividerWidget data={{ type: 'divider', label: typeof data.label === 'string' && data.label !== widgetMetaData.label ? data.label : undefined }} widgetName={name} />
    case 'fieldValueList':
      return <QqqFieldValueListWidget {...common} data={data} />
    case 'location':
      return <QqqLocationWidget {...common} data={data} />
    case 'usaMap':
      return <QqqUsaMapWidget {...common} data={data} />
    case 'quickSightChart':
      return <QqqQuickSightWidget {...common} data={data} />
    case 'generic':
      return <QqqGenericWidget {...common} data={data} />
    case 'process':
      return <QqqProcessWidget {...common} data={data} />
    case 'parentWidget':
      return <QqqParentWidget {...common} data={data} widgetRegistry={widgetRegistry} childParams={childParams} />
    case 'composite':
    case 'block':
      if ('blockTypeName' in data || 'blocks' in data) {
        return <QqqComposite widgetMetaData={widgetMetaData} data={data as QqqCompositeData} actionCallback={actionCallback} />
      }
      if (resolvedType === 'block') return <BlockWidget data={data as unknown as BlockWidgetPayload} widgetName={name} />
      return <CompositeWidget widgetMetaData={widgetMetaData} childWidgets={((data as { childWidgets?: CompositeWidgetProps['childWidgets'] }).childWidgets) ?? []} />
    case 'parent':
      return <CompositeWidget widgetMetaData={widgetMetaData} childWidgets={((data as { childWidgets?: CompositeWidgetProps['childWidgets'] }).childWidgets) ?? []} />
    case 'childRecordList':
      return <ChildRecordListWidget {...common} data={data} />
    case 'customComponent':
      return <QqqCustomComponentWidget {...common} data={data} />
    case 'cronUI':
      return <CronUIWidget {...common} data={data} />
    case 'dynamicForm':
      return <DynamicFormWidget {...common} data={data} />
    case 'dataBagViewer':
      return <DataBagViewerWidget {...common} data={data} />
    case 'pivotTableSetup':
      return <PivotTableSetupWidget {...common} data={data} />
    case 'filterAndColumnsSetup':
      return <FilterAndColumnsSetupWidget {...common} data={data} />
    case 'rowBuilder':
      return <RowBuilderWidget {...common} data={data} />
    case 'scriptViewer':
      return <ScriptViewerWidget {...common} data={data} />
    case 'recordGrid':
      return <RecordGridWidget data={data as unknown as RecordGridWidgetPayload} widgetName={name} />
    case 'quickLinks':
      return <QuickLinksWidget data={data as unknown as QuickLinksWidgetPayload} widgetName={name} />
    case 'processSummary':
      return <ProcessSummaryWidget data={data as unknown as ProcessSummaryWidgetPayload} widgetName={name} />
    case 'barChart':
    case 'horizontalBarChart':
    case 'stackedBarChart':
    case 'lineChart':
    case 'smallLineChart':
    case 'pieChart':
    case 'chart':
      return <LegacyChart type={resolvedType} data={data} widgetName={name} />
    default:
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center" data-qqq-id={`widget-unknown-${name}`}>
          <p className="text-sm text-muted-foreground">
            Unknown widget type:{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{String(resolvedType ?? 'unknown')}</code>
          </p>
        </div>
      )
  }
}

/**
 * Renders the demo (non-canonical) chart shapes used by the mocked development API.
 *
 * @param props - Chart properties.
 * @param props.type - Resolved widget type.
 * @param props.data - Payload.
 * @param props.widgetName - Widget name for `data-qqq-id` scoping.
 * @returns The demo chart.
 */
function LegacyChart({ type, data, widgetName }: { type: string; data: Record<string, unknown>; widgetName: string }) {
  const chartType = type === 'chart' ? data.chartType : type
  if (chartType === 'line' || chartType === 'area' || chartType === 'lineChart' || chartType === 'smallLineChart') {
    return <Suspense fallback={ChartFallback}><LineChartWidget data={data as unknown as LineChartWidgetPayload} widgetName={widgetName} /></Suspense>
  }
  if (chartType === 'pie' || chartType === 'donut' || chartType === 'pieChart') {
    return <Suspense fallback={ChartFallback}><PieChartWidget data={data as unknown as PieChartWidgetPayload} widgetName={widgetName} /></Suspense>
  }
  return <Suspense fallback={ChartFallback}><BarChartWidget data={data as unknown as BarChartWidgetPayload} widgetName={widgetName} /></Suspense>
}
