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

// Tests for the table Developer view's ESB section wiring

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QContextProvider } from '@/lib/context/q-context'
import { queryClient, queryKeys } from '@/lib/query-client'
import { server } from '@/mocks/node'
import TableDeveloperViewPage from './page'

const { params } = vi.hoisted(() => ({ params: { slug: 'order' } }))
vi.mock('next/navigation', () => ({
  useParams: () => params,
  usePathname: () => `/app/${params.slug}/dev`,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
}))
// The page's API Docs section is covered by page.test.tsx; keep it empty here.
vi.mock('@/lib/api/developer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/developer')>()),
  getTableApis: vi.fn(async () => []),
}))

/**
 * Renders the page with a query client.
 *
 * @param client - The query client; a fresh one without retries by default.
 * @returns The query client, for inspecting query state.
 */
function renderPage(
  client: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
): QueryClient {
  render(
    <QueryClientProvider client={client}>
      <QContextProvider>
        <TableDeveloperViewPage />
      </QContextProvider>
    </QueryClientProvider>
  )
  return client
}

/**
 * Waits until the table's metadata has rendered and its ESB request has settled.
 *
 * @param client - The page's query client.
 * @param tableName - The table shown.
 */
async function settled(client: QueryClient, tableName: string): Promise<void> {
  await screen.findByText('Fields')
  await waitFor(() =>
    expect(client.getQueryState(queryKeys.esbTable(tableName))?.status).toBe('success')
  )
}

describe('TableDeveloperViewPage ESB section', () => {
  beforeEach(() => {
    params.slug = 'order'
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('shows the ESB section returned for the table', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'Enterprise Service Bus' })
    ).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Publications' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Subscribers' })).toBeInTheDocument()
  })

  it('omits the section when the user may not read the table', async () => {
    server.use(
      http.get('/qqq/v1/esb/table/order', () =>
        HttpResponse.json({ error: 'Permission denied.' }, { status: 403 })
      )
    )
    const client = renderPage()
    await settled(client, 'order')
    expect(
      screen.queryByRole('heading', { name: 'Enterprise Service Bus' })
    ).not.toBeInTheDocument()
  })

  it('omits the section when the table has no ESB metadata', async () => {
    params.slug = 'person'
    const client = renderPage()
    await settled(client, 'person')
    expect(
      screen.queryByRole('heading', { name: 'Enterprise Service Bus' })
    ).not.toBeInTheDocument()
  })

  it('omits the section without a toast when a backend without the ESB module answers with its SPA page', async () => {
    server.use(
      http.get('/qqq/v1/esb/table/order', () =>
        HttpResponse.html('<!doctype html><html><body>SPA</body></html>')
      )
    )
    const client = renderPage(queryClient)
    await settled(client, 'order')
    expect(
      screen.queryByRole('heading', { name: 'Enterprise Service Bus' })
    ).not.toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
