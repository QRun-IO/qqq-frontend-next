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

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import { column, dateColumn, numericColumn, table } from '../../../tests/fixtures/data-analysis'
import { DEFAULT_COLORS } from '@/lib/utils/chart-colors'
import ProfileChart, { chartRows } from './ProfileChart'

vi.mock('recharts', async (original) => {
  const actual = await original<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div>
        {React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, {
          width: 480,
          height: 360,
        })}
      </div>
    ),
  }
})
afterEach(cleanup)

describe('semantic profile charts', () => {
  it('plots forty ISO yearly buckets and the supplied average together with readable labels', () => {
    const { container } = render(<ProfileChart chart={dateColumn.chart} />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    const curves = container.querySelectorAll('.recharts-line-curve')
    expect(curves).toHaveLength(2)
    expect(curves[0]).toHaveAttribute('stroke', DEFAULT_COLORS[0])
    expect(curves[1]).toHaveAttribute('stroke', DEFAULT_COLORS[1])
    expect(curves[1]).toHaveAttribute('stroke-dasharray', '5 3')
    for (const curve of curves) {
      expect(curve.getAttribute('d')).toMatch(/^M/)
      expect(curve.getAttribute('d')).not.toMatch(/NaN|undefined/)
    }
    const dots = container.querySelectorAll('[data-qqq-id="analysis-chart-point"]')
    expect(dots).toHaveLength(40)
    expect(new Set(Array.from(dots, (dot) => dot.getAttribute('cx'))).size).toBe(40)
    expect(screen.getByText('1969')).toBeVisible()
    expect(screen.queryByText('1969-01-01')).not.toBeInTheDocument()
    expect(screen.getByText('7-bucket moving average')).toBeVisible()
    const rows = chartRows(dateColumn.chart.series[0].points, dateColumn.chart.series[1].points)
    expect(rows[0]).toMatchObject({ x: '1969-01-01', label: '1969', y: 10, average: 10 })
    expect(rows[6].average).toBe(40)
    // Keyboard chart navigation activates the real Recharts tooltip.
    fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
    expect(container.querySelector('.recharts-tooltip-label')).toHaveTextContent('1970')
    expect(container.querySelector('.recharts-default-tooltip')).toHaveStyle({
      backgroundColor: 'var(--color-popover)',
      color: 'var(--color-popover-foreground)',
    })
  })

  it('matches average buckets by x, preserves missing averages and numeric scatter coordinates', () => {
    expect(chartRows([{ x: 60000, label: '60,000 – 65,000', y: 2 }])[0]).toMatchObject({
      x: 60000,
      label: '60,000 – 65,000',
      y: 2,
    })
    const rows = chartRows(
      [
        { x: 'a', y: 5 },
        { x: 'b', y: 10 },
      ],
      [{ x: 'b', y: 7.5 }]
    )
    expect(rows.map((p) => p.average)).toEqual([null, 7.5])
    expect(rows[0].label).toBe('a')
  })

  it('keeps a single time bucket visible as a dot', () => {
    const { container } = render(
      <ProfileChart
        chart={{
          ...dateColumn.chart,
          series: dateColumn.chart.series.map((series) => ({
            ...series,
            points: series.points.slice(0, 1),
          })),
        }}
      />
    )
    expect(container.querySelectorAll('[data-qqq-id="analysis-chart-point"]')).toHaveLength(1)
    expect(container.querySelector('[data-qqq-id="analysis-chart-point"]')).toHaveAttribute(
      'r',
      '4'
    )
  })

  it('uses bin labels and angled ticks for crowded numeric categories', () => {
    const { container } = render(<ProfileChart chart={numericColumn.chart} />)
    const tick = screen.getByText('60,000 – 65,000').closest('text')
    expect(tick).toHaveAttribute('transform', expect.stringContaining('rotate(-35'))
    expect(tick).toHaveAttribute('fill', 'currentColor')
    expect(tick).toHaveAttribute('opacity', '0.7')
    expect(container.querySelector('.recharts-cartesian-grid line')).toHaveAttribute(
      'stroke-opacity',
      '0.1'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }))
    expect(screen.getByRole('table')).toHaveTextContent('60,000 – 65,000')
  })

  it('switches offered kinds and exposes accessible table drills', async () => {
    const { container } = render(<ProfileChart chart={column.chart} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Chart kind' }), {
      target: { value: 'PARETO' },
    })
    expect(screen.getByRole('img', { name: /Pareto:/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }))
    expect(screen.getByRole('table')).toHaveTextContent('Status distribution')
    expect(screen.getByRole('link', { name: 'Active' })).toHaveAttribute(
      'href',
      expect.stringContaining('?filter=')
    )
    expect(screen.getByRole('link', { name: '800' })).toHaveAttribute(
      'href',
      expect.stringContaining('?filter=')
    )
    expect(await axe(container)).toHaveNoViolations()
  })
  it('draws the box from supplied quartiles without displaying suppressed statistics', () => {
    const view = render(
      <ProfileChart
        chart={{ ...numericColumn.chart, kind: 'BOX' }}
        metrics={numericColumn.numeric.metrics}
      />
    )
    expect(screen.getByRole('img', { name: /Box plot:/ })).toBeVisible()
    view.rerender(
      <ProfileChart
        chart={{ ...numericColumn.chart, kind: 'BOX' }}
        metrics={numericColumn.numeric.metrics.map((m) =>
          m.key === 'p25' ? { ...m, suppressed: true } : m
        )}
      />
    )
    expect(screen.getByText('Box plot statistics are unavailable or hidden.')).toBeVisible()
  })
  it('computes seven-point averages, preserving missing values and cumulative percentages', () => {
    const rows = chartRows(Array.from({ length: 8 }, (_, i) => ({ x: i, y: i + 1 })))
    expect(rows.slice(0, 6).every((p) => p.average === null)).toBe(true)
    expect(rows[6].average).toBe(4)
    expect(rows[7].average).toBe(5)
    expect(rows[7].cumulative).toBe(100)
    expect(
      chartRows(Array.from({ length: 7 }, (_, i) => ({ y: i === 0 ? null : i })))[6].average
    ).toBeNull()
  })
  it.each(['TIME_SERIES', 'SCATTER'] as const)('renders %s', (kind) => {
    render(
      <ProfileChart
        chart={{
          ...column.chart,
          kind,
          series: [
            {
              name: 'Volume',
              points: [
                { x: 1, y: 10 },
                { x: 2, y: 20 },
              ],
            },
          ],
        }}
      />
    )
    expect(screen.getByRole('img', { name: /Volume/ })).toBeVisible()
  })
  it('renders a heatmap with semantic labels', () => {
    render(<ProfileChart chart={table.heatmap} />)
    expect(screen.getByText('ID: 100%')).toBeVisible()
  })
})
