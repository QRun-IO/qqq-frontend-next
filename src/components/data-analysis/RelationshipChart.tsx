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

/** @file Shared grouped bars, comparable boxes, scatter trend and bucket series. */
'use client'
import { useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DataAnalysisChartV1, DataAnalysisPointV1 } from '@/types/data-analysis'
import { DEFAULT_COLORS } from '@/lib/utils/chart-colors'
import { drillHref } from '@/lib/utils/data-analysis'
import { AnalysisDrillContext, controlClass, DrillLink } from './ProfileParts'

const tooltipStyle = {
  backgroundColor: 'var(--color-popover)',
  color: 'var(--color-popover-foreground)',
  border: '1px solid var(--color-border)',
}

/** Renders all semantic series on one shared axis, with keyboard-accessible data links.
 * @param props - Server chart.
 * @returns A responsive chart with a table alternative.
 */
export default function RelationshipChart({ chart }: { chart: NonNullable<DataAnalysisChartV1> }) {
  const chartRef = useRef<HTMLDivElement>(null)
  // recharts marks each scatter symbol role="img" without a name; the points are decorative here
  // (the same data, with drills, is in "Show as table"), so hide them from assistive technology.
  useEffect(() => {
    const root = chartRef.current
    if (!root) return undefined
    const hide = () =>
      root.querySelectorAll('.recharts-scatter-symbol[role="img"]').forEach((el) => {
        el.removeAttribute('role')
        el.setAttribute('aria-hidden', 'true')
      })
    hide()
    // ResponsiveContainer draws after measuring, and redraws on resize
    const observer = new MutationObserver(hide)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [chart])
  const [table, setTable] = useState(false)
  const applyDrill = useContext(AnalysisDrillContext)
  const router = useRouter()
  const series = (chart.series ?? []).filter((s) => s !== null)
  const points = series.flatMap((s) => s.points?.filter((p) => p !== null) ?? [])
  const navigate = (point: DataAnalysisPointV1) => {
    const href = drillHref(point?.drill)
    if (href && !(point?.drill && applyDrill?.(point.drill))) router.push(href)
  }
  const rows = [...new Set(points.map((p) => p.label ?? String(p.x ?? '')))].map((label) => ({
    label,
    ...Object.fromEntries(
      series.map((s, i) => [
        String(i),
        s.points?.find((p) => (p?.label ?? String(p?.x ?? '')) === label)?.y ?? null,
      ])
    ),
  }))
  const boxes = series.map((s) =>
    ['min', 'p25', 'median', 'p75', 'max'].map((key) =>
      s.points?.find((p) => p?.x === key || (key === 'median' && p?.x === 'p50'))
    )
  )
  const values = boxes.flat().flatMap((p) => (p?.y == null ? [] : [p.y]))
  const low = Math.min(...values),
    high = Math.max(...values)
  const x = (n: number) => (high === low ? 250 : 35 + ((n - low) / (high - low)) * 430)
  return (
    <section className="min-w-0 space-y-3" aria-label="Analysis chart">
      <button
        type="button"
        className={controlClass}
        aria-pressed={table}
        onClick={() => setTable(!table)}
        data-qqq-id="relationship-chart-table"
      >
        {table ? 'Show as chart' : 'Show as table'}
      </button>
      {table ? (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption>Chart data</caption>
            <thead>
              <tr>
                <th className="sticky left-0 bg-background" scope="col">
                  Series
                </th>
                <th scope="col">{chart.x?.label ?? 'Value'}</th>
                <th scope="col">{chart.y?.label ?? 'Value'}</th>
              </tr>
            </thead>
            <tbody>
              {series.flatMap((s, i) =>
                s.points?.map(
                  (p, j) =>
                    p && (
                      <tr key={`${i}:${j}`}>
                        <th scope="row" className="sticky left-0 bg-background p-2">
                          {s.name}
                        </th>
                        <td className="p-2">
                          <DrillLink drill={p.drill}>{p.label ?? String(p.x ?? '—')}</DrillLink>
                        </td>
                        <td className="p-2">
                          <DrillLink drill={p.drill}>
                            {p.y == null ? 'Hidden / unavailable' : p.y.toLocaleString()}
                          </DrillLink>
                        </td>
                      </tr>
                    )
                )
              )}
            </tbody>
          </table>
        </div>
      ) : chart.kind === 'BOX' ? (
        <div className="space-y-3">
          {series.map((s, i) => (
            <div key={i}>
              <p>{s.name}</p>
              {boxes[i].some((p) => p?.y == null) ? (
                <p>Box plot statistics are unavailable or hidden.</p>
              ) : (
                <svg
                  viewBox="0 0 500 100"
                  className="w-full"
                  role="img"
                  aria-label={`Box plot: ${s.name}`}
                >
                  <line
                    x1={x(boxes[i][0]!.y!)}
                    x2={x(boxes[i][4]!.y!)}
                    y1={50}
                    y2={50}
                    stroke="currentColor"
                  />
                  <rect
                    x={x(boxes[i][1]!.y!)}
                    y={25}
                    width={Math.max(1, x(boxes[i][3]!.y!) - x(boxes[i][1]!.y!))}
                    height={50}
                    fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                    stroke="currentColor"
                  />
                  {[0, 2, 4].map((j) => (
                    <line
                      key={j}
                      x1={x(boxes[i][j]!.y!)}
                      x2={x(boxes[i][j]!.y!)}
                      y1={20}
                      y2={80}
                      stroke="currentColor"
                      strokeWidth={2}
                    />
                  ))}
                </svg>
              )}
            </div>
          ))}
        </div>
      ) : !points.some((p) => p.y != null) ? (
        <p>No chart data.</p>
      ) : (
        <div
          ref={chartRef}
          className="h-80 w-full min-w-0 overflow-hidden"
          role="group"
          aria-label={
            chart.kind === 'SCATTER'
              ? 'Scatter with trend line'
              : chart.kind === 'TIME_SERIES'
                ? 'Shares over time'
                : 'Grouped bar comparison'
          }
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {chart.kind === 'SCATTER' ? (
              <ScatterChart margin={{ right: 20, bottom: 20 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.15} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={chart.x?.label ?? undefined}
                  stroke="currentColor"
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={chart.y?.label ?? undefined}
                  stroke="currentColor"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: 'var(--color-popover-foreground)' }}
                />
                <Legend formatter={(value) => <span className="text-foreground">{value}</span>} />
                {series.map((s, i) => (
                  <Scatter
                    key={i}
                    name={s.name ?? ''}
                    data={s.points?.filter((p) => p?.x != null && p.y != null) ?? []}
                    fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                    line={i > 0}
                    shape={i > 0 ? () => <g /> : undefined}
                    isAnimationActive={false}
                    onClick={(p) => navigate(p as DataAnalysisPointV1)}
                  />
                ))}
              </ScatterChart>
            ) : (
              <ComposedChart data={rows} margin={{ right: 20, bottom: 20 }} accessibilityLayer>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.15} />
                <XAxis
                  dataKey="label"
                  stroke="currentColor"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="currentColor" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: 'var(--color-popover-foreground)' }}
                />
                <Legend formatter={(value) => <span className="text-foreground">{value}</span>} />
                {series.map((s, i) =>
                  chart.kind === 'TIME_SERIES' ? (
                    <Line
                      key={i}
                      dataKey={String(i)}
                      name={s.name ?? ''}
                      stroke={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                      isAnimationActive={false}
                      connectNulls={false}
                      dot={(props) => {
                        const p = s.points?.find((p) => p?.label === props.payload.label)
                        if (p?.y == null || props.cx == null || props.cy == null) return <g />
                        return (
                          <circle
                            key={props.key}
                            cx={props.cx}
                            cy={props.cy}
                            r={4}
                            fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                            role={drillHref(p?.drill) ? 'link' : undefined}
                            tabIndex={drillHref(p?.drill) ? 0 : undefined}
                            aria-label={`${s.name}: ${p?.label ?? ''}`}
                            onClick={() => navigate(p ?? null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') navigate(p ?? null)
                            }}
                            data-qqq-id="shift-chart-point"
                          />
                        )
                      }}
                    />
                  ) : (
                    <Bar
                      key={i}
                      dataKey={String(i)}
                      name={s.name ?? ''}
                      fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                      isAnimationActive={false}
                      onClick={(row) =>
                        navigate(
                          s.points?.find((p) => (p?.label ?? String(p?.x ?? '')) === row.label) ??
                            null
                        )
                      }
                    />
                  )
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {chart.annotations?.map((a, i) => (
        <p key={i} className="text-sm">
          {a}
        </p>
      ))}
    </section>
  )
}
