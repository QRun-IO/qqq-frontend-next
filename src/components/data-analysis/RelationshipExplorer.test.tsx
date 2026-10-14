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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe } from 'jest-axe'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { QTableMetaData } from '@/types'
import { compare, correlation, crosstab, shift, scatter } from '@/lib/api/data-analysis'
import {
  encodeExplore,
  decodeExplore,
  validateExplore,
  type RelationshipView,
  type ExploreLayout,
} from '@/lib/utils/data-analysis-explore'
import { correlationColor } from '@/lib/utils/chart-colors'
import {
  compareResult,
  correlationResult,
  crosstabResult,
  shiftResult,
  scatterResult,
  relationshipCapabilities,
} from '../../../tests/fixtures/data-analysis-compare'
import { activeDrill } from '../../../tests/fixtures/data-analysis'
import RelationshipExplorer from './RelationshipExplorer'
import {
  CompareResult,
  CorrelationResult,
  CrosstabResult,
  ShiftResult,
  Significance,
} from './RelationshipResults'
import { AnalysisDrillContext } from './ProfileParts'

vi.mock('@/lib/api/data-analysis', () => ({
  compare: vi.fn(),
  correlation: vi.fn(),
  crosstab: vi.fn(),
  shift: vi.fn(),
  scatter: vi.fn(),
}))
vi.mock('next/dynamic', () => ({ default: () => () => <div>Chart</div> }))
const clients: QueryClient[] = []
const metadata = {
  name: 'person',
  label: 'People',
  fields: Object.fromEntries(
    relationshipCapabilities.fields.map((f) => [
      f.name,
      { name: f.name, label: f.label, type: f.type },
    ])
  ),
} as QTableMetaData
const props = {
  tableName: 'person',
  tableMetaData: metadata,
  fields: relationshipCapabilities.fields,
  filter: activeDrill.filter,
  encoded: null,
  onRun: vi.fn(),
  onBack: vi.fn(),
}
const layouts: Record<RelationshipView, ExploreLayout> = {
  compare: {
    fields: ['status', 'amount'],
    labelA: 'Café 日本',
    labelB: 'Whole table',
    sideB: 'whole',
  },
  correlation: { fields: ['id', 'amount'] },
  crosstab: { rowField: 'status', columnField: 'firstName' },
  shift: { field: 'status', dateField: 'createdAt', bucket: 'MONTH' },
}
function mount(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(compare).mockResolvedValue(compareResult)
  vi.mocked(correlation).mockResolvedValue(correlationResult)
  vi.mocked(crosstab).mockResolvedValue(crosstabResult)
  vi.mocked(shift).mockResolvedValue(shiftResult)
  vi.mocked(scatter).mockResolvedValue(scatterResult)
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((c) => c.clear())
})

it.each(Object.keys(layouts) as RelationshipView[])(
  'round trips %s URLs and strips query-owned filters',
  (view) => {
    const layout = { ...layouts[view], filter: { criteria: [] }, filterA: { criteria: [] } }
    expect(decodeExplore(view, encodeExplore(view, layout))).toEqual(layouts[view])
    expect(() => decodeExplore(view, 'garbage')).toThrow('URL is invalid')
  }
)
it('rejects duplicate, insufficient or excessive correlation fields and malformed B filters', () => {
  for (const fields of [['id'], ['id', 'id'], Array.from({ length: 13 }, (_, i) => String(i))])
    expect(validateExplore('correlation', { fields })).not.toBeNull()
  expect(validateExplore('compare', { ...layouts.compare, sideB: 'saved' })).toContain('saved view')
  expect(
    validateExplore('compare', {
      ...layouts.compare,
      sideB: 'edit',
      filterB: { criteria: [{ fieldName: 'id', operator: 'BOGUS', values: [] }] },
    })
  ).toContain('does not yet support')
})
it('posts the current query as A, supports whole table and editable labels', async () => {
  mount(
    <RelationshipExplorer
      {...props}
      view="compare"
      encoded={encodeExplore('compare', layouts.compare)}
    />
  )
  await screen.findByText('A and B differ (p = 0.003).')
  expect(compare).toHaveBeenCalledWith('person', {
    fields: ['status', 'amount'],
    labelA: 'Café 日本',
    labelB: 'Whole table',
    filterA: activeDrill.filter,
    filterB: null,
  })
  fireEvent.change(screen.getByLabelText('Side A label'), { target: { value: 'Subset' } })
  fireEvent.click(screen.getByRole('button', { name: 'Run' }))
  expect(props.onRun).toHaveBeenCalledWith(expect.objectContaining({ labelA: 'Subset' }))
})
it('uses a saved view filter and the actual FilterBuilder dialog', async () => {
  mount(
    <RelationshipExplorer
      {...props}
      view="compare"
      savedViews={[
        {
          id: 7,
          label: 'Active people',
          tableName: 'person',
          view: { queryFilter: activeDrill.filter },
        },
      ]}
    />
  )
  fireEvent.click(screen.getByLabelText('Status'))
  fireEvent.change(screen.getByLabelText('Side B', { exact: true }), { target: { value: 'saved' } })
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Saved view'), { target: { value: '7' } })
  fireEvent.click(screen.getByRole('button', { name: 'Run' }))
  expect(props.onRun).toHaveBeenLastCalledWith(
    expect.objectContaining({ filterB: activeDrill.filter, savedViewId: 7 })
  )
  fireEvent.change(screen.getByLabelText('Side B', { exact: true }), { target: { value: 'edit' } })
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Edit filter B')
  expect(screen.getByRole('button', { name: 'Clear all' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
  fireEvent.click(screen.getByRole('button', { name: 'Apply filter B' }))
  fireEvent.click(screen.getByRole('button', { name: 'Run' }))
  expect(props.onRun).toHaveBeenLastCalledWith(
    expect.objectContaining({ filterB: expect.objectContaining({ criteria: [] }) })
  )
})
it('blocks revoked fields, unsupported scope and invalid URLs without running', () => {
  const { rerender } = mount(
    <RelationshipExplorer
      {...props}
      view="compare"
      fields={[]}
      encoded={encodeExplore('compare', layouts.compare)}
    />
  )
  expect(screen.getByRole('alert')).toHaveTextContent('no longer available')
  expect(compare).not.toHaveBeenCalled()
  rerender(
    <QueryClientProvider client={clients[0]}>
      <RelationshipExplorer {...props} view="compare" encoded="garbage" />
    </QueryClientProvider>
  )
  expect(screen.getByRole('alert')).toHaveTextContent('URL is invalid')
  expect(compare).not.toHaveBeenCalled()
})
it.each(['correlation', 'crosstab', 'shift'] as const)(
  'restores and executes %s with query scope',
  async (view) => {
    mount(
      <RelationshipExplorer {...props} view={view} encoded={encodeExplore(view, layouts[view])} />
    )
    const call = { correlation, crosstab, shift }[view]
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith('person', { ...layouts[view], filter: activeDrill.filter })
    )
  }
)
it('renders sentences, all three badges, Hidden and drills without axe violations', async () => {
  const drill = vi.fn(() => true)
  const { container } = mount(
    <AnalysisDrillContext.Provider value={drill}>
      <CompareResult result={compareResult} fields={props.fields} />
    </AnalysisDrillContext.Provider>
  )
  expect(screen.getByText('Significant', { exact: true })).toBeVisible()
  expect(screen.getAllByText('Not significant')).toHaveLength(2)
  expect(screen.getByText('Not applicable', { exact: true })).toBeVisible()
  expect(screen.getAllByText('Hidden')).toHaveLength(2)
  expect(screen.getByText('Two-proportion z-test · p = 0.05')).toBeVisible()
  fireEvent.click(screen.getAllByRole('link', { name: '40' })[0])
  expect(drill).toHaveBeenCalledWith(activeDrill)
  expect((await axe(container)).violations).toEqual([])
})
it('does not mark p = .05, missing p or invalid tests significant', () => {
  const { rerender } = render(<Significance value={{ applicable: true, pValue: 0.05 }} />)
  expect(screen.getByText('Not significant')).toBeVisible()
  rerender(<Significance value={{ applicable: false, pValue: 0.001 }} />)
  expect(screen.getByText('Not applicable')).toBeVisible()
})
it('opens the supplied scatter from an accessible coloured heatmap cell and offers a table', async () => {
  const { container } = mount(
    <CorrelationResult result={correlationResult} fields={props.fields} tableName="person" />
  )
  const cell = screen.getByRole('button', { name: 'ID and Amount: r = -0.75' })
  expect(cell).toHaveStyle(correlationColor(-0.75))
  expect(screen.getByRole('button', { name: 'Amount and Amount: r = unavailable' })).toBeDisabled()
  fireEvent.click(cell)
  expect(
    await screen.findByText('The sample has a Pearson correlation of r = -0.75.')
  ).toBeVisible()
  expect(scatter).toHaveBeenCalledWith('person', correlationResult.cells[1].scatter)
  fireEvent.click(screen.getByRole('button', { name: 'Show as table' }))
  expect(screen.getByRole('table')).toBeVisible()
  expect((await axe(container)).violations).toEqual([])
})
it('shows crosstab counts, share toggles, Hidden and the chi-square conclusion', async () => {
  const { container } = render(<CrosstabResult result={crosstabResult} />)
  expect(screen.getByText('Status and First name are associated (p = 0.01).')).toBeVisible()
  expect(screen.getByText('Cramér’s V: 0.32')).toBeVisible()
  expect(screen.getByRole('link', { name: '42' })).toHaveAttribute(
    'href',
    expect.stringContaining('filter=')
  )
  fireEvent.click(screen.getByLabelText('Row shares'))
  fireEvent.click(screen.getByLabelText('Column shares'))
  expect(screen.getByRole('link', { name: '60%' })).toBeVisible()
  expect(screen.getByRole('link', { name: '70%' })).toBeVisible()
  expect(screen.getAllByText('Hidden')).toHaveLength(3)
  expect((await axe(container)).violations).toEqual([])
})
it('renders shift labels, PSI sentence and metric drills accessibly', async () => {
  const { container } = render(<ShiftResult result={shiftResult} />)
  expect(screen.getByText(shiftResult.sentence)).toBeVisible()
  expect(screen.getByRole('heading', { name: 'February 2026 (incomplete)' })).toBeVisible()
  expect(screen.getByRole('link', { name: '0.18' })).toBeVisible()
  expect((await axe(container)).violations).toEqual([])
})
it('keeps heatmap text AA for negative, zero, positive and missing values in either theme', () => {
  const luminance = (rgb: number[]) =>
    rgb
      .map((channel) => {
        const v = channel / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  // the translucent tint over each theme's background, read with that theme's text colour
  const themes = [
    { background: [255, 255, 255], text: [17, 24, 39] },
    { background: [17, 19, 24], text: [249, 250, 251] },
  ]
  for (const r of [-1, -0.5, 0, 0.5, 1, null]) {
    const [red, green, blue, alpha] = correlationColor(r).backgroundColor.match(/[\d.]+/g)!.map(Number)
    for (const { background, text } of themes) {
      const composite = [red, green, blue].map((c, i) => c * alpha + background[i] * (1 - alpha))
      expect(contrast(composite, text)).toBeGreaterThanOrEqual(4.5)
    }
  }
  expect(correlationColor(-1).backgroundColor).not.toBe(correlationColor(1).backgroundColor)
})
