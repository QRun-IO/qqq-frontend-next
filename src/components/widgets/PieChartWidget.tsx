'use client'

// PieChartWidget — Pie/donut chart using Recharts

import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export interface PieChartWidgetPayload {
  type: 'pieChart' | 'chart'
  title?: string
  labels?: string[]
  datasets?: Array<{ label: string; data: number[]; color?: string }>
  data?: Array<{ label: string; value: number; color?: string }>
}

interface PieChartWidgetProps {
  data: PieChartWidgetPayload
  widgetName: string
}

interface PieEntry {
  name: string
  value: number
  color: string
}

const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

function normalizeData(data: PieChartWidgetPayload): PieEntry[] {
  // Shape A: { data: [{label, value, color}] }
  if (data.data && data.data.length > 0) {
    return data.data.map((d, i) => ({
      name: d.label,
      value: d.value,
      color: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }))
  }

  // Shape B: { labels, datasets } — use first dataset
  if (data.labels && data.datasets && data.datasets[0]) {
    const ds = data.datasets[0]
    return data.labels.map((label, i) => ({
      name: label,
      value: ds.data[i] ?? 0,
      color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }))
  }

  return []
}

export function PieChartWidget({ data, widgetName }: PieChartWidgetProps) {
  const entries = normalizeData(data)

  if (entries.length === 0) {
    return (
      <p
        className="text-sm text-gray-500 dark:text-gray-400"
        data-qqq-id={`pie-chart-empty-${widgetName}`}
      >
        No chart data available
      </p>
    )
  }

  return (
    <div data-qqq-id={`pie-chart-${widgetName}`}>
      {data.title && (
        <p className="mb-3 text-xs font-medium text-gray-600 dark:text-gray-400">
          {data.title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart
          role="img"
          aria-label={data.title ?? `Pie chart: ${widgetName}`}
        >
          <Pie
            data={entries}
            cx="50%"
            cy="50%"
            innerRadius="40%"
            outerRadius="70%"
            dataKey="value"
            nameKey="name"
            paddingAngle={2}
          >
            {entries.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => value.toLocaleString()}
            contentStyle={{
              borderRadius: '6px',
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px' }}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
