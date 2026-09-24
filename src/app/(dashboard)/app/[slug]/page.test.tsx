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

import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QContextProvider } from '@/lib/context/q-context'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { server } from '@/mocks/node'
import SlugPage from './page'

const { recordQuery, params } = vi.hoisted(() => ({
  recordQuery: vi.fn(() => <div data-testid="record-query" />),
  params: { slug: 'person' },
}))
vi.mock('next/navigation', () => ({ useParams: () => params }))
vi.mock('@/components/query', () => ({ RecordQuery: recordQuery }))
vi.mock('@/components/widgets', () => ({ AppHome: () => <div>App home</div> }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <QContextProvider><SlugPage /></QContextProvider>
    </QueryClientProvider>
  )
}

// The V1 registry deliberately omits fields, sections, primary keys and joins.
const registry = {
  ...qInstance,
  tables: Object.fromEntries(Object.entries(qInstance.tables).map(([name, table]) => [name, {
    name, label: table.label, readPermission: table.readPermission,
    insertPermission: table.insertPermission,
  }])),
}

describe('SlugPage table metadata readiness', () => {
  beforeEach(() => {
    params.slug = 'person'
    recordQuery.mockClear()
    server.use(http.get('/qqq/v1/metaData', () => HttpResponse.json(registry)))
  })

  it('waits for full active metadata and passes the light permission registry separately', async () => {
    let releaseTable!: () => void
    const tableReady = new Promise<void>((resolve) => { releaseTable = resolve })
    let requested = false
    server.use(http.get('/qqq/v1/metaData/table/person', async () => {
      requested = true
      await tableReady
      return HttpResponse.json(qInstance.tables.person)
    }))
    renderPage()
    try {
      await waitFor(() => expect(requested).toBe(true))
      expect(screen.queryByTestId('record-query')).not.toBeInTheDocument()
      expect(screen.getByRole('status', { name: 'Loading table metadata' })).toBeInTheDocument()
    } finally {
      await act(async () => { releaseTable() })
    }
    await screen.findByTestId('record-query')
    expect(recordQuery).toHaveBeenLastCalledWith(expect.objectContaining({
      tableMetaData: qInstance.tables.person, allTables: registry.tables,
    }), undefined)
    expect(registry.tables.person).not.toHaveProperty('fields')
  })

  it('shows full-table failure without rendering a query from registry metadata', async () => {
    server.use(http.get('/qqq/v1/metaData/table/person', () =>
      HttpResponse.json({ error: 'Permission denied' }, { status: 403 })))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load table metadata')
    expect(recordQuery).not.toHaveBeenCalled()
  })

  it('does not fetch full table metadata when an app takes priority over a same-name table', async () => {
    const metadata = { ...registry, apps: { person: { name: 'person', label: 'People app' } } }
    let requested = false
    server.use(
      http.get('/qqq/v1/metaData', () => HttpResponse.json(metadata)),
      http.get('/qqq/v1/metaData/table/person', () => {
        requested = true
        return HttpResponse.json(qInstance.tables.person)
      }),
    )
    renderPage()
    await screen.findByText('App home')
    expect(requested).toBe(false)
    expect(recordQuery).not.toHaveBeenCalled()
  })
})
