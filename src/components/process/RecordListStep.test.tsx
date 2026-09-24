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

import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/mocks/node'
import { RecordListStep } from './RecordListStep'

function renderRecords() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RecordListStep processName="greet" processUUID="owned-run"
        step={{ name: 'results', label: 'Results', components: [{ type: 'RECORD_LIST' }], recordListFields: [{
          name: 'greeting', label: 'Greeting', type: 'STRING', isRequired: false,
          isEditable: false, isHidden: false, isHeavy: false, adornments: [],
        }] }}
        stepValues={{}} isLoading={false} onSubmit={vi.fn()} onCancel={vi.fn()}
        canGoBack={false} isLastStep />
    </QueryClientProvider>
  )
}

describe('real process record preview', () => {
  it('loads pages from the existing route and uses the server total', async () => {
    const requests: number[] = []
    server.use(http.get('/processes/greet/owned-run/records', ({ request }) => {
      const params = new URL(request.url).searchParams
      const skip = Number(params.get('skip'))
      expect(params.get('limit')).toBe('10')
      requests.push(skip)
      return HttpResponse.json({ totalRecords: 12, records: Array.from({ length: skip ? 2 : 10 }, (_, i) => ({
        values: { greeting: `Hello person ${skip + i}` },
      })) })
    }))
    renderRecords()
    await screen.findByText('Hello person 0', { exact: true })
    expect(screen.getByText('12', { exact: true })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('Hello person 11', { exact: true })
    expect(screen.queryByText('Hello person 0', { exact: true })).not.toBeInTheDocument()
    expect(requests).toEqual([0, 10])
  })

  it('shows failed loading without an empty preview or confirmation, and supports retry', async () => {
    let attempts = 0
    server.use(http.get('/processes/greet/owned-run/records', () => {
      attempts++
      return attempts === 1 ? HttpResponse.json({ error: 'Permission denied' }, { status: 403 })
        : HttpResponse.json({ totalRecords: 1, records: [{ values: { greeting: 'Hello Avery' } }] })
    }))
    renderRecords()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load process records')
    expect(screen.queryByText('No records to display')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm & Submit' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Hello Avery')
    expect(screen.getByRole('button', { name: 'Confirm & Submit' })).toBeEnabled()
  })
})
