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
import { column, numericColumn, table } from '../../../tests/fixtures/data-analysis'
import ProfileChart, { chartRows } from './ProfileChart'

vi.mock('recharts', async (original) => {
  const actual = await original<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div>
        {React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, {
          width: 480,
          height: 240,
        })}
      </div>
    ),
  }
})
afterEach(cleanup)

describe('semantic profile charts', () => {
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
