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

/** @file Grouped pivot bars and date series using the shared chart palette. */
'use client'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DataAnalysisPivotV1 } from '@/types/data-analysis'
import { DEFAULT_COLORS } from '@/lib/utils/chart-colors'

/** One chart per measure keeps incompatible units on separate axes; the table provides drills.
 * @param props - Sparse result and supported chart kind.
 * @returns Grouped bars or date lines, with suppressed values omitted.
 */
export default function PivotChart({
  result,
  kind,
}: {
  result: DataAnalysisPivotV1
  kind: 'BAR' | 'TIME_SERIES'
}) {
  const columns = result.columnHeaders ?? []
  const cells = new Map(result.cells?.map((c) => [`${c.rowIndex}:${c.columnIndex}`, c.values]))
  const rows = (result.rowHeaders ?? []).map((tuple, index) => ({ tuple, index }))
  if (kind === 'TIME_SERIES')
    rows.sort((a, b) => {
      const left = a.tuple[0]?.value
      const right = b.tuple[0]?.value
      if (left == null) return right == null ? 0 : 1
      if (right == null) return -1
      return typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right))
    })
  return (
    <div className="min-w-0 space-y-4">
      {result.measures?.map((measure, v) => {
        const data = rows.map(({ tuple, index: r }) => ({
          label: tuple[0]?.label ?? 'Blank',
          ...Object.fromEntries(
            columns.map((_, c) => {
              const metric = cells.get(`${r}:${c}`)?.[v]
              return [
                `series${c}`,
                !metric?.suppressed && typeof metric?.value === 'number' ? metric.value : null,
              ]
            })
          ),
        }))
        return (
          <section
            key={v}
            className="min-w-0"
            aria-label={`${kind === 'BAR' ? 'Grouped bar' : 'Time series'}: ${measure.label}`}
          >
            <h3 className="font-semibold">{measure.label}</h3>
            <div
              className="h-72 min-w-0"
              role="img"
              aria-label={`${kind === 'BAR' ? 'Grouped bar' : 'Time series'}: ${measure.label}. Values and drills are in the pivot results below.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="currentColor" />
                  <YAxis stroke="currentColor" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-popover)',
                      color: 'var(--color-popover-foreground)',
                      borderColor: 'var(--color-border)',
                    }}
                  />
                  <Legend />
                  {columns.map((tuple, c) => {
                    const props = {
                      dataKey: `series${c}`,
                      name: tuple.map((h) => h.label).join(' / ') || measure.label,
                      stroke: DEFAULT_COLORS[c % DEFAULT_COLORS.length],
                      fill: DEFAULT_COLORS[c % DEFAULT_COLORS.length],
                      isAnimationActive: false,
                    }
                    return kind === 'BAR' ? (
                      <Bar key={c} {...props} />
                    ) : (
                      <Line key={c} {...props} connectNulls={false} />
                    )
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
        )
      })}
    </div>
  )
}
