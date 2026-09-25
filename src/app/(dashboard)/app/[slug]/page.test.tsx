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
import * as processesApi from '@/lib/api/processes'
import SlugPage from './page'

const { recordQuery, params, location } = vi.hoisted(() => ({
  recordQuery: vi.fn(() => <div data-testid="record-query" />),
  params: { slug: 'person' },
  location: { search: '' },
}))
vi.mock('next/navigation', () => ({
  useParams: () => params,
  usePathname: () => '/app/' + params.slug,
  useSearchParams: () => new URLSearchParams(location.search),
  useRouter: () => ({ push: vi.fn() }),
}))
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
    location.search = ''
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

const greeting = {
  name: 'greetInteractive', label: 'Greet Interactive', hasPermission: true,
  tableName: 'person', minInputRecords: 1, maxInputRecords: 2,
  frontendSteps: [{
    name: 'setup', label: 'Setup', components: [{ type: 'EDIT_FORM' }],
    formFields: [{ name: 'greetingPrefix', label: 'Greeting Prefix', type: 'STRING', isEditable: true, isHidden: false, isRequired: false }],
  }],
}

describe('SlugPage process initialization', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    params.slug = greeting.name
    location.search = 'recordsParam=recordIds&recordIds=1,3'
    server.use(http.get('/qqq/v1/metaData', () => HttpResponse.json({
      ...registry, processes: { [greeting.name]: { name: greeting.name, label: greeting.label } },
    })))
  })

  it.each([
    ['recordIds', 'recordIds', '1,3', 'recordIds'],
    ['filterJSON', 'filterJSON', '{"criteria":[]}', 'filterJSON'],
    ['queryFilter', 'filterJSON', '{"criteria":[]}', 'filterJSON'],
  ])('loads full metadata before initializing with %s selection', async (selector, field, value, expectedSelector) => {
    location.search = new URLSearchParams({ recordsParam: selector, [field]: value }).toString()
    let releaseMetadata!: () => void
    const metadataReady = new Promise<void>((resolve) => { releaseMetadata = resolve })
    const initialize = vi.spyOn(processesApi, 'processInit').mockResolvedValue({
      processUUID: 'selected-run', nextStep: 'setup', values: {},
    })
    server.use(
      http.get('/qqq/v1/metaData/process/greetInteractive', async () => {
        await metadataReady
        return HttpResponse.json(greeting)
      }),
    )
    renderPage()
    await screen.findByRole('status', { name: 'Loading process metadata' })
    expect(initialize).not.toHaveBeenCalled()
    await act(async () => { releaseMetadata() })
    await screen.findByRole('textbox', { name: 'Greeting Prefix' })
    expect(initialize).toHaveBeenCalledWith(greeting.name, {
      recordsParam: expectedSelector, [field]: value,
    })
  })

  it('does not initialize when full process metadata is denied', async () => {
    let initialized = false
    server.use(
      http.get('/qqq/v1/metaData/process/greetInteractive', () =>
        HttpResponse.json({ error: 'Permission denied' }, { status: 403 })),
      http.post('/qqq/v1/processes/greetInteractive/init', () => {
        initialized = true
        return HttpResponse.json({ processUUID: 'unexpected', values: {} })
      }),
    )
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load process metadata')
    expect(initialized).toBe(false)
  })
})
