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
 * @file QqqChartWidget — renders canonical QQQ `ChartData` payloads.
 *
 * One component serves every chart widget type the backend declares (barChart,
 * horizontalBarChart, stackedBarChart, lineChart, smallLineChart, pieChart and the
 * untyped `chart` output). The payload is the JSON serialized by the backend's
 * `ChartData` / `LineChartData` / `PieChartData`: `chartData.labels` plus
 * `chartData.datasets[]` (each with `data`, optional per-point `backgroundColors`
 * and `urls`, optional series `color`), an optional title, HTML description,
 * currency flag, fixed height and `chartSubheaderData`.
 *
 * Besides the Recharts drawing, every chart renders a visually hidden data table
 * with the exact values, so the chart is accessible and its content verifiable.
 */
'use client'

import React, { useCallback, useLayoutEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { QWidgetMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'
import { SafeHtml } from './SafeHtml'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import type { QqqChartPayload } from './widget-types'

/** The chart shapes a QQQ chart widget can be drawn as. */
export type QqqChartVariant = 'bar' | 'horizontalBar' | 'stackedBar' | 'line' | 'smallLine' | 'pie'

/** Props accepted by {@link QqqChartWidget}. */
export interface QqqChartWidgetProps {
  /** Metadata of the widget; its name scopes `data-qqq-id`s and its label names the chart. */
  widgetMetaData: QWidgetMetaData
  /** Canonical QQQ chart payload from `POST /qqq/v1/widget/{name}`. */
  data: QqqChartPayload
  /** How to draw the payload, resolved from the widget type. */
  variant: QqqChartVariant
}

/** A dataset after runtime validation. */
interface NormalizedDataset {
  label: string
  data: Array<number | null>
  backgroundColors: Array<string | null>
  urls: Array<string | null>
  color?: string
}

/** A chart payload after runtime validation. */
interface NormalizedChart {
  labels: string[]
  datasets: NormalizedDataset[]
  urls: Array<string | null>
}

/** Default series palette (used when the payload supplies no colors). */
const PALETTE = ['#0062FF', '#10B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316']

/** Colors for good/bad subheader changes; AA contrast on light backgrounds. */
const GOOD_COLOR = 'var(--qqq-success-color, #2E7D32)'
const BAD_COLOR = 'var(--qqq-error-color, #C62828)'

/** Default drawing heights (px). */
const DEFAULT_HEIGHT = 240
const SMALL_LINE_HEIGHT = 140

/** Width used when the container cannot be measured (hidden panels, jsdom). */
const FALLBACK_WIDTH = 480

/**
 * Converts a raw payload value to a finite number, or null for gaps.
 *
 * @param value - Any payload value.
 * @returns The number, or null when not numeric.
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Converts a raw payload value to a non-empty string, or null.
 *
 * @param value - Any payload value.
 * @returns The string, or null.
 */
function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Validates and normalizes a canonical chart payload. Reads `data.chartData`
 * first and falls back to top-level `labels`/`datasets` (older flattened shapes).
 *
 * @param data - The raw payload.
 * @returns The normalized chart, or the name of the first malformed field.
 */
export function normalizeQqqChart(data: unknown): { chart: NormalizedChart } | { problem: string } {
  if (!isPlainObject(data)) return { problem: 'payload' }
  let source: Record<string, unknown> = data
  if (data.chartData !== undefined && data.chartData !== null) {
    if (!isPlainObject(data.chartData)) return { problem: 'chartData' }
    source = data.chartData
    //////////////////////////////////////////////////////////////////////////
    // the backend always serializes labels and/or datasets for chart data; //
    // an object carrying neither is not chart data at all                  //
    //////////////////////////////////////////////////////////////////////////
    if (!('labels' in source) && !('datasets' in source)) return { problem: 'chartData.labels' }
  }

  const rawLabels = asList(source.labels)
  if (!rawLabels) return { problem: 'chartData.labels' }
  const rawDatasets = asList(source.datasets)
  if (!rawDatasets) return { problem: 'chartData.datasets' }
  const urls = asList(source.urls)
  if (!urls) return { problem: 'chartData.urls' }

  const datasets: NormalizedDataset[] = []
  for (let index = 0; index < rawDatasets.length; index++) {
    const raw = rawDatasets[index]
    if (!isPlainObject(raw)) return { problem: `chartData.datasets[${index}]` }
    const values = asList(raw.data)
    if (!values) return { problem: `chartData.datasets[${index}].data` }
    const colors = asList(raw.backgroundColors)
    if (!colors) return { problem: `chartData.datasets[${index}].backgroundColors` }
    const pointUrls = asList(raw.urls)
    if (!pointUrls) return { problem: `chartData.datasets[${index}].urls` }
    datasets.push({
      label: typeof raw.label === 'string' && raw.label !== '' ? raw.label : `Series ${index + 1}`,
      data: values.map(toNumber),
      backgroundColors: colors.map(toOptionalString),
      urls: pointUrls.map(toOptionalString),
      color: toOptionalString(raw.color) ?? undefined,
    })
  }

  return {
    chart: {
      labels: rawLabels.map((label) => (label === null || label === undefined ? '' : String(label))),
      datasets,
      urls: urls.map(toOptionalString),
    },
  }
}

/**
 * Formats a chart value for display.
 *
 * @param value - The number (or null gap).
 * @param currency - Whether to format as US dollars.
 * @returns The display string.
 */
function formatValue(value: number | null, currency: boolean): string {
  if (value === null) return ''
  if (currency) return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return value.toLocaleString('en-US')
}

/**
 * Measures the width of a container (charts are drawn at an explicit size). Uses a
 * callback ref so the measurement starts whenever the container mounts, e.g. when
 * a reload turns an empty chart into a populated one.
 *
 * @returns A callback ref for the container and its current width.
 */
function useContainerWidth(): [(element: HTMLDivElement | null) => void, number] {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!element) {
      setWidth(0)
      return
    }
    const measure = () => setWidth(element.clientWidth > 0 ? element.clientWidth : FALLBACK_WIDTH)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, width]
}

/**
 * Returns a navigation function for chart urls: internal paths use the Next
 * router; absolute URLs leave the app.
 *
 * @returns The navigate function.
 */
function useChartNavigation(): (url: string) => void {
  const router = useRouter()
  return useCallback((url: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      window.location.assign(url)
    } else {
      router.push(url)
    }
  }, [router])
}

/**
 * A link to a chart url (internal via next/link, external via an anchor).
 *
 * @param props - Component properties.
 * @param props.href - Destination.
 * @param props.children - Link content.
 * @param props.qqqId - Optional `data-qqq-id`.
 * @returns The link element.
 */
function ChartLink({ href, children, qqqId }: { href: string; children: React.ReactNode; qqqId?: string }) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return <a href={href} className="hover:underline" data-qqq-id={qqqId}>{children}</a>
  }
  return <Link href={href} prefetch={false} className="hover:underline" data-qqq-id={qqqId}>{children}</Link>
}

/**
 * The headline number and change-vs-previous line above a chart
 * (`chartSubheaderData`).
 *
 * @param props - Component properties.
 * @param props.subheader - The payload's subheader data.
 * @param props.widgetName - Widget name for `data-qqq-id` scoping.
 * @returns The subheader, or null when the payload has none.
 */
function ChartSubheader({ subheader, widgetName }: { subheader: QqqChartPayload['chartSubheaderData']; widgetName: string }) {
  if (!isPlainObject(subheader)) return null
  const main = toNumber(subheader.mainNumber)
  const percent = toNumber(subheader.vsPreviousPercent)
  const previous = toNumber(subheader.vsPreviousNumber)
  const isUp = typeof subheader.isUpVsPrevious === 'boolean' ? subheader.isUpVsPrevious : null
  const isGood = typeof subheader.isGoodVsPrevious === 'boolean' ? subheader.isGoodVsPrevious : null
  const color = isGood === null ? undefined : isGood ? GOOD_COLOR : BAD_COLOR
  const mainUrl = toOptionalString(subheader.mainNumberUrl)
  const previousUrl = toOptionalString(subheader.previousNumberUrl)
  const description = typeof subheader.vsDescription === 'string' ? subheader.vsDescription : ''

  const mainText = main === null ? null : (
    <span className="text-3xl font-bold text-card-foreground" data-qqq-id={`chart-subheader-main-${widgetName}`}>
      {formatValue(main, false)}
    </span>
  )
  const previousText = (
    <span className="text-sm font-medium text-muted-foreground" data-qqq-id={`chart-subheader-description-${widgetName}`}>
      {description}
      {previous !== null && previous !== 0 && ` (${formatValue(previous, false)})`}
    </span>
  )

  return (
    <div className="mb-3 flex flex-wrap items-end gap-2" data-qqq-id={`chart-subheader-${widgetName}`}>
      {mainText && (mainUrl ? <ChartLink href={mainUrl}>{mainText}</ChartLink> : mainText)}
      {percent !== null && isUp !== null && (
        <span
          className="inline-flex items-center text-sm font-medium"
          style={{ color }}
          data-qqq-id={`chart-subheader-change-${widgetName}`}
          data-direction={isUp ? 'up' : 'down'}
          data-good={isGood === null ? undefined : String(isGood)}
        >
          {isUp
            ? <ArrowUp className="h-4 w-4" aria-hidden="true" />
            : <ArrowDown className="h-4 w-4" aria-hidden="true" />}
          <span className="sr-only">{isUp ? 'Up' : 'Down'}</span>
          {formatValue(percent, false)}%
        </span>
      )}
      {(description || previous) ? (previousUrl ? <ChartLink href={previousUrl}>{previousText}</ChartLink> : previousText) : null}
    </div>
  )
}

/**
 * A legend listing each entry's color and (optionally) value.
 *
 * @param props - Component properties.
 * @param props.items - Legend entries.
 * @param props.widgetName - Widget name for `data-qqq-id` scoping.
 * @returns The legend list.
 */
function ChartLegend({ items, widgetName }: { items: Array<{ label: string; color: string; value?: string }>; widgetName: string }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground" data-qqq-id={`chart-legend-${widgetName}`}>
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span>{item.value !== undefined ? `${item.label}: ${item.value}` : item.label}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The visually hidden table of exact chart values.
 *
 * @param props - Component properties.
 * @param props.chart - The normalized chart.
 * @param props.caption - Table caption.
 * @param props.currency - Whether values are currency.
 * @param props.widgetName - Widget name for `data-qqq-id` scoping.
 * @returns The data table.
 */
function ChartDataTable({ chart, caption, currency, widgetName }: { chart: NormalizedChart; caption: string; currency: boolean; widgetName: string }) {
  return (
    <table className="sr-only" data-qqq-id={`chart-data-${widgetName}`}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          {chart.datasets.map((dataset, index) => (
            <th key={`${dataset.label}-${index}`} scope="col">{dataset.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chart.labels.map((label, row) => (
          <tr key={`${label}-${row}`}>
            <th scope="row">{label}</th>
            {chart.datasets.map((dataset, column) => {
              const value = dataset.data[row] ?? null
              return (
                <td key={column} data-value={value === null ? '' : String(value)}>
                  {value === null ? '' : currency ? formatValue(value, true) : String(value)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Resolves the fill of one point: its own background color, else the series
 * color, else the palette.
 *
 * @param dataset - The point's dataset.
 * @param datasetIndex - Index of the dataset.
 * @param pointIndex - Index of the point.
 * @param perPoint - Whether palette colors vary per point (pie slices).
 * @returns The CSS color.
 */
function pointColor(dataset: NormalizedDataset, datasetIndex: number, pointIndex: number, perPoint: boolean): string {
  return dataset.backgroundColors[pointIndex]
    ?? dataset.color
    ?? PALETTE[(perPoint ? pointIndex : datasetIndex) % PALETTE.length]
}

/**
 * Resolves the navigation target of one point: the dataset's url, else the
 * chart-level url for that label.
 *
 * @param chart - The normalized chart.
 * @param datasetIndex - Index of the dataset.
 * @param pointIndex - Index of the point.
 * @returns The url, or null.
 */
function pointUrl(chart: NormalizedChart, datasetIndex: number, pointIndex: number): string | null {
  return chart.datasets[datasetIndex]?.urls[pointIndex] ?? chart.urls[pointIndex] ?? null
}

/** Props for the custom line dot. */
interface PointDotProps {
  cx?: number
  cy?: number
  index?: number
  value?: number | null
  stroke?: string
  datasetIndex: number
  chart: NormalizedChart
  radius: number
  onNavigate: (url: string) => void
}

/**
 * A line-chart point; clickable (pointer cursor) only when it has a url.
 *
 * @param props - See {@link PointDotProps}.
 * @returns An SVG circle, or an empty group for gaps.
 */
function PointDot({ cx, cy, index = 0, value, stroke, datasetIndex, chart, radius, onNavigate }: PointDotProps) {
  if (cx === undefined || cy === undefined || value === null || value === undefined) return <g />
  const url = pointUrl(chart, datasetIndex, index)
  return (
    <circle
      className="qqq-chart-point"
      cx={cx}
      cy={cy}
      r={radius}
      fill={stroke}
      stroke={stroke}
      data-label={chart.labels[index]}
      data-value={String(value)}
      style={{ cursor: url ? 'pointer' : 'default' }}
      onClick={url ? () => onNavigate(url) : undefined}
    />
  )
}

/**
 * Renders a canonical QQQ chart payload as the requested variant, with its title,
 * subheader, HTML description, legend and an accessible data table. Shows a
 * contained notice for malformed payloads and an empty message when there is no
 * data; never throws.
 *
 * @param props - See {@link QqqChartWidgetProps}.
 * @returns The rendered chart.
 */
export function QqqChartWidget({ widgetMetaData, data, variant }: QqqChartWidgetProps) {
  const widgetName = widgetMetaData.name
  const navigate = useChartNavigation()
  const [containerRef, width] = useContainerWidth()

  const normalized = normalizeQqqChart(data)
  if ('problem' in normalized) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('chart', normalized.problem)} />
  }
  const { chart } = normalized
  const hasValues = chart.labels.length > 0 && chart.datasets.some((dataset) => dataset.data.some((value) => value !== null))

  const title = typeof data.title === 'string' && data.title !== '' ? data.title : undefined
  const description = typeof data.description === 'string' && data.description !== '' ? data.description : undefined
  const currency = data.isCurrency === true || data.isYAxisCurrency === true
  const payloadHeight = toNumber(data.height)
  const height = payloadHeight !== null && payloadHeight > 0 ? payloadHeight : variant === 'smallLine' ? SMALL_LINE_HEIGHT : DEFAULT_HEIGHT
  const chartName = title ?? widgetMetaData.label ?? widgetName

  const header = (
    <>
      {title && variant !== 'smallLine' && (
        <p className="mb-2 text-sm font-medium text-muted-foreground" data-qqq-id={`chart-title-${widgetName}`}>{title}</p>
      )}
      <ChartSubheader subheader={data.chartSubheaderData} widgetName={widgetName} />
    </>
  )
  const descriptionElement = description && (
    <SafeHtml html={description} className="mt-2 text-sm text-muted-foreground" qqqId={`chart-description-${widgetName}`} />
  )

  if (!hasValues) {
    return (
      <div data-qqq-id={`chart-${variant}-${widgetName}`}>
        {header}
        <WidgetEmpty widgetName={widgetName}>No chart data available</WidgetEmpty>
        {descriptionElement}
      </div>
    )
  }

  /////////////////////////////////////////////////////////////////////
  // one row per label, one key per dataset (keys are dataset index) //
  /////////////////////////////////////////////////////////////////////
  const rows = chart.labels.map((label, pointIndex) => {
    const row: Record<string, string | number | null> = { label }
    chart.datasets.forEach((dataset, datasetIndex) => {
      row[`d${datasetIndex}`] = dataset.data[pointIndex] ?? null
    })
    return row
  })
  const allValues = chart.datasets.flatMap((dataset) => dataset.data).filter((value): value is number => value !== null)
  const hasNegative = allValues.some((value) => value < 0)
  const numberDomain: [(min: number) => number, (max: number) => number] = [
    (min) => Math.min(0, min),
    (max) => Math.max(0, max),
  ]
  const tickFormatter = (value: number) => (currency
    ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : value.toLocaleString('en-US'))
  const tooltipFormatter = (value: number, name: string) => {
    const index = Number(String(name).replace(/^d/, ''))
    return [formatValue(typeof value === 'number' ? value : toNumber(value), currency), chart.datasets[index]?.label ?? name]
  }
  const axisTick = { fontSize: 11, fill: 'currentColor', opacity: 0.75 }
  const svgLabel = `${chartName} chart`
  const multiSeries = chart.datasets.length > 1

  let drawing: React.ReactNode = null
  let legend: React.ReactNode = null

  if (variant === 'pie') {
    const dataset = chart.datasets[0]
    const slices = chart.labels.map((label, index) => ({
      label,
      value: dataset.data[index] ?? 0,
      color: pointColor(dataset, 0, index, true),
      url: pointUrl(chart, 0, index),
    }))
    const radius = Math.max(40, Math.min(width, height) / 2 - 8)
    drawing = (
      <PieChart width={width} height={height} role="img" aria-label={svgLabel}>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={Math.round(radius * 0.5)}
          outerRadius={Math.round(radius)}
          paddingAngle={1}
          isAnimationActive={false}
          onClick={(_entry: unknown, index: number) => {
            const url = slices[index]?.url
            if (url) navigate(url)
          }}
        >
          {slices.map((slice, index) => (
            <Cell key={`${slice.label}-${index}`} fill={slice.color} style={{ cursor: slice.url ? 'pointer' : 'default' }} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatValue(value, currency)} />
      </PieChart>
    )
    legend = <ChartLegend widgetName={widgetName} items={slices.map((slice) => ({ label: slice.label, color: slice.color, value: formatValue(slice.value, currency) }))} />
  } else if (variant === 'line' || variant === 'smallLine') {
    const small = variant === 'smallLine'
    drawing = (
      <LineChart width={width} height={height} data={rows} role="img" aria-label={svgLabel} margin={{ top: 8, right: 12, left: small ? 12 : 0, bottom: 4 }}>
        {!small && <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />}
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} hide={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={small ? 0 : 56} hide={small} tickFormatter={tickFormatter} domain={numberDomain} />
        <Tooltip formatter={tooltipFormatter} />
        {chart.datasets.map((dataset, datasetIndex) => {
          const stroke = dataset.color ?? PALETTE[datasetIndex % PALETTE.length]
          return (
            <Line
              key={datasetIndex}
              type="monotone"
              dataKey={`d${datasetIndex}`}
              name={`d${datasetIndex}`}
              stroke={stroke}
              strokeWidth={2}
              isAnimationActive={false}
              connectNulls={false}
              dot={(props: Omit<PointDotProps, 'datasetIndex' | 'chart' | 'radius' | 'onNavigate'> & { key?: React.Key }) => {
                const { key, ...rest } = props
                return <PointDot key={key} {...rest} stroke={stroke} datasetIndex={datasetIndex} chart={chart} radius={small ? 2.5 : 3.5} onNavigate={navigate} />
              }}
              activeDot={{ r: small ? 4 : 5 }}
            />
          )
        })}
      </LineChart>
    )
    if (multiSeries) {
      legend = <ChartLegend widgetName={widgetName} items={chart.datasets.map((dataset, index) => ({ label: dataset.label, color: dataset.color ?? PALETTE[index % PALETTE.length] }))} />
    }
  } else {
    const horizontal = variant === 'horizontalBar'
    const stacked = variant === 'stackedBar'
    drawing = (
      <BarChart
        width={width}
        height={height}
        data={rows}
        layout={horizontal ? 'vertical' : 'horizontal'}
        role="img"
        aria-label={svgLabel}
        margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
        {/* Recharts discovers axes among direct children only (no fragments) */}
        {horizontal
          ? <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={tickFormatter} domain={numberDomain} />
          : <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />}
        {horizontal
          ? <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={88} />
          : <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={tickFormatter} domain={numberDomain} />}
        {hasNegative && (horizontal
          ? <ReferenceLine x={0} stroke="currentColor" strokeOpacity={0.4} />
          : <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.4} />)}
        <Tooltip formatter={tooltipFormatter} />
        {chart.datasets.map((dataset, datasetIndex) => (
          <Bar
            key={datasetIndex}
            dataKey={`d${datasetIndex}`}
            name={`d${datasetIndex}`}
            stackId={stacked ? 'stack' : undefined}
            fill={dataset.color ?? PALETTE[datasetIndex % PALETTE.length]}
            stroke={stacked ? '#FFFFFF' : undefined}
            strokeWidth={stacked ? 1 : 0}
            isAnimationActive={false}
            radius={stacked ? 0 : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
            onClick={(_entry: unknown, pointIndex: number) => {
              const url = pointUrl(chart, datasetIndex, pointIndex)
              if (url) navigate(url)
            }}
          >
            {chart.labels.map((label, pointIndex) => (
              <Cell
                key={`${label}-${pointIndex}`}
                fill={pointColor(dataset, datasetIndex, pointIndex, false)}
                style={{ cursor: pointUrl(chart, datasetIndex, pointIndex) ? 'pointer' : 'default' }}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    )
    if (multiSeries) {
      legend = <ChartLegend widgetName={widgetName} items={chart.datasets.map((dataset, index) => ({ label: dataset.label, color: dataset.color ?? dataset.backgroundColors.find(Boolean) ?? PALETTE[index % PALETTE.length] }))} />
    }
  }

  return (
    <div data-qqq-id={`chart-${variant}-${widgetName}`} className={cn(variant === 'smallLine' && 'flex flex-col')}>
      {header}
      <div ref={containerRef} className="w-full" style={{ height }} data-qqq-id={`chart-canvas-${widgetName}`}>
        {width > 0 && drawing}
      </div>
      {legend}
      {variant === 'smallLine' && title && (
        <p className="mt-3 text-sm font-semibold text-card-foreground" data-qqq-id={`chart-title-${widgetName}`}>{title}</p>
      )}
      {descriptionElement}
      <ChartDataTable chart={chart} caption={`${chartName} data`} currency={currency} widgetName={widgetName} />
    </div>
  )
}
