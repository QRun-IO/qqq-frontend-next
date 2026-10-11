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
 * column and the value columns. Uses Recharts, as the dashboard chart widgets do.
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

const COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#8b5cf6',
  '#84cc16',
  '#ec4899',
]

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
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1">
          Chart
          <select
            className="rounded border px-1 py-0.5"
            value={type}
            onChange={(e) => setType(e.target.value as 'bar' | 'line' | 'pie')}
            data-qqq-id="select-sql-chart-type"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1">
          Category
          <select
            className="rounded border px-1 py-0.5"
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
        <fieldset className="inline-flex flex-wrap items-center gap-2">
          <legend className="sr-only">Values</legend>
          <span>Values</span>
          {numeric.map((i) => (
            <label key={i} className="inline-flex items-center gap-1">
              <input
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
        className="h-72 w-full"
        role="img"
        aria-label={`${type} chart of ${series.join(', ') || 'no values'} by ${columns[xIndex]?.label}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          {type === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey={series[0] ?? ''} nameKey="x" outerRadius="80%" label>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          ) : type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Legend />
              {series.map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Legend />
              {series.map((s, i) => (
                <Bar key={s} dataKey={s} fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
