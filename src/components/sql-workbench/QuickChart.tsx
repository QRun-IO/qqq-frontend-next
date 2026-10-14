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
 * @file QuickChart — a bar, line or pie chart of a result's current rows: pick the category
 * column and the value columns. Uses Recharts, as the dashboard chart widgets do, with the
 * theme's chart palette and surfaces so it reads in light and dark mode.
 */

'use client'

import React, { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { SqlColumn, SqlValue } from '@/types'
import { numericColumnIndexes, toChartRows } from '@/lib/utils/sql-workbench'
import { CHECKBOX_CLASS, SELECT_CLASS } from '@/components/ui/controls'

/**
 * Series colors: the theme's chart palette tokens, which the dark theme redefines, so the chart
 * follows light and dark mode (Recharts writes them as SVG presentation values).
 */
export const CHART_COLORS = Array.from({ length: 10 }, (_, i) => `var(--color-chart-${i + 1})`)

/** Axis ticks and legend text: the muted text color of the surrounding card. */
const TICK = { fontSize: 12, fill: 'currentColor' }

/** Tooltip box on the popover surface. */
const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  color: 'var(--color-popover-foreground)',
  fontSize: '12px',
}
const TOOLTIP_ITEM_STYLE: React.CSSProperties = { color: 'var(--color-popover-foreground)' }
const TOOLTIP_CURSOR = { fill: 'var(--color-muted)', opacity: 0.6 }

/**
 * Renders the chart builder.
 *
 * @param props - Component props.
 * @param props.columns - Result columns.
 * @param props.rows - Rows to plot (the current page).
 * @returns The controls and the chart, or a hint when nothing is plottable.
 */
export function QuickChart({ columns, rows }: { columns: SqlColumn[]; rows: SqlValue[][] }) {
  const numeric = useMemo(() => numericColumnIndexes(columns, rows), [columns, rows])
  const firstCategory = columns.findIndex((_, i) => !numeric.includes(i))
  const [type, setType] = useState<'bar' | 'line' | 'pie'>('bar')
  const [xIndex, setXIndex] = useState(firstCategory >= 0 ? firstCategory : 0)
  const [yIndexes, setYIndexes] = useState<number[]>(
    numeric.filter((i) => i !== xIndex).slice(0, 1)
  )

  if (numeric.length === 0 || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Charts need at least one numeric column and one row.
      </p>
    )
  }

  const data = toChartRows(columns, rows, xIndex, yIndexes)
  const series = yIndexes.map((i) => columns[i].label)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground">
        <label className="inline-flex items-center gap-2">
          Chart type
          <select
            className={SELECT_CLASS}
            value={type}
            onChange={(e) => setType(e.target.value as 'bar' | 'line' | 'pie')}
            data-qqq-id="select-sql-chart-type"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </label>
        <label className="inline-flex min-w-0 items-center gap-2">
          Category
          <select
            className={SELECT_CLASS}
            value={xIndex}
            onChange={(e) => setXIndex(Number(e.target.value))}
            data-qqq-id="select-sql-chart-x"
          >
            {columns.map((c, i) => (
              <option key={i} value={i}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <legend className="sr-only">Values</legend>
          <span aria-hidden="true">Values</span>
          {numeric.map((i) => (
            <label key={i} className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                className={CHECKBOX_CLASS}
                type={type === 'pie' ? 'radio' : 'checkbox'}
                name="sql-chart-y"
                checked={yIndexes.includes(i)}
                onChange={(e) =>
                  setYIndexes(
                    type === 'pie'
                      ? [i]
                      : e.target.checked
                        ? [...yIndexes, i]
                        : yIndexes.filter((y) => y !== i)
                  )
                }
                data-qqq-id={`checkbox-sql-chart-y-${i}`}
              />
              {columns[i].label}
            </label>
          ))}
        </fieldset>
      </div>
      <div
        className="h-80 w-full text-muted-foreground"
        role="img"
        aria-label={`${type} chart of ${series.join(', ') || 'no values'} by ${columns[xIndex]?.label}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          {type === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                dataKey={series[0] ?? ''}
                nameKey="x"
                outerRadius="75%"
                label={TICK}
                stroke="var(--color-card)"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          ) : type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
              <XAxis dataKey="x" tick={TICK} stroke="currentColor" strokeOpacity={0.4} />
              <YAxis tick={TICK} stroke="currentColor" strokeOpacity={0.4} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={{ stroke: 'currentColor', strokeOpacity: 0.3 }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {series.map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
              <XAxis dataKey="x" tick={TICK} stroke="currentColor" strokeOpacity={0.4} />
              <YAxis tick={TICK} stroke="currentColor" strokeOpacity={0.4} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={TOOLTIP_CURSOR}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {series.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
