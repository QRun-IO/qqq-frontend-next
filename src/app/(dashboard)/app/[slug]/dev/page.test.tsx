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

// Tests for the table developer view's API Docs & Playground

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QContextProvider, useQContext } from '@/lib/context/q-context'
import TableDeveloperViewPage from './page'

const { rapidocLoaded } = vi.hoisted(() => ({ rapidocLoaded: vi.fn() }))

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'person' }),
  usePathname: () => '/app/person/dev',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('rapidoc', () => {
  rapidocLoaded()
  return {}
})

vi.mock('@/lib/api/developer', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api/developer')>(),
  getTableApis: vi.fn(),
  getApiVersions: vi.fn(),
}))

import { getApiVersions, getTableApis } from '@/lib/api/developer'

const getTableApisMock = vi.mocked(getTableApis)
const getApiVersionsMock = vi.mocked(getApiVersions)

const apis = [
  { name: 'person-api', path: '/person-api/', label: 'Person API' },
  { name: 'admin-api', path: '/admin-api/', label: 'Admin API' },
]
const versions: Record<string, { supportedVersions: string[]; currentVersion: string }> = {
  '/person-api/': { supportedVersions: ['2026.Q1', '2026.Q2'], currentVersion: '2026.Q2' },
  '/admin-api/': { supportedVersions: ['v1', 'v2'], currentVersion: 'v1' },
}

/**
 * Shows the page header set through the Q context.
 * @returns The header text.
 */
function PageHeader() {
  const { pageHeader } = useQContext()
  return <p data-testid="page-header">{String(pageHeader)}</p>
}

/**
 * Render the page with fresh query and Q contexts.
 * @returns The render result.
 */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <QContextProvider>
        <PageHeader />
        <TableDeveloperViewPage />
      </QContextProvider>
    </QueryClientProvider>
  )
}

describe('TableDeveloperViewPage API Docs & Playground', () => {
  beforeEach(() => {
    window.localStorage.clear()
    getTableApisMock.mockReset()
    getApiVersionsMock.mockReset()
    getApiVersionsMock.mockImplementation(async (path: string) => versions[path])
  })

  it('selects the first API and its current version and embeds RapiDoc for the table spec', async () => {
    getTableApisMock.mockResolvedValue(apis)
    const { container } = renderPage()

    const section = await screen.findByRole('region', { name: 'API Docs & Playground' })
    expect(section).toHaveAttribute('data-qqq-id', 'table-dev-api-docs')
    const apiSelect = await within(section).findByLabelText('API')
    expect(apiSelect).toHaveAttribute('id', 'table-dev-api-select')
    expect(apiSelect).toHaveAttribute('data-qqq-id', 'select-api')
    expect(apiSelect).toHaveValue('person-api')
    expect(within(apiSelect).getAllByRole('option').map((option) => option.textContent)).toEqual(['Person API', 'Admin API'])
    const versionSelect = await within(section).findByLabelText('Version')
    expect(versionSelect).toHaveAttribute('data-qqq-id', 'select-api-version')
    expect(versionSelect).toHaveValue('2026.Q2')

    await waitFor(() => expect(container.querySelector('rapi-doc')).not.toBeNull())
    const rapiDoc = container.querySelector('[data-qqq-id="table-dev-api-reference"] rapi-doc')!
    expect(rapiDoc).toHaveAttribute('spec-url', '/person-api/2026.Q2/person/openapi.json')
    expect(rapiDoc).toHaveAttribute('primary-color', '#6366f1')
    expect(rapiDoc).toHaveAttribute('show-header', 'false')
    expect(rapiDoc).toHaveAttribute('render-style', 'view')
    expect(rapiDoc).toHaveAttribute('allow-server-selection', 'false')
    expect(rapidocLoaded).toHaveBeenCalled()
    expect(getTableApisMock).toHaveBeenCalledWith('person')
    expect(window.localStorage.getItem('qqq.tableDeveloperView.lastApiName')).toBe('person-api')
    expect(window.localStorage.getItem('qqq.tableDeveloperView.lastApiVersion')).toBe('2026.Q2')
    expect(screen.getByTestId('page-header')).toHaveTextContent('People Developer Mode')
  })

  it('restores the remembered API and version when they are still offered', async () => {
    window.localStorage.setItem('qqq.tableDeveloperView.lastApiName', 'admin-api')
    window.localStorage.setItem('qqq.tableDeveloperView.lastApiVersion', 'v2')
    getTableApisMock.mockResolvedValue(apis)
    const { container } = renderPage()

    expect(await screen.findByLabelText('API')).toHaveValue('admin-api')
    expect(await screen.findByLabelText('Version')).toHaveValue('v2')
    await waitFor(() => expect(container.querySelector('rapi-doc')).toHaveAttribute('spec-url', '/admin-api/v2/person/openapi.json'))
  })

  it('falls back to the first API and the current version when the remembered ones are gone', async () => {
    window.localStorage.setItem('qqq.tableDeveloperView.lastApiName', 'retired-api')
    window.localStorage.setItem('qqq.tableDeveloperView.lastApiVersion', 'v9')
    getTableApisMock.mockResolvedValue(apis)
    renderPage()

    expect(await screen.findByLabelText('API')).toHaveValue('person-api')
    expect(await screen.findByLabelText('Version')).toHaveValue('2026.Q2')
    await waitFor(() => expect(window.localStorage.getItem('qqq.tableDeveloperView.lastApiName')).toBe('person-api'))
  })

  it('switches API and version from the keyboard-operable native selects and remembers them', async () => {
    const user = userEvent.setup()
    getTableApisMock.mockResolvedValue(apis)
    const { container } = renderPage()

    await user.selectOptions(await screen.findByLabelText('API'), 'admin-api')
    expect(await screen.findByLabelText('Version')).toHaveValue('v1')
    await user.selectOptions(screen.getByLabelText('Version'), 'v2')

    await waitFor(() => expect(container.querySelector('rapi-doc')).toHaveAttribute('spec-url', '/admin-api/v2/person/openapi.json'))
    expect(window.localStorage.getItem('qqq.tableDeveloperView.lastApiName')).toBe('admin-api')
    expect(window.localStorage.getItem('qqq.tableDeveloperView.lastApiVersion')).toBe('v2')
  })

  it('shows the empty state without selectors when the table is in no API', async () => {
    getTableApisMock.mockResolvedValue([])
    const { container } = renderPage()

    const empty = await screen.findByText('This table is not available in any APIs.')
    expect(empty).toHaveAttribute('data-qqq-id', 'table-dev-no-apis')
    expect(screen.queryByLabelText('API')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Version')).not.toBeInTheDocument()
    expect(container.querySelector('[data-qqq-id="table-dev-api-reference"]')).toBeNull()
    expect(getApiVersionsMock).not.toHaveBeenCalled()
  })

  it('keeps working when localStorage throws', async () => {
    const storage = window.localStorage
    const blocked = () => { throw new Error('blocked') }
    // The test setup installs a writable localStorage stand-in; swap it for one that refuses access.
    ;(window as { localStorage: unknown }).localStorage = { getItem: blocked, setItem: blocked, removeItem: blocked, clear: blocked }
    try {
      getTableApisMock.mockResolvedValue(apis)
      renderPage()
      expect(await screen.findByLabelText('Version')).toHaveValue('2026.Q2')
    } finally {
      ;(window as { localStorage: unknown }).localStorage = storage
    }
  })

  it('reports a failure to list APIs', async () => {
    getTableApisMock.mockRejectedValue(new Error('Server exploded'))
    renderPage()

    const section = await screen.findByRole('region', { name: 'API Docs & Playground' })
    expect(await within(section).findByRole('alert')).toHaveTextContent('Failed to load APIs: Server exploded')
  })
})
