/**
 * BarChartWidget — Recharts-based bar chart widget supporting vertical, horizontal,
 * and stacked multi-series configurations driven by backend metadata.
 */
'use client'

import React from 'react'
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
  /** When 'horizontal', renders bars horizontally (Recharts layout="vertical") */
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
 * Supports two input shapes:
 * - Shape A: `{ labels, datasets }` — multi-series with named datasets.
 * - Shape B: `{ data: [{ label, value, color }] }` — single series.
 *
 * @param data - Raw bar-chart payload from the backend.
 * @returns Normalized chart entries and an array of data-key/color descriptors.
 */
function normalizeChartData(
  data: BarChartWidgetPayload
): { entries: Record<string, string | number>[]; dataKeys: Array<{ key: string; color: string; stack?: string }> } {
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
 * Supports vertical bars (default), horizontal bars, and stacked multi-series bars.
 * Shows an empty-state message when the normalized data set contains no entries.
 *
 * @param data - Bar-chart widget payload from the backend API.
 * @param widgetName - Widget name scoped to data-qqq-id attributes.
 */
export function BarChartWidget({ data, widgetName }: BarChartWidgetProps) {
  const { entries, dataKeys } = normalizeChartData(data)
  const isHorizontal = data.orientation === 'horizontal'

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

  return (
    <div data-qqq-id={`bar-chart-${widgetName}`}>
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
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
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
