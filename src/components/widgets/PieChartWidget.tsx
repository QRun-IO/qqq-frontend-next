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
 * @file PieChartWidget — Recharts-based pie/donut chart widget with legend support.
 */
'use client'

import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

/** Wire-format payload for a pie-chart widget returned by the backend API. */
export interface PieChartWidgetPayload {
  /** Discriminator identifying this as a pie-chart or generic chart widget. */
  type: 'pieChart' | 'chart'
  /** Optional chart title rendered above the chart. */
  title?: string
  /** Category labels corresponding to values in the first dataset (Shape B). */
  labels?: string[]
  /** Dataset array; only the first dataset is used for pie slices (Shape B). */
  datasets?: Array<{ label: string; data: number[]; color?: string }>
  /** Single-series slice array where each entry maps to one pie wedge (Shape A). */
  data?: Array<{ label: string; value: number; color?: string }>
}

/** Props accepted by the PieChartWidget component. */
interface PieChartWidgetProps {
  /** Typed payload from the widget API response. */
  data: PieChartWidgetPayload
  /** Unique widget name used to scope data-qqq-id attributes. */
  widgetName: string
}

/** Normalized internal representation of a single pie slice. */
interface PieEntry {
  /** Display name shown in the legend and tooltip. */
  name: string
  /** Numeric value determining the slice's arc size. */
  value: number
  /** Hex color string used to fill the slice. */
  color: string
}

/** Default color palette cycled through when slice entries do not specify an explicit color. */
const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

/**
 * Normalizes heterogeneous pie-chart data shapes into a flat array of PieEntry objects.
 *
 * Supports two input shapes:
 * - Shape A: `{ data: [{ label, value, color }] }` — direct slice array.
 * - Shape B: `{ labels, datasets }` — uses the first dataset's values with labels as names.
 *
 * @param data - Raw pie-chart payload from the backend.
 * @returns Array of normalized pie slice entries with name, value, and color.
 */
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

/**
 * Renders a responsive donut-style pie chart using Recharts.
 *
 * Dispatched by `WidgetRenderer` for `'pieChart'`-type widgets (lazy-loaded).
 * Uses `innerRadius="40%"` and `outerRadius="70%"` to produce a donut shape.
 * Displays a color-coded `<Legend>` with circle icons below the chart.  Shows
 * an empty-state message when the normalized data set contains no slice entries.
 *
 * @param props - Component properties; `data.data` provides Shape A (direct slice
 *   array) and `data.labels` + `data.datasets` provides Shape B (only the first
 *   dataset is used for pie slices).
 * @returns A `<div>` containing an optional title and a 240 px Recharts `<PieChart>`.
 */
export function PieChartWidget({ data, widgetName }: PieChartWidgetProps) {
  const entries = normalizeData(data)

  if (entries.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-qqq-id={`pie-chart-empty-${widgetName}`}
      >
        No chart data available
      </p>
    )
  }

  return (
    <div data-qqq-id={`pie-chart-${widgetName}`}>
      {data.title && (
        <p className="mb-3 text-xs font-medium text-muted-foreground">
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
