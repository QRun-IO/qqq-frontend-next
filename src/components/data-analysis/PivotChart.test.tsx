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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'
import { DEFAULT_COLORS } from '@/lib/utils/chart-colors'
import { pivotResult } from '../../../tests/fixtures/data-analysis'
import PivotChart from './PivotChart'

vi.mock('recharts', async (original) => {
  const actual = await original<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div>
        {React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, {
          width: 600,
          height: 300,
        })}
      </div>
    ),
  }
})
afterEach(cleanup)

it('groups column series and separates measures while omitting suppressed numbers', async () => {
  const { container } = render(
    <PivotChart
      result={{
        ...pivotResult,
        cells: [
          ...pivotResult.cells,
          {
            rowIndex: 1,
            columnIndex: 1,
            values: [{ value: 999, formatted: '999', suppressed: true }],
          },
        ],
      }}
      kind="BAR"
    />
  )
  expect(screen.getAllByRole('img')).toHaveLength(2)
  expect(container.querySelectorAll('.recharts-bar')).toHaveLength(4)
  expect(container.querySelector('.recharts-bar-rectangle path')).toHaveAttribute(
    'fill',
    DEFAULT_COLORS[0]
  )
  expect(container.textContent).not.toContain('999')
  expect((await axe(container)).violations).toEqual([])
})

it('renders date lines with chronological labels and no connection across hidden cells', () => {
  const { container } = render(
    <PivotChart
      result={{
        ...pivotResult,
        rowHeaders: [
          [{ value: '2026-02-01', label: 'February' }],
          [{ value: '2026-01-01', label: 'January' }],
        ],
      }}
      kind="TIME_SERIES"
    />
  )
  expect(screen.getAllByRole('img')[0]).toHaveAccessibleName(/Time series/)
  expect(container.querySelectorAll('.recharts-bar')).toHaveLength(0)
  expect(container.querySelectorAll('.recharts-line')).toHaveLength(4)
  const ticks = Array.from(
    container
      .querySelector('.recharts-xAxis')!
      .querySelectorAll('.recharts-cartesian-axis-tick-value')
  ).map((t) => t.textContent)
  expect(ticks).toEqual(['January', 'February'])
})
