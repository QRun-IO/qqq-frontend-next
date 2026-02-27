/**
 * LineChartWidget — Recharts-based line chart widget supporting multi-series and single-series data.
 *
 * Y-axis values are formatted with K/M suffixes for readability on large numbers.
 */
'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import type { ChartDataset } from '@/types'

/** Wire-format payload for a line-chart widget returned by the backend API. */
export interface LineChartWidgetPayload {
  /** Discriminator identifying this as a line-chart or generic chart widget. */
  type: 'lineChart' | 'chart'
  /** Optional chart title rendered above the chart. */
  title?: string
  /** X-axis category labels for multi-series (Shape A) data. */
  labels?: string[]
  /** Multi-series dataset array (Shape A). */
  datasets?: ChartDataset[]
  /** Single-series shorthand data array (Shape B). */
  data?: Array<{ label: string; value: number; color?: string }>
}

/** Props accepted by the LineChartWidget component. */
interface LineChartWidgetProps {
  /** Typed payload from the widget API response. */
  data: LineChartWidgetPayload
  /** Unique widget name used to scope data-qqq-id attributes. */
  widgetName: string
}

/**
 * Normalizes heterogeneous line-chart data shapes into a unified Recharts-compatible form.
 *
 * Supports two input shapes:
 * - Shape A: `{ labels, datasets }` — multi-series with named datasets.
 * - Shape B: `{ data: [{ label, value, color }] }` — single series.
 *
 * @param data - Raw line-chart payload from the backend.
 * @returns Normalized chart entries and an array of data-key/color descriptors.
 */
function normalizeChartData(
  data: LineChartWidgetPayload
): { entries: Record<string, string | number>[]; dataKeys: Array<{ key: string; color: string }> } {
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
    }))
    return { entries, dataKeys }
  }

  if (data.data && data.data.length > 0) {
    const entries = data.data.map((d) => ({ label: d.label, value: d.value }))
    const dataKeys = [{ key: 'value', color: data.data[0]?.color ?? DEFAULT_COLORS[0] }]
    return { entries, dataKeys }
  }

  return { entries: [], dataKeys: [] }
}

/** Default color palette cycled through when dataset entries do not specify an explicit color. */
const DEFAULT_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

/**
 * Formats a Y-axis tick value using compact K/M suffixes for large numbers.
 *
 * @param value - Raw numeric tick value from Recharts.
 * @returns Human-readable string such as '1.2M', '500K', or '42'.
 */
function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

/**
 * Renders a responsive line chart using Recharts.
 *
 * Displays a legend when more than one data series is present. Shows an
 * empty-state message when the normalized data set contains no entries.
 *
 * @param data - Line-chart widget payload from the backend API.
 * @param widgetName - Widget name scoped to data-qqq-id attributes.
 */
export function LineChartWidget({ data, widgetName }: LineChartWidgetProps) {
  const { entries, dataKeys } = normalizeChartData(data)

  if (entries.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-qqq-id={`line-chart-empty-${widgetName}`}
      >
        No chart data available
      </p>
    )
  }

  return (
    <div data-qqq-id={`line-chart-${widgetName}`}>
      {data.title && (
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          {data.title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={entries}
          margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
          role="img"
          aria-label={data.title ?? `Line chart: ${widgetName}`}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            formatter={(value: number) => value.toLocaleString()}
            contentStyle={{
              borderRadius: '6px',
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '12px',
            }}
          />
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
          {dataKeys.map(({ key, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
