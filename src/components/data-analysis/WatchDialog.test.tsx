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
import { insertRecord } from '@/lib/api/tables'
import { previewWatch } from '@/lib/api/data-analysis'
import { watchPreview } from '../../../tests/fixtures/data-analysis-saved'
import { relationshipCapabilities } from '../../../tests/fixtures/data-analysis-compare'
import { WatchDialog } from './WatchDialog'
vi.mock('@/lib/api/tables')
vi.mock('@/lib/api/data-analysis')
vi.mock('next/dynamic', () => ({
  default:
    () =>
    ({ chart, baselineBand }: { chart: { annotations?: string[] }; baselineBand?: number[] }) => (
      <div aria-label="Preview chart" data-band={JSON.stringify(baselineBand)}>
        {chart.annotations?.map((a) => (
          <p key={a}>{a}</p>
        ))}
      </div>
    ),
}))
const clients: QueryClient[] = []
function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <WatchDialog
        tableName="person"
        fields={relationshipCapabilities.fields}
        fieldName="createdAt"
        filter={{ criteria: [{ fieldName: 'status', operator: 'EQUALS', values: ['Active'] }] }}
      />
    </QueryClientProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Watch' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Count watch' } })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(insertRecord).mockResolvedValue({ tableName: 'data_analysis_watch', values: { id: 9 } })
  vi.mocked(previewWatch).mockResolvedValue(watchPreview)
})
afterEach(() => {
  cleanup()
  clients.forEach((c) => c.clear())
  clients.length = 0
})
it('saves the watch before enabling preview, renders its band and verdict, and passes axe', async () => {
  mount()
  expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
  expect(previewWatch).not.toHaveBeenCalled()
  expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations()
  fireEvent.click(screen.getByRole('button', { name: 'Save watch' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled())
  expect(insertRecord).toHaveBeenCalledWith('data_analysis_watch', {
    name: 'Count watch',
    table_name: 'person',
    date_field: 'createdAt',
    bucket: 'MONTH',
    detector: 'SPIKE',
    severity: 'WARNING',
    enabled: true,
    metric_json: '{"operator":"COUNT"}',
    parameters_json: '{"k":14,"threshold":3.5,"relativeChange":0.5}',
    filter_json: '{"criteria":[{"fieldName":"status","operator":"EQUALS","values":["Active"]}]}',
  })
  expect(screen.getByLabelText('Name')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  expect(await screen.findByText('Count is within the baseline band.')).toBeVisible()
  expect(previewWatch).toHaveBeenCalledWith('9')
  expect(screen.getByLabelText('Preview chart')).toHaveAttribute('data-band', '[8,14]')
  expect(screen.getByText('Baseline band: 8 to 14.')).toBeVisible()
})
for (const [detector, metric, params] of [
  ['DROP', 'AVG', { k: 14, threshold: 3.5, relativeChange: 0.5 }],
  ['OUT_OF_RANGE', 'SUM', { k: 14, min: 0, max: 100 }],
  ['NEW_CATEGORY', 'CATEGORY_SET', { k: 14 }],
  ['NULL_RATE_CREEP', 'NULL_SHARE', { k: 14, delta: 0.05, n: 3 }],
] as const)
  it(`writes only supported ${detector} parameters and the appropriate metric`, async () => {
    mount()
    fireEvent.change(screen.getByLabelText('Detector'), { target: { value: detector } })
    if (detector === 'DROP' || detector === 'OUT_OF_RANGE')
      fireEvent.change(screen.getByLabelText('Metric'), { target: { value: metric } })
    const field = detector === 'NEW_CATEGORY' ? 'status' : 'amount'
    fireEvent.change(screen.getByLabelText('Metric field'), { target: { value: field } })
    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'ERROR' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save watch' }))
    await waitFor(() => expect(insertRecord).toHaveBeenCalled())
    expect(insertRecord).toHaveBeenCalledWith(
      'data_analysis_watch',
      expect.objectContaining({
        detector,
        severity: 'ERROR',
        metric_json: JSON.stringify({ operator: metric, field }),
        parameters_json: JSON.stringify(params),
      })
    )
  })
it('shows failed save and never previews a missing record', async () => {
  vi.mocked(insertRecord).mockRejectedValue(new Error('Watch denied'))
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Save watch' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Watch denied')
  expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
})
