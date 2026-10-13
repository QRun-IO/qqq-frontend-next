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

/** @file Lazy semantic chart renderer with table equivalents and server-provided drills. */
'use client'

import { useContext, useState } from 'react'
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
import type {
  DataAnalysisChartV1,
  DataAnalysisMetricV1,
  DataAnalysisPointV1,
} from '@/types/data-analysis'
import { drillHref } from '@/lib/utils/data-analysis'
import { DEFAULT_COLORS } from '@/lib/utils/chart-colors'
import {
  AnalysisDrillContext,
  AnalysisNavigationContext,
  controlClass,
  DrillLink,
  MetricValue,
} from './ProfileParts'

type ChartKind = NonNullable<NonNullable<DataAnalysisChartV1>['kind']>
const KIND_LABELS: Record<ChartKind, string> = {
  HISTOGRAM: 'Histogram',
  BAR: 'Bar',
  PARETO: 'Pareto',
  TIME_SERIES: 'Time series',
  BOX: 'Box plot',
  SCATTER: 'Scatter',
  HEATMAP: 'Heatmap',
}
const color = (i: number) => DEFAULT_COLORS[i % DEFAULT_COLORS.length]
const tickStyle = { fill: 'currentColor', opacity: 0.7, fontSize: 11 }
const tooltipStyle = {
  backgroundColor: 'var(--color-popover)',
  color: 'var(--color-popover-foreground)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  fontSize: '12px',
}
const tooltipItemStyle = { color: 'var(--color-popover-foreground)' }

/** Rounds a moving average to one decimal for display; null stays null.
 * @param value - The average.
 * @returns The rounded average.
 */
const round1 = (value: number | null | undefined) => (value == null ? null : Math.round(value * 10) / 10)

/** Computes complete seven-point trailing windows, leaving earlier points empty.
 * @param points - Ordered API points.
 * @param averages - Optional server-computed moving average, matched by the original x value.
 * @returns Chart rows with cumulative shares and moving averages.
 */
export function chartRows(points: DataAnalysisPointV1[], averages?: DataAnalysisPointV1[] | null) {
  const averageByX = new Map(averages?.filter((p) => p !== null).map((p) => [p.x, p.y]))
  const valid = points.filter((p): p is NonNullable<DataAnalysisPointV1> => p !== null)
  const total = valid.reduce((sum, p) => sum + (p.y ?? 0), 0)
  let sum = 0
  return valid.map((point, index) => {
    sum += point.y ?? 0
    const window = valid.slice(Math.max(0, index - 6), index + 1)
    const average =
      window.length === 7 && window.every((p) => p.y != null)
        ? window.reduce((n, p) => n + p.y!, 0) / 7
        : null
    return {
      ...point,
      label: point.label ?? String(point.x ?? ''),
      average: round1(averages ? (averageByX.get(point.x) ?? null) : average),
      cumulative: total ? (sum / total) * 100 : 0,
    }
  })
}

/** Draws only supplied, unsuppressed quartiles and whiskers, without deriving private values.
 * @param props - Numeric metrics.
 * @returns A responsive box plot or a missing-data explanation.
 */
function BoxPlot({ metrics }: { metrics: DataAnalysisMetricV1[] }) {
  const find = (...keys: string[]) =>
    metrics.find(
      (m) => m && !m.suppressed && keys.includes(m.key ?? '') && typeof m.value === 'number'
    )
  const parts = [
    find('lowerWhisker', 'whiskerLow', 'min'),
    find('p25'),
    find('p50'),
    find('p75'),
    find('upperWhisker', 'whiskerHigh', 'max'),
  ]
  if (parts.some((m) => !m)) return <p>Box plot statistics are unavailable or hidden.</p>
  const [low, q1, median, q3, high] = parts.map((m) => m!.value as number)
  const x = (v: number) => (high === low ? 250 : 35 + ((v - low) / (high - low)) * 430)
  return (
    <div>
      <svg
        viewBox="0 0 500 130"
        className="w-full"
        role="img"
        aria-label="Box plot: quartiles, median and whiskers"
      >
        <line x1={x(low)} x2={x(high)} y1={55} y2={55} stroke="currentColor" />
        <rect
          x={x(q1)}
          y={30}
          width={Math.max(1, x(q3) - x(q1))}
          height={50}
          fill={color(0)}
          stroke="currentColor"
        />
        {[low, median, high].map((v, i) => (
          <line key={i} x1={x(v)} x2={x(v)} y1={25} y2={85} stroke="currentColor" strokeWidth={2} />
        ))}
      </svg>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {parts.map((m, i) => (
          <div key={i}>
            <dt>{m?.label}</dt>
            <dd>
              <MetricValue metric={m ?? null} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Renders the API's suggested chart and alternatives; links have a keyboard-accessible table equivalent.
 * @param props - Chart and optional numeric metrics for box plots.
 * @returns Chart controls and visualization.
 */
export default function ProfileChart({
  chart,
  metrics = [],
}: {
  chart: NonNullable<DataAnalysisChartV1>
  metrics?: DataAnalysisMetricV1[]
}) {
  const router = useRouter()
  const close = useContext(AnalysisNavigationContext)
  const applyDrill = useContext(AnalysisDrillContext)
  const [chosen, setChosen] = useState<ChartKind | null>(null)
  const [asTable, setAsTable] = useState(false)
  const kinds = [
    ...new Set(
      [chart.kind, ...(chart.alternatives ?? [])].filter((kind): kind is ChartKind => Boolean(kind))
    ),
  ]
  const kind = chosen && kinds.includes(chosen) ? chosen : (chart.kind ?? 'BAR')
  const series = (chart.series ?? []).filter((s) => s !== null)
  // The time-series contract carries Count followed by its server-computed moving average.
  const plottedSeries = chart.kind === 'TIME_SERIES' ? series.slice(0, 1) : series
  const navigate = (point: DataAnalysisPointV1) => {
    const href = drillHref(point?.drill)
    if (href) {
      if (!(point?.drill && applyDrill?.(point.drill))) router.push(href)
      close()
    }
  }
  return (
    <section aria-label="Profile chart" className="min-w-0 space-y-3" data-qqq-id="analysis-chart">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Chart kind
          <select
            className={controlClass}
            value={kind}
            onChange={(e) => setChosen(e.target.value as ChartKind)}
            data-qqq-id="analysis-chart-kind"
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <button
          className={controlClass}
          aria-pressed={asTable}
          onClick={() => setAsTable(!asTable)}
          data-qqq-id="analysis-show-table"
        >
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>
      {asTable ? (
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Chart series</caption>
          <thead>
            <tr>
              <th scope="col">Series</th>
              <th scope="col">{chart.x?.label ?? 'Value'}</th>
              <th scope="col">{chart.y?.label ?? 'Count'}</th>
            </tr>
          </thead>
          <tbody>
            {series.flatMap((s, i) =>
              (s.points ?? []).map(
                (p, j) =>
                  p && (
                    <tr key={`${i}-${j}`}>
                      <th scope="row" className="break-words py-2 font-normal">
                        {s.name}
                      </th>
                      <td className="break-words">
                        <DrillLink drill={p.drill}>{p.label ?? String(p.x ?? '—')}</DrillLink>
                      </td>
                      <td>
                        <DrillLink drill={p.drill}>{p.y?.toLocaleString() ?? '—'}</DrillLink>
                      </td>
                    </tr>
                  )
              )
            )}
          </tbody>
        </table>
      ) : kind === 'BOX' ? (
        <BoxPlot metrics={metrics} />
      ) : !series.some((s) => s.points?.length) ? (
        <p>No chart data.</p>
      ) : kind === 'HEATMAP' ? (
        <div className="space-y-2">
          {series.map((s, i) => (
            <div key={i}>
              <p className="text-sm">{s.name}</p>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-2">
                {s.points?.map(
                  (p, j) =>
                    p && (
                      <div
                        key={j}
                        className="relative overflow-hidden rounded border border-border p-2 text-sm"
                      >
                        <div
                          aria-hidden
                          className="absolute inset-0 bg-primary"
                          style={{ opacity: Math.max(0, Math.min(1, p.y ?? 0)) * 0.3 }}
                        />
                        <div className="relative">
                          <DrillLink drill={p.drill}>
                            {p.label ?? String(p.x ?? '')}:{' '}
                            {p.y == null ? '—' : `${Math.round(p.y * 100)}%`}
                          </DrillLink>
                        </div>
                      </div>
                    )
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        plottedSeries.map((s, index) => {
          const points = [...(s.points ?? [])]
          if (kind === 'PARETO') points.sort((a, b) => (b?.y ?? 0) - (a?.y ?? 0))
          const rows = chartRows(
            points,
            chart.kind === 'TIME_SERIES' ? series[1]?.points : undefined
          )
          const angledTicks = rows.length > 8 || rows.some((p) => p.label.length > 10)
          const tickHeight = angledTicks ? 90 : 30
          return (
            <div key={index} className="min-w-0">
              <p className="text-sm">{s.name}</p>
              <div
                className="w-full"
                style={{ height: 240 + tickHeight }}
                role="img"
                aria-label={`${KIND_LABELS[kind]}: ${s.name ?? chart.y?.label ?? 'Profile'}`}
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  {kind === 'SCATTER' ? (
                    <ScatterChart margin={{ right: 15, bottom: 15 }}>
                      <CartesianGrid stroke="currentColor" strokeOpacity={0.1} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name={chart.x?.label ?? undefined}
                        stroke="currentColor"
                        tick={tickStyle}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name={chart.y?.label ?? undefined}
                        stroke="currentColor"
                        tick={tickStyle}
                      />
                      <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                      <Scatter
                        data-qqq-id="analysis-chart-scatter"
                        data={rows}
                        fill={color(index)}
                        onClick={(p) => navigate(p as DataAnalysisPointV1)}
                      />
                    </ScatterChart>
                  ) : (
                    <ComposedChart
                      data={rows}
                      margin={{ right: 15, bottom: 15 }}
                      accessibilityLayer
                    >
                      <CartesianGrid stroke="currentColor" strokeOpacity={0.1} />
                      <XAxis
                        type="category"
                        dataKey="label"
                        tick={tickStyle}
                        angle={angledTicks ? -35 : 0}
                        textAnchor={angledTicks ? 'end' : 'middle'}
                        height={tickHeight}
                        interval="preserveStartEnd"
                        minTickGap={12}
                        tickFormatter={(label: string) =>
                          label.length > 22 ? `${label.slice(0, 21)}…` : label
                        }
                      />
                      <YAxis tick={tickStyle} />
                      <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                      {kind === 'TIME_SERIES' && <Legend wrapperStyle={{ fontSize: '12px' }} />}
                      {kind === 'TIME_SERIES' && (
                        <Line
                          dataKey="y"
                          name={s.name ?? 'Value'}
                          stroke={color(index)}
                          isAnimationActive={false}
                          dot={(props: {
                            cx?: number
                            cy?: number
                            payload?: DataAnalysisPointV1
                          }) =>
                            props.cx == null || props.cy == null ? (
                              <g />
                            ) : (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={4}
                                fill={color(index)}
                                tabIndex={drillHref(props.payload?.drill) ? 0 : undefined}
                                role={drillHref(props.payload?.drill) ? 'link' : undefined}
                                aria-label={props.payload?.label ?? 'Open matching records'}
                                onClick={() => navigate(props.payload ?? null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') navigate(props.payload ?? null)
                                }}
                                data-qqq-id="analysis-chart-point"
                              />
                            )
                          }
                          activeDot={false}
                        />
                      )}
                      {kind === 'TIME_SERIES' && (
                        <Line
                          dataKey="average"
                          name="7-bucket moving average"
                          stroke={color(index + 1)}
                          dot={{ r: 2 }}
                          isAnimationActive={false}
                          strokeDasharray="5 3"
                        />
                      )}
                      {kind !== 'TIME_SERIES' && (
                        <Bar
                          data-qqq-id="analysis-chart-bar"
                          dataKey="y"
                          name={s.name ?? 'Value'}
                          fill={color(index)}
                          onClick={(p) => navigate(p as DataAnalysisPointV1)}
                        />
                      )}
                      {kind === 'PARETO' && (
                        <YAxis
                          yAxisId="share"
                          orientation="right"
                          domain={[0, 100]}
                          unit="%"
                          tick={tickStyle}
                        />
                      )}
                      {kind === 'PARETO' && (
                        <Line
                          yAxisId="share"
                          dataKey="cumulative"
                          name="Cumulative %"
                          stroke={color(index + 1)}
                          dot={false}
                        />
                      )}
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )
        })
      )}
      {chart.annotations?.map((annotation, i) => (
        <p key={i} className="text-sm text-muted-foreground">
          {annotation}
        </p>
      ))}
    </section>
  )
}
