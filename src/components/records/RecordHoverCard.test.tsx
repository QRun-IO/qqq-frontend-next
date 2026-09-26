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

import { render, screen, waitFor } from '@testing-library/react'
import Link from 'next/link'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { qInstance } from '@/mocks/fixtures/q-instance'
import { server } from '@/mocks/node'
import { recordGet } from '@/mocks/v1-record'
import { RecordHoverCard } from './RecordHoverCard'

function renderPreview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>
    <p>Readable base record</p>
    <RecordHoverCard tableName="person" primaryKey={1} tableMetaData={{ label: 'Person' }}>
      <Link href="/app/person/1">Owner</Link>
    </RecordHoverCard>
  </QueryClientProvider>)
}

describe('RecordHoverCard with lightweight registry metadata', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }))
  afterAll(() => vi.unstubAllGlobals())
  it('keeps the link usable and loads full metadata before a base-only preview on hover', async () => {
    const requests: string[] = []
    server.use(
      http.get('/qqq/v1/metaData/table/person', () => {
        requests.push('metadata')
        return HttpResponse.json(qInstance.tables.person)
      }),
      recordGet('/table/person/1', ({ request }) => {
        requests.push(new URL(request.url).searchParams.get('includeAssociations') ?? '')
        return HttpResponse.json({ tableName: 'person', values: { id: 1, firstName: 'Avery' }, recordLabel: 'Avery Sample' })
      }),
    )
    renderPreview()
    expect(screen.getByText('Readable base record')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Owner' })).toHaveAttribute('href', '/app/person/1')
    expect(requests).toEqual([])
    await userEvent.hover(screen.getByRole('link', { name: 'Owner' }))
    expect(await screen.findByText('Avery Sample')).toBeVisible()
    expect(requests).toEqual(['metadata', 'false'])
  })

  it.each(['metadata', 'record'])('keeps a denied %s preview localized to the hover card', async (failure) => {
    let recordRequests = 0
    server.use(
      http.get('/qqq/v1/metaData/table/person', () => failure === 'metadata'
        ? HttpResponse.json({ error: 'Denied' }, { status: 403 }) : HttpResponse.json(qInstance.tables.person)),
      recordGet('/table/person/1', () => {
        recordRequests++
        return HttpResponse.json({ error: 'Denied' }, { status: 403 })
      }),
    )
    renderPreview()
    await userEvent.hover(screen.getByRole('link', { name: 'Owner' }))
    expect(await screen.findByText('Record preview is unavailable.')).toBeVisible()
    expect(screen.getByText('Readable base record')).toBeVisible()
    await waitFor(() => expect(recordRequests).toBe(failure === 'metadata' ? 0 : 1))
  })
})
