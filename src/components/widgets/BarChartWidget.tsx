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
 * @file BarChartWidget — Recharts-based bar chart widget supporting vertical, horizontal,
 * and stacked multi-series configurations driven by backend metadata.
 */
'use client'

import React, { useRef, useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import type { ChartDataset } from '@/types'

/**
 * A single item within a `seriesData` entry for Shape C multi-series data.
 *
 * Each item represents one bar on the category axis with a label and numeric value.
 */
export interface SeriesDataItem {
  /** Category label shown on the axis. */
  label: string
  /** Numeric value for this item. */
  value: number
}

/**
 * A single named series within the Shape C `seriesData` array.
 *
 * This is an alternative multi-series format where each series carries its own
 * label/value pairs rather than sharing a common labels array.
 */
export interface SeriesEntry {
  /** Human-readable name for this series (shown in legend). */
  name: string
  /** Optional CSS color applied to this series' bars. */
  color?: string
  /** Ordered data items for this series. */
  data: SeriesDataItem[]
}

/** Wire-format payload for a bar-chart widget returned by the backend API. */
export interface BarChartWidgetPayload {
  /** Discriminator identifying this as a bar-chart or generic chart widget. */
  type: 'barChart' | 'chart'
  /** Optional chart title rendered above the chart. */
  title?: string
  /** X-axis category labels for multi-series (Shape A) data. */
  labels?: string[]
  /** Single-series data array (Shape B). */
  data?: Array<{ label: string; value: number; color?: string }>
  /** Multi-series dataset array (Shape A). */
  datasets?: ChartDataset[]
  /**
   * Alternative multi-series format (Shape C): array of named series each with
   * their own `{ label, value }` data pairs. Takes precedence over `datasets`.
   */
  seriesData?: SeriesEntry[]
  /** When 'horizontal', renders bars horizontally (Recharts layout="vertical"). When 'vertical', renders standard vertical bars (default). */
  orientation?: 'vertical' | 'horizontal'
  /** When true, bars in multi-series datasets are stacked */
  stacked?: boolean
}

/** Props accepted by the BarChartWidget component. */
interface BarChartWidgetProps {
  /** Typed payload from the widget API response. */
  data: BarChartWidgetPayload
  /** Unique widget name used to scope data-qqq-id attributes. */
  widgetName: string
}

/**
 * Normalizes heterogeneous bar-chart data shapes into a unified Recharts-compatible form.
 *
 * Supports three input shapes, evaluated in priority order:
 * - Shape C: `{ seriesData: [{ name, color, data: [{label, value}] }] }` — named series with inline data.
 * - Shape A: `{ labels, datasets }` — multi-series with a shared labels array.
 * - Shape B: `{ data: [{ label, value, color }] }` — single series.
 *
 * @param data - Raw bar-chart payload from the backend.
 * @returns Normalized chart entries and an array of data-key/color descriptors.
 */
function normalizeChartData(
  data: BarChartWidgetPayload
): { entries: Record<string, string | number>[]; dataKeys: Array<{ key: string; color: string; stack?: string }> } {
  // Shape C: { seriesData } -- each series carries its own label/value pairs
  if (data.seriesData && data.seriesData.length > 0) {
    // Collect the union of all labels across all series to build a complete x-axis
    const labelSet = new Set<string>()
    for (const series of data.seriesData) {
      for (const item of series.data) {
        labelSet.add(item.label)
      }
    }
    const allLabels = Array.from(labelSet)

    const entries = allLabels.map((label) => {
      const row: Record<string, string | number> = { label }
      for (const series of data.seriesData!) {
        const item = series.data.find((d) => d.label === label)
        row[series.name] = item?.value ?? 0
      }
      return row
    })

    const dataKeys = data.seriesData.map((series, i) => ({
      key: series.name,
      color: series.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      stack: data.stacked ? 'stack' : undefined,
    }))
    return { entries, dataKeys }
  }

  // Shape A: { labels, datasets } -- multi-series
  if (data.labels && data.datasets && data.datasets.length > 0) {
    const entries = data.labels.map((label, i) => {
      const row: Record<string, string | number> = { label }
      for (const ds of data.datasets!) {
        row[ds.label] = ds.data[i] ?? 0
      }
      return row
    })
    const dataKeys = data.datasets.map((ds, i) => ({
      key: ds.label,
      color: ds.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      // If globally stacked, assign a shared stackId
      stack: data.stacked ? 'stack' : undefined,
    }))
    return { entries, dataKeys }
  }

  // Shape B: { data: [{ label, value, color }] } -- single series
  if (data.data && data.data.length > 0) {
    const entries = data.data.map((d) => ({ label: d.label, value: d.value }))
    const dataKeys = [{ key: 'value', color: data.data[0]?.color ?? DEFAULT_COLORS[0] }]
    return { entries, dataKeys }
  }

  return { entries: [], dataKeys: [] }
}

/** Default color palette cycled through when dataset entries do not specify an explicit color. */
const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

/**
 * Renders a responsive bar chart using Recharts.
 *
 * Dispatched by `WidgetRenderer` for `'barChart'`-type widgets (lazy-loaded).
 * Supports vertical bars (default), horizontal bars (`data.orientation === 'horizontal'`),
 * and stacked multi-series bars (`data.stacked === true`).  A `<Legend>` is only
 * shown when more than one data key is present, and switches to `layout="vertical"`
 * when the container width is below 400 px (tracked via ResizeObserver).  Shows an
 * empty-state message when the normalized data set contains no entries.
 *
 * @param props - Component properties; `data.orientation` and `data.stacked` control
 *   the chart layout; `data.title` is rendered above the chart when provided.
 * @returns A `<div>` containing an optional title and a 240 px Recharts `<BarChart>`.
 */
export function BarChartWidget({ data, widgetName }: BarChartWidgetProps) {
  const { entries, dataKeys } = normalizeChartData(data)
  const isHorizontal = data.orientation === 'horizontal'

  // Track container width for responsive Legend layout
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(600)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (entries.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-qqq-id={`bar-chart-empty-${widgetName}`}
      >
        No chart data available
      </p>
    )
  }

  const legendLayout = containerWidth < 400 ? 'vertical' : 'horizontal'

  return (
    <div ref={containerRef} data-qqq-id={`bar-chart-${widgetName}`}>
      {data.title && (
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          {data.title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={entries}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
          role="img"
          aria-label={data.title ?? `Bar chart: ${widgetName}`}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
          {isHorizontal ? (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              borderRadius: '6px',
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '12px',
            }}
          />
          {dataKeys.length > 1 && (
            <Legend layout={legendLayout} wrapperStyle={{ fontSize: '11px' }} />
          )}
          {dataKeys.map(({ key, color, stack }) => (
            <Bar
              key={key}
              dataKey={key}
              fill={color}
              radius={isHorizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
              stackId={stack}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
