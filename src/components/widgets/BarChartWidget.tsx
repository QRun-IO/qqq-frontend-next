'use client'

// BarChartWidget -- Bar chart using Recharts
// Supports vertical (default), horizontal, and stacked bar configurations

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

export interface BarChartWidgetPayload {
  type: 'barChart' | 'chart'
  title?: string
  labels?: string[]
  data?: Array<{ label: string; value: number; color?: string }>
  datasets?: ChartDataset[]
  /** When 'horizontal', renders bars horizontally (Recharts layout="vertical") */
  orientation?: 'vertical' | 'horizontal'
  /** When true, bars in multi-series datasets are stacked */
  stacked?: boolean
}

interface BarChartWidgetProps {
  data: BarChartWidgetPayload
  widgetName: string
}

// Normalize data from multiple possible shapes
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

const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function BarChartWidget({ data, widgetName }: BarChartWidgetProps) {
  const { entries, dataKeys } = normalizeChartData(data)
  const isHorizontal = data.orientation === 'horizontal'

  if (entries.length === 0) {
    return (
      <p
        className="text-sm text-gray-500 dark:text-gray-400"
        data-qqq-id={`bar-chart-empty-${widgetName}`}
      >
        No chart data available
      </p>
    )
  }

  return (
    <div data-qqq-id={`bar-chart-${widgetName}`}>
      {data.title && (
        <p className="mb-3 text-xs font-medium text-gray-600 dark:text-gray-400">
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
