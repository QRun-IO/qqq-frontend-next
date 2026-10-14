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
import * as api from '@/lib/api/data-analysis'
import { getRecord } from '@/lib/api/tables'
import { savedCases } from '../../../tests/fixtures/data-analysis-saved'
import { relationshipCapabilities } from '../../../tests/fixtures/data-analysis-compare'
import SavedAnalysisViewer from './SavedAnalysisViewer'
vi.mock('@/lib/api/data-analysis')
vi.mock('@/lib/api/tables')
vi.mock('next/dynamic', () => ({ default: () => () => <div>Rendered chart</div> }))
const clients: QueryClient[] = []
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <SavedAnalysisViewer
        id="42"
        tableName="person"
        tableLabel="People"
        fields={relationshipCapabilities.fields}
        onBack={vi.fn()}
      />
    </QueryClientProvider>
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listSavedAnalyses).mockResolvedValue({
    analyses: [{ id: 42, name: 'Review', starred: false, shared: true }],
  })
})
afterEach(() => {
  cleanup()
  clients.forEach((c) => c.clear())
  clients.length = 0
})
for (const item of savedCases)
  it(`renders the saved ${item.definition.kind} fixture and warnings`, async () => {
    vi.mocked(getRecord).mockResolvedValue({
      tableName: 'data_analysis_saved',
      values: {
        id: 42,
        table_name: 'person',
        name: 'Review',
        kind: item.definition.kind,
        definition_json: JSON.stringify(item.definition.request),
        chart_kind: 'BAR',
      },
    })
    vi.mocked(api.runSavedAnalysis).mockResolvedValue({
      ...item.result,
      warnings: ['Some fields are not available to you'],
    })
    const { container } = mount()
    expect(await screen.findByRole('heading', { name: 'Review' })).toBeVisible()
    expect(screen.getByText('Some fields are not available to you')).toBeVisible()
    expect(screen.getByText('Shared')).toBeVisible()
    expect(api.runSavedAnalysis).toHaveBeenCalledWith('42')
    for (const operation of [
      api.columnProfile,
      api.tableProfile,
      api.pivot,
      api.compare,
      api.correlation,
      api.crosstab,
      api.shift,
    ])
      expect(operation).not.toHaveBeenCalled()
    // Every fixture must render a nonempty result beyond the common toolbar.
    expect(
      container.querySelectorAll(
        'table, [data-qqq-id="pivot-cards"], [data-qqq-id="analysis-hidden"], [role="img"], [aria-label="Correlation heatmap"] '
      ).length + screen.queryAllByText('Rendered chart').length
    ).toBeGreaterThan(0)
    expect(await axe(container)).toHaveNoViolations()
  })
it('stars and unstars only after successful server acknowledgement', async () => {
  const item = savedCases[2]
  vi.mocked(getRecord).mockResolvedValue({
    tableName: 'data_analysis_saved',
    values: {
      id: 42,
      table_name: 'person',
      kind: 'PIVOT',
      definition_json: JSON.stringify(item.definition.request),
    },
  })
  vi.mocked(api.runSavedAnalysis).mockResolvedValue(item.result)
  vi.mocked(api.starAnalysis)
    .mockResolvedValueOnce({ starred: true })
    .mockRejectedValueOnce(new Error('Star denied'))
    .mockResolvedValueOnce({ starred: false })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Star' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Unstar' })).toHaveAttribute('aria-pressed', 'true')
  )
  expect(api.starAnalysis).toHaveBeenLastCalledWith('42', true)
  fireEvent.click(screen.getByRole('button', { name: 'Unstar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Star denied')
  expect(screen.getByRole('button', { name: 'Unstar' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Unstar' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Star' })).toHaveAttribute('aria-pressed', 'false')
  )
  expect(api.starAnalysis).toHaveBeenLastCalledWith('42', false)
})
it('reports inaccessible saved records without rendering results', async () => {
  vi.mocked(getRecord).mockRejectedValue(new Error('Record unavailable'))
  vi.mocked(api.runSavedAnalysis).mockResolvedValue({})
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Record unavailable')
  expect(screen.queryByRole('button', { name: 'CSV' })).not.toBeInTheDocument()
})
