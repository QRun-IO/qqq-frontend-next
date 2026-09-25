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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { QWidgetMetaData } from '@/types'
import { normalizeQqqChart, QqqChartWidget } from './QqqChartWidget'
import type { QqqChartVariant } from './QqqChartWidget'
import type { QqqChartPayload } from './widget-types'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const meta = (name: string, label = 'Chart Label'): QWidgetMetaData => ({ name, label, hasPermission: true })

function draw(variant: QqqChartVariant, data: QqqChartPayload, name = 'w') {
  return render(<QqqChartWidget widgetMetaData={meta(name)} data={data} variant={variant} />)
}

/** Rows of the accessible data table as [label, ...values]. */
function tableRows(name: string): string[][] {
  const table = document.querySelector(`[data-qqq-id="chart-data-${name}"]`) as HTMLTableElement
  return Array.from(table.tBodies[0].rows).map((row) => Array.from(row.cells).map((cell) => cell.textContent ?? ''))
}

const fruitColors = ['#FF0000', '#FF8000', '#FFFF00', '#00FF00', '#0000FF']
const fruitLabels = ['Apple', 'Orange', 'Banana', 'Lime', 'Blueberry']

/** SampleBarChartWidget as serialized by the backend (after fetchWidgetData spreads chartData). */
const sampleBar: QqqChartPayload = {
  title: 'Bar Chart',
  chartData: {
    labels: fruitLabels,
    datasets: [{ label: 'One', data: [100, 150, 75, 100, 200], urls: [null, null, null, null, null], backgroundColors: fruitColors }],
  },
  isCurrency: false,
  height: 0,
  type: 'chart',
}

afterEach(() => {
  push.mockReset()
})

describe('normalizeQqqChart', () => {
  it('reads chartData first and falls back to top-level labels and datasets', () => {
    const nested = normalizeQqqChart(sampleBar)
    expect('chart' in nested && nested.chart.labels).toEqual(fruitLabels)
    const flat = normalizeQqqChart({ labels: ['A'], datasets: [{ label: 'S', data: [3] }] })
    expect('chart' in flat && flat.chart.datasets[0].data).toEqual([3])
  })

  it('names the first malformed field', () => {
    expect(normalizeQqqChart({ chartData: 'nope' })).toEqual({ problem: 'chartData' })
    expect(normalizeQqqChart({ chartData: { invalidShape: true } })).toEqual({ problem: 'chartData.labels' })
    expect(normalizeQqqChart({ chartData: { labels: { a: 1 }, datasets: [] } })).toEqual({ problem: 'chartData.labels' })
    expect(normalizeQqqChart({ chartData: { labels: [], datasets: 3 } })).toEqual({ problem: 'chartData.datasets' })
    expect(normalizeQqqChart({ chartData: { labels: ['a'], datasets: [{ data: 'x' }] } })).toEqual({ problem: 'chartData.datasets[0].data' })
  })
})

describe('QqqChartWidget', () => {
  it('draws one bar per label with the per-point background colors', () => {
    const { container } = draw('bar', sampleBar, 'SampleBarChartWidget')
    expect(container.querySelector('[data-qqq-id="chart-bar-SampleBarChartWidget"]')).toBeInTheDocument()
    expect(screen.getByText('Bar Chart')).toBeInTheDocument()
    const bars = container.querySelectorAll('.recharts-bar-rectangle path')
    expect(bars).toHaveLength(5)
    expect(Array.from(bars).map((bar) => bar.getAttribute('fill'))).toEqual(fruitColors)
    expect(screen.getByRole('img', { name: 'Bar Chart chart' })).toBeInTheDocument()
    expect(tableRows('SampleBarChartWidget')).toEqual([['Apple', '100'], ['Orange', '150'], ['Banana', '75'], ['Lime', '100'], ['Blueberry', '200']])
    expect(within(container.querySelector('[data-qqq-id="chart-data-SampleBarChartWidget"]') as HTMLElement).getByRole('columnheader', { name: 'One' })).toBeInTheDocument()
  })

  it('draws an untyped chart output (PersonsByCreateDateBarChart) including a zero month', () => {
    const { container } = draw('bar', {
      title: 'Persons created per Month',
      chartData: { labels: ['Jan. 2022', 'Feb. 2022', 'Mar. 2022', 'Apr. 2022', 'May 2022'], datasets: [{ label: 'Person records', data: [17, 42, 47, 0, 64] }] },
      type: 'chart',
    }, 'persons')
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(5)
    expect(tableRows('persons').map((row) => row[1])).toEqual(['17', '42', '47', '0', '64'])
  })

  it('draws horizontal bars with negative values left of zero and the payload height', () => {
    const { container } = draw('horizontalBar', {
      title: 'Owned horizontal',
      description: 'Owned <b>data</b>',
      chartData: { labels: ['First', 'Zero', 'Negative'], datasets: [{ label: 'Owned series', data: [5, 0, -2] }] },
      height: 240,
      type: 'chart',
    }, 'accHorizontalBarChart')
    const canvas = container.querySelector('[data-qqq-id="chart-canvas-accHorizontalBarChart"]') as HTMLElement
    expect(canvas.style.height).toBe('240px')
    expect(container.querySelector('.recharts-reference-line')).toBeInTheDocument()
    const description = container.querySelector('[data-qqq-id="chart-description-accHorizontalBarChart"]') as HTMLElement
    expect(description.querySelector('b')?.textContent).toBe('data')
    expect(tableRows('accHorizontalBarChart')).toEqual([['First', '5'], ['Zero', '0'], ['Negative', '-2']])
    const groups = container.querySelectorAll('.recharts-bar-rectangle')
    expect(groups).toHaveLength(3)
    const zeroX = Number(container.querySelector('.recharts-reference-line-line')?.getAttribute('x1'))
    const first = groups[0].querySelector('path') as SVGPathElement
    const negative = groups[2].querySelector('path') as SVGPathElement
    expect(Number(first.getAttribute('x'))).toBeCloseTo(zeroX)
    expect(Number(first.getAttribute('width'))).toBeGreaterThan(0)
    expect(Number(negative.getAttribute('width'))).toBeLessThan(0)
    expect(groups[1].querySelector('path')).toBeNull()
  })

  it('stacks datasets with their colors and a legend', () => {
    const { container } = draw('stackedBar', {
      chartData: {
        labels: ['North', 'South'],
        datasets: [{ label: 'Owned first', data: [3, 4], color: '#FF0000' }, { label: 'Owned second', data: [5, 1], color: '#0000FF' }],
      },
      type: 'chart',
    }, 'accStackedBars')
    const bars = Array.from(container.querySelectorAll('.recharts-bar-rectangle path'))
    expect(bars.map((bar) => bar.getAttribute('fill'))).toEqual(['#FF0000', '#FF0000', '#0000FF', '#0000FF'])
    const legend = container.querySelector('[data-qqq-id="chart-legend-accStackedBars"]') as HTMLElement
    expect(legend.textContent).toContain('Owned first')
    expect(legend.textContent).toContain('Owned second')
    expect(tableRows('accStackedBars')).toEqual([['North', '3', '5'], ['South', '4', '1']])
  })

  it('draws the sample stacked chart with per-point colors and its subheader', () => {
    const { container } = draw('stackedBar', {
      chartData: {
        labels: fruitLabels,
        datasets: [
          { label: 'One', data: [100, 150, 75, 100, 200], backgroundColors: fruitColors },
          { label: 'Two', data: [50, 100, 75, 150, 75], backgroundColors: fruitColors },
        ],
      },
      chartSubheaderData: { mainNumber: 1000, vsPreviousPercent: 900, vsPreviousNumber: 100, isUpVsPrevious: true, isGoodVsPrevious: true, vsDescription: 'vs prev period' },
      type: 'chart',
    }, 'SampleStackedBarChartWidget')
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(10)
    expect(screen.getByText('1,000')).toBeInTheDocument()
    const change = container.querySelector('[data-qqq-id="chart-subheader-change-SampleStackedBarChartWidget"]') as HTMLElement
    expect(change.dataset.direction).toBe('up')
    expect(change.dataset.good).toBe('true')
    expect(change.textContent).toContain('900%')
    expect(container.querySelector('[data-qqq-id="chart-subheader-description-SampleStackedBarChartWidget"]')?.textContent).toBe('vs prev period (100)')
  })

  it('draws one line per dataset with a point per label', () => {
    const { container } = draw('line', {
      title: 'Line Chart',
      description: 'Total units have been <strong>increasing</strong> over the last five months.',
      chartData: { labels: ['January', 'February', 'March', 'April', 'May'], datasets: [{ label: 'Units', data: [1753, 1830, 920, 1543, 1804] }] },
      type: 'chart',
    }, 'SampleLineChartWidget')
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(1)
    const points = Array.from(container.querySelectorAll('circle.qqq-chart-point'))
    expect(points.map((point) => point.getAttribute('data-value'))).toEqual(['1753', '1830', '920', '1543', '1804'])
    expect(container.querySelector('[data-qqq-id="chart-description-SampleLineChartWidget"] strong')?.textContent).toBe('increasing')
  })

  it('draws a compact small line chart with its title and HTML description', () => {
    const { container } = draw('smallLine', {
      title: 'Small Line Chart',
      description: 'Total units have been <strong>increasing</strong> over the last five months.',
      chartData: { labels: ['January', 'February', 'March', 'April', 'May'], datasets: [{ label: 'Units', data: [1753, 1830, 920, 1543, 1804] }] },
      type: 'chart',
    }, 'SampleSmallLineChartWidget')
    const canvas = container.querySelector('[data-qqq-id="chart-canvas-SampleSmallLineChartWidget"]') as HTMLElement
    expect(canvas.style.height).toBe('140px')
    expect(container.querySelector('[data-qqq-id="chart-title-SampleSmallLineChartWidget"]')?.textContent).toBe('Small Line Chart')
    expect(container.querySelectorAll('circle.qqq-chart-point')).toHaveLength(5)
    expect(container.querySelector('.recharts-cartesian-grid')).toBeNull()
  })

  it('draws a pie with slice colors, a value legend and the subheader', () => {
    const { container } = draw('pie', {
      chartData: { labels: fruitLabels, datasets: [{ label: 'Pie', data: [100, 150, 75, 100, 200], backgroundColors: fruitColors }] },
      chartSubheaderData: { mainNumber: 1000, vsPreviousPercent: 900, vsPreviousNumber: 100, isUpVsPrevious: true, isGoodVsPrevious: true, vsDescription: 'vs prev period' },
      type: 'chart',
    }, 'SamplePieChartWidget')
    const sectors = Array.from(container.querySelectorAll('.recharts-pie-sector path'))
    expect(sectors.map((sector) => sector.getAttribute('fill'))).toEqual(fruitColors)
    const legend = container.querySelector('[data-qqq-id="chart-legend-SamplePieChartWidget"]') as HTMLElement
    expect(Array.from(legend.querySelectorAll('li')).map((item) => item.textContent)).toEqual(['Apple: 100', 'Orange: 150', 'Banana: 75', 'Lime: 100', 'Blueberry: 200'])
    expect(screen.getByText('1,000')).toBeInTheDocument()
  })

  it('formats currency in the data table and legend', () => {
    draw('pie', {
      isCurrency: true,
      chartData: { labels: ['Cost'], datasets: [{ label: 'Money', data: [1234.5] }] },
    }, 'money')
    expect(tableRows('money')).toEqual([['Cost', '$1,234.50']])
    expect(screen.getByText('Cost: $1,234.50')).toBeInTheDocument()
  })

  it('navigates internally for a bar url and ignores points without one', () => {
    const { container } = draw('bar', {
      chartData: { labels: ['Linked', 'Plain'], datasets: [{ label: 'S', data: [3, 4], urls: ['/app/person', null] }] },
    }, 'linked')
    const bars = container.querySelectorAll('.recharts-bar-rectangle path')
    fireEvent.click(bars[1])
    expect(push).not.toHaveBeenCalled()
    fireEvent.click(bars[0])
    expect(push).toHaveBeenCalledWith('/app/person')
  })

  it('navigates from a line point and a pie slice url', () => {
    const line = draw('line', { chartData: { labels: ['A', 'B'], urls: ['/app/pet', null], datasets: [{ label: 'S', data: [1, 2] }] } }, 'lineLinks')
    const points = line.container.querySelectorAll('circle.qqq-chart-point')
    fireEvent.click(points[1])
    expect(push).not.toHaveBeenCalled()
    fireEvent.click(points[0])
    expect(push).toHaveBeenCalledWith('/app/pet')
    line.unmount()
    push.mockReset()
    const pie = draw('pie', { chartData: { labels: ['A', 'B'], datasets: [{ label: 'S', data: [1, 2], urls: [null, '/app/carrier'] }] } }, 'pieLinks')
    const sectors = pie.container.querySelectorAll('.recharts-pie-sector path')
    fireEvent.click(sectors[1])
    expect(push).toHaveBeenCalledWith('/app/carrier')
  })

  it('links the subheader numbers when urls are given', () => {
    draw('bar', {
      chartData: { labels: ['A'], datasets: [{ data: [1] }] },
      chartSubheaderData: { mainNumber: 42, mainNumberUrl: '/app/person', vsDescription: 'vs before', previousNumberUrl: '/app/pet', vsPreviousNumber: 7 },
    }, 'subLinks')
    expect(screen.getByRole('link', { name: '42' })).toHaveAttribute('href', '/app/person')
    expect(screen.getByRole('link', { name: 'vs before (7)' })).toHaveAttribute('href', '/app/pet')
  })

  it('shows the empty message for charts without labels or values', () => {
    const { container } = draw('bar', {
      title: 'Empty owned chart',
      chartData: { datasets: [{ label: 'Owned series' }] },
      type: 'chart',
    }, 'accEmptyBarChart')
    expect(screen.getByText('No chart data available')).toBeInTheDocument()
    expect(screen.getByText('Empty owned chart')).toBeInTheDocument()
    expect(container.querySelector('svg.recharts-surface')).toBeNull()
    draw('line', { chartData: { labels: ['A'], datasets: [{ label: 'S', data: [null] }] } }, 'allNull')
    expect(screen.getAllByText('No chart data available')).toHaveLength(2)
  })

  it('shows a contained notice instead of throwing for malformed payloads', () => {
    draw('bar', { type: 'chart', chartData: { invalidShape: true } as unknown as QqqChartPayload['chartData'] }, 'accMalformedChart')
    expect(screen.getByRole('alert')).toHaveTextContent('The chart widget data is not in the expected format (chartData.labels).')
  })
})
