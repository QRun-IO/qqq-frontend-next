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

// Tests for the search page: URL state (q, tables, view, sort), per-table sections and
// filter counts, one-table paging, honest failure and fallback states, quick actions

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type AxiosResponse } from 'axios'

const replaceMock = vi.fn()
const urlState = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/app/search',
  useSearchParams: () => urlState.params,
}))
vi.mock('@/lib/context/q-context', () => ({ useQContext: () => ({ setPageHeader: vi.fn() }) }))
const ACCOUNT_TABLE = {
  name: 'account', label: 'Accounts', isHidden: false, readPermission: true, editPermission: true, capabilities: ['TABLE_GET', 'TABLE_QUERY', 'TABLE_UPDATE'],
  primaryKeyField: 'id',
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER', isHidden: false, isHeavy: false, adornments: [] },
    name: { name: 'name', label: 'Name', type: 'STRING', isHidden: false, isHeavy: false, adornments: [] },
    status: { name: 'status', label: 'Status', type: 'STRING', isHidden: false, isHeavy: false, adornments: [] },
    owner: { name: 'owner', label: 'Owner', type: 'STRING', isHidden: false, isHeavy: false, adornments: [] },
    notes: { name: 'notes', label: 'Notes', type: 'TEXT', isHidden: false, isHeavy: true, adornments: [] },
  },
  sections: [
    { name: 'identity', label: 'Identity', tier: 'T1', isHidden: false, fieldNames: ['id', 'name', 'status', 'owner', 'notes'] },
    { name: 'more', label: 'More', tier: 'T2', isHidden: false, fieldNames: ['notes'] },
  ],
}
const media = vi.hoisted(() => ({ wide: false }))
vi.mock('@/lib/hooks/use-media-query', () => ({ useMediaQuery: () => media.wide, PHONE_MEDIA_QUERY: '(max-width: 767px)' }))
vi.mock('@/lib/api/tables', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tables')>()),
  getRecord: vi.fn(async (tableName: string, id: string) => ({
    tableName, recordLabel: `Acme ${id}`,
    values: { id: Number(id), name: `Acme ${id}`, status: 'Active', owner: 'Avery' },
    displayValues: { id, name: `Acme ${id}`, status: 'Active', owner: 'Avery' },
  })),
}))
vi.mock('@/lib/api/metadata', () => ({
  loadTableMetaData: vi.fn(async () => ACCOUNT_TABLE),
  loadMetaData: vi.fn(async () => ({
    appTree: [{ name: 'crm', label: 'CRM', type: 'APP', children: [
      { name: 'account', label: 'Accounts', type: 'TABLE' },
      { name: 'acmeSync', label: 'Acme Sync', type: 'PROCESS' },
    ] }],
    apps: {},
    processes: {},
    tables: {
      account: { name: 'account', label: 'Accounts', isHidden: false, readPermission: true, primaryKeyField: 'id', fields: {}, searchFields: ['name'], icon: { name: 'business' } },
      contact: { name: 'contact', label: 'Contacts', isHidden: false, readPermission: true, primaryKeyField: 'id', fields: {}, searchFields: ['name'] },
    },
  })),
}))
const searchRecordsMock = vi.fn()
vi.mock('@/lib/api/record-search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/record-search')>()),
  searchRecords: (...args: unknown[]) => searchRecordsMock(...args),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { SearchPage } from './SearchPage'
import { addRecentSearch, getRecentSearches } from '@/lib/search/recent-searches'
import { addRecentRecord, clearRecentRecords } from '@/lib/utils/recent-records'

/**
 * Renders the page for a URL query string.
 *
 * @param query - e.g. `q=acme&tables=account`.
 * @returns The render result.
 */
function renderPage(query: string) {
  urlState.params = new URLSearchParams(query)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><SearchPage /></QueryClientProvider>)
}

/**
 * Account results with ids `from`..`to`.
 *
 * @param from - First id.
 * @param to - Last id.
 * @returns Results.
 */
function accounts(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, index) => ({ tableName: 'account', recordId: String(from + index), recordLabel: `Acme ${from + index}` }))
}

const OVERVIEW = {
  results: [
    { tableName: 'account', tableLabel: 'Accounts', recordId: '1', recordLabel: 'Acme Corp', updatedAt: '2026-10-01T10:00:00Z', highlights: [{ fieldName: 'domain', fieldLabel: 'Domain', text: 'acme.com', matches: [{ start: 0, end: 4 }] }], details: [{ fieldName: 'city', fieldLabel: 'City', displayValue: 'Austin' }] },
    { tableName: 'contact', tableLabel: 'Contacts', recordId: '9', recordLabel: 'Wile Coyote' },
  ],
  tables: [
    { tableName: 'account', resultCount: 1, hasMore: true, totalCount: 42, source: 'PROVIDER' },
    { tableName: 'contact', resultCount: 1, hasMore: false, source: 'PROVIDER' },
  ],
  provider: { status: 'OK' },
}

describe('SearchPage', () => {
  beforeEach(() => {
    media.wide = false
    replaceMock.mockReset()
    searchRecordsMock.mockReset()
    localStorage.removeItem('qqq-recent-searches')
    clearRecentRecords()
  })

  it('shows pages, then each table with its count, highlighted snippets, details and filters with counts', async () => {
    searchRecordsMock.mockResolvedValue(OVERVIEW)
    renderPage('q=acme')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for “acme”')
    const accountsSection = await screen.findByRole('region', { name: 'Accounts' })
    expect(accountsSection).toHaveTextContent('42')
    const card = within(accountsSection).getAllByRole('listitem')[0]
    expect(card).toHaveTextContent('Domain:acme.com')
    expect(card).toHaveTextContent('City: Austin')
    const chips = card.querySelectorAll('[data-qqq-id="search-result-detail-chip"]')
    expect(Array.from(chips).map((chip) => chip.textContent)).toEqual(['City: Austin'])
    expect(card.querySelector('time')).toHaveAttribute('dateTime')
    expect(Array.from(card.querySelectorAll('mark')).map((mark) => mark.textContent)).toEqual(['Acme', 'acme'])
    expect(within(accountsSection).getByRole('link', { name: 'Show all' })).toHaveAttribute('href', '/app/search?q=acme&tables=account')
    expect(screen.getByRole('region', { name: 'Pages' })).toHaveTextContent('Acme Sync')
    const filters = screen.getByRole('navigation', { name: 'Filter results' })
    expect(within(filters).getByRole('link', { name: /^All/ })).toHaveAttribute('aria-current', 'page')
    expect(within(filters).getByRole('link', { name: /Accounts/ })).toHaveTextContent('42')
    expect(within(filters).getByRole('link', { name: /Pages/ })).toHaveAttribute('href', '/app/search?q=acme&view=pages')
    expect(searchRecordsMock).toHaveBeenCalledWith('acme', expect.objectContaining({ tableNames: ['account', 'contact'], limitPerTable: 8, sort: 'relevance' }))
  })

  it('pages one table 25 at a time while the backend reports more, without duplicates', async () => {
    searchRecordsMock.mockImplementation(async (_term: string, options: { tableNames: string[]; offset?: number }) => {
      if (options.tableNames.length > 1) return OVERVIEW
      if (!options.offset) return { results: accounts(1, 25), tables: [{ tableName: 'account', hasMore: true, totalCount: 30 }] }
      return { results: [...accounts(25, 30)], tables: [{ tableName: 'account', hasMore: false, totalCount: 30 }] }
    })
    const user = userEvent.setup()
    renderPage('q=acme&tables=account')
    const section = await screen.findByRole('region', { name: 'Accounts' })
    await waitFor(() => expect(within(section).getAllByRole('listitem')).toHaveLength(25))
    expect(section).toHaveTextContent('25 of 30')
    await user.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => expect(within(section).getAllByRole('listitem')).toHaveLength(30))
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    expect(searchRecordsMock).toHaveBeenCalledWith('acme', expect.objectContaining({ tableNames: ['account'], limitPerTable: 25, offset: 25 }))
  })

  it('says only the first page is shown when an older backend sends no summaries', async () => {
    searchRecordsMock.mockImplementation(async (_term: string, options: { tableNames: string[] }) => (options.tableNames.length > 1 ? { results: [] } : { results: accounts(1, 25) }))
    renderPage('q=acme&tables=account')
    expect(await screen.findByText('Showing the first 25 matches. Add words to narrow the search.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('changes the order through the URL', async () => {
    searchRecordsMock.mockResolvedValue(OVERVIEW)
    const user = userEvent.setup()
    renderPage('q=acme')
    await screen.findByRole('region', { name: 'Accounts' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'recent')
    expect(replaceMock).toHaveBeenCalledWith('/app/search?q=acme&sort=recent', { scroll: false })
  })

  it('updates the URL as the user types, and remembers a submitted search', async () => {
    searchRecordsMock.mockResolvedValue({ results: [] })
    const user = userEvent.setup()
    renderPage('q=acme')
    const input = await screen.findByRole('searchbox', { name: 'Search pages and records' })
    await user.clear(input)
    await user.type(input, 'bolt')
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/app/search?q=bolt', { scroll: false }))
    await user.keyboard('{Enter}')
    expect(getRecentSearches()).toEqual(['bolt'])
  })

  it('keeps text typed after a debounced URL update when that update arrives late', async () => {
    searchRecordsMock.mockResolvedValue({ results: [] })
    const user = userEvent.setup()
    const { rerender } = renderPage('q=')
    const input = await screen.findByRole('searchbox', { name: 'Search pages and records' })
    await user.type(input, 'acme')
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/app/search?q=acme', { scroll: false }))
    await user.type(input, ' co')
    // the router now delivers the earlier update
    urlState.params = new URLSearchParams('q=acme')
    rerender(<QueryClientProvider client={new QueryClient()}><SearchPage /></QueryClientProvider>)
    expect(input).toHaveValue('acme co')
  })

  it('names the failure class, keeps page matches and retries', async () => {
    searchRecordsMock.mockRejectedValueOnce(new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED'))
    const user = userEvent.setup()
    renderPage('q=acme')
    const failure = await screen.findByText('Record search failed: the server took too long to answer')
    expect(failure.closest('[data-qqq-id="search-failure"]')).toHaveAttribute('data-failure-kind', 'timeout')
    expect(screen.getByRole('region', { name: 'Pages' })).toHaveTextContent('Acme Sync')
    searchRecordsMock.mockResolvedValueOnce(OVERVIEW)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('region', { name: 'Accounts' })).toBeInTheDocument()
  })

  it('reports a permission failure without offering a retry', async () => {
    searchRecordsMock.mockRejectedValue(new AxiosError('Permission denied.', 'ERR_BAD_REQUEST', undefined, null, { status: 403, data: {}, statusText: '', headers: {}, config: {} } as unknown as AxiosResponse))
    renderPage('q=acme')
    expect(await screen.findByText('Record search failed: permission denied')).toBeInTheDocument()
    expect(screen.getByText('Permission denied.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('shows the provider failure above its fallback results', async () => {
    searchRecordsMock.mockResolvedValue({ ...OVERVIEW, provider: { status: 'FAILED', failureClass: 'SocketTimeoutException', message: 'Read timed out' } })
    renderPage('q=acme')
    expect(await screen.findByText('Search index unavailable — showing basic matches instead')).toBeInTheDocument()
    expect(screen.getByText('SocketTimeoutException: Read timed out')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Accounts' })).toBeInTheDocument()
  })

  it('says what matched nothing and offers to search everything from a filter', async () => {
    searchRecordsMock.mockResolvedValue({ results: [], tables: [] })
    renderPage('q=zzz&tables=contact')
    expect(await screen.findByText(/No Contacts records match/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Search everything instead' })).toHaveAttribute('href', '/app/search?q=zzz')
  })

  it('without a term lists recent searches and recently viewed records', async () => {
    addRecentSearch('acme')
    addRecentRecord({ tableName: 'account', tableLabel: 'Accounts', recordId: '1', recordLabel: 'Acme Corp', path: '/app/account/1' })
    renderPage('')
    expect(await screen.findByRole('link', { name: 'acme' })).toHaveAttribute('href', '/app/search?q=acme')
    expect(screen.getByRole('region', { name: 'Recently viewed' })).toHaveTextContent('Acme Corp')
    expect(searchRecordsMock).not.toHaveBeenCalled()
  })

  it('wide screens preview the first result beside the list, follow hover, focus and arrow keys, and offer edit when permitted', async () => {
    media.wide = true
    searchRecordsMock.mockResolvedValue({
      results: [
        { tableName: 'account', recordId: '1', recordLabel: 'Acme 1', score: 10, highlights: [{ fieldName: 'name', fieldLabel: 'Name', text: 'Acme 1', matches: [{ start: 0, end: 4 }] }] },
        { tableName: 'account', recordId: '2', recordLabel: 'Acme 2', score: 3 },
      ],
      tables: [{ tableName: 'account', resultCount: 2, hasMore: false }],
    })
    const user = userEvent.setup()
    renderPage('q=acme')
    const pane = await screen.findByRole('complementary', { name: 'Record preview' })
    // T1 fields, without the primary key or heavy fields
    // the preview chunk loads on demand
    expect(await within(pane).findByText('Owner', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(within(pane).getByText('Avery')).toBeInTheDocument()
    expect(within(pane).queryByText('Notes')).not.toBeInTheDocument()
    expect(within(pane).getByRole('heading', { level: 2 })).toHaveTextContent('Acme 1')
    expect(within(pane).getByText('Matched')).toBeInTheDocument()
    expect(within(pane).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/app/account/1/edit')
    expect(within(pane).getByRole('link', { name: 'New tab' })).toHaveAttribute('target', '_blank')
    // relevance relative to the best result
    const cards = screen.getAllByRole('listitem').filter((item) => item.getAttribute('data-qqq-id') === 'search-result-card')
    expect(cards[0]).toHaveAttribute('data-active', 'true')
    expect(within(cards[0]).getByText('Strong match')).toBeInTheDocument()
    expect(within(cards[1]).getByText('Partial match')).toBeInTheDocument()
    // keyboard: focus a result, ArrowDown moves to the next and previews it
    const links = screen.getAllByRole('link').filter((link) => link.getAttribute('data-qqq-id') === 'search-result-link')
    links[0].focus()
    await user.keyboard('{ArrowDown}')
    expect(links[1]).toHaveFocus()
    await waitFor(() => expect(within(pane).getByRole('heading', { level: 2 })).toHaveTextContent('Acme 2'))
    // pointer: hovering a result previews it
    await user.hover(cards[0])
    await waitFor(() => expect(within(pane).getByRole('heading', { level: 2 })).toHaveTextContent('Acme 1'))
  })

  it('narrow screens open the preview in a side sheet from the Preview button', async () => {
    searchRecordsMock.mockResolvedValue(OVERVIEW)
    const user = userEvent.setup()
    renderPage('q=acme')
    const accountsSection = await screen.findByRole('region', { name: 'Accounts' })
    expect(screen.queryByRole('complementary', { name: 'Record preview' })).not.toBeInTheDocument()
    await user.click(within(accountsSection).getByRole('button', { name: 'Preview Acme Corp' }))
    const sheet = await screen.findByRole('dialog', { name: 'Preview' })
    expect(await within(sheet).findByText('Owner', {}, { timeout: 5000 })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Close preview' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument())
  })

  it('copies a record link and offers it in a new tab', async () => {
    searchRecordsMock.mockResolvedValue(OVERVIEW)
    const user = userEvent.setup()
    // after setup: user-event installs its own clipboard
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderPage('q=acme')
    const accountsSection = await screen.findByRole('region', { name: 'Accounts' })
    expect(within(accountsSection).getByRole('link', { name: 'Open Acme Corp in a new tab' })).toHaveAttribute('target', '_blank')
    await user.click(within(accountsSection).getByRole('button', { name: 'Copy link to Acme Corp' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/app/account/1`)
  })
})
