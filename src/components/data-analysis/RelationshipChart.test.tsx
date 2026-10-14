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
import { afterEach, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import {
  compareResult,
  scatterResult,
  shiftResult,
} from '../../../tests/fixtures/data-analysis-compare'
import { activeDrill } from '../../../tests/fixtures/data-analysis'
import RelationshipChart from './RelationshipChart'
import { AnalysisDrillContext } from './ProfileParts'

vi.mock('recharts', async (original) => {
  const actual = await original<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div>
        {React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, {
          width: 600,
          height: 320,
        })}
      </div>
    ),
  }
})
afterEach(cleanup)
it('groups category bars on one axis and supplies drill links in its table', async () => {
  const { container } = render(<RelationshipChart chart={compareResult.fields[0].chart} />)
  expect(container.querySelectorAll('.recharts-bar')).toHaveLength(2)
  expect(screen.getByRole('group', { name: 'Grouped bar comparison' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Show as table' }))
  expect(screen.getAllByRole('link', { name: '40' })[0]).toHaveAttribute(
    'href',
    expect.stringContaining('filter=')
  )
  expect((await axe(container)).violations).toEqual([])
})
it('shows two boxes on a common scale and never invents missing quartiles', () => {
  const { rerender } = render(<RelationshipChart chart={compareResult.fields[1].chart} />)
  expect(screen.getAllByRole('img', { name: /Box plot/ })).toHaveLength(2)
  rerender(<RelationshipChart chart={{ kind: 'BOX', series: [{ name: 'Hidden', points: [] }] }} />)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByText('Box plot statistics are unavailable or hidden.')).toBeVisible()
})
it('plots the scatter sample and supplied least-squares line in the same chart', () => {
  const { container } = render(<RelationshipChart chart={scatterResult.chart} />)
  expect(screen.getByRole('group', { name: 'Scatter with trend line' })).toBeVisible()
  expect(container.querySelectorAll('.recharts-scatter')).toHaveLength(2)
  expect(container.querySelector('.recharts-scatter-line')).toBeInTheDocument()
  expect(
    screen.getByText('Trend describes the displayed sample, not the full population.')
  ).toBeVisible()
})
it('plots every shift series using point.label and supports keyboard drills', async () => {
  const drill = vi.fn(() => true)
  const { container } = render(
    <AnalysisDrillContext.Provider value={drill}>
      <RelationshipChart chart={shiftResult.chart} />
    </AnalysisDrillContext.Provider>
  )
  expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(2)
  expect(screen.getByText('January 2026')).toBeVisible()
  expect(screen.queryByText('2026-01-01')).not.toBeInTheDocument()
  const point = container.querySelector('[data-qqq-id="shift-chart-point"]')!
  fireEvent.keyDown(point, { key: 'Enter' })
  expect(drill).toHaveBeenCalledWith(activeDrill)
  expect((await axe(container)).violations).toEqual([])
})
