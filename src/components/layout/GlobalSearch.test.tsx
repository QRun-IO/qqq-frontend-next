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

// Tests for GlobalSearch: search-as-you-type over pages, recent records and recent searches,
// plus backend record search when (and only when) searchable tables are given: grouping,
// top hits, counts, highlights, keyboard (incl. Ctrl+Enter), failure classes and fallbacks

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type AxiosResponse } from 'axios'
import { server } from '@/mocks/node'
import { uiApiVersionHandler } from '@/mocks/ui-api-version'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

const searchRecordsMock = vi.fn()
const suggestRecordsMock = vi.fn()
vi.mock('@/lib/api/quick-search-suggest', () => ({
  suggestRecords: (...args: unknown[]) => suggestRecordsMock(...args),
}))
vi.mock('@/lib/api/record-search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/record-search')>()),
  searchRecords: (...args: unknown[]) => searchRecordsMock(...args),
}))

import { GlobalSearch } from './GlobalSearch'
import type { NavTarget } from '@/lib/hooks/use-routes'
import { addRecentRecord, clearRecentRecords } from '@/lib/utils/recent-records'
import { addRecentSearch, getRecentSearches } from '@/lib/search/recent-searches'
import type { SearchableTable } from '@/lib/utils/record-search'

const peopleApp = { label: 'People App', path: '/app/peopleApp' }
const greetingsApp = { label: 'Greetings App', path: '/app/greetingsApp' }
const navTargets: NavTarget[] = [
  { key: 'peopleApp', label: 'People App', path: '/app/peopleApp', nodeType: 'APP', icon: { name: 'person' }, ancestors: [] },
  { key: 'greetingsApp', label: 'Greetings App', path: '/app/greetingsApp', nodeType: 'APP', ancestors: [peopleApp] },
  { key: 'person', label: 'Person', path: '/app/person', nodeType: 'TABLE', icon: { name: 'person' }, ancestors: [peopleApp, greetingsApp] },
  { key: 'pet', label: 'Pet', path: '/app/pet', nodeType: 'TABLE', icon: { name: 'pets' }, ancestors: [peopleApp, greetingsApp] },
  { key: 'greetInteractive', label: 'Greet Interactive', path: '/app/greetInteractive', nodeType: 'PROCESS', ancestors: [peopleApp, greetingsApp] },
]

/**
 * Renders the header search in a fresh query client.
 *
 * @param searchTables - Searchable tables (omit: no record search).
 * @returns The render result.
 */
function renderSearch(searchTables?: SearchableTable[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <GlobalSearch navTargets={navTargets} searchTables={searchTables} />
    </QueryClientProvider>
  )
}

const input = () => screen.getByRole('combobox', { name: 'Search pages and recent records' })
const recordInput = () => screen.getByRole('combobox', { name: 'Search pages and records' })
const people: SearchableTable[] = [{ name: 'person', label: 'Person', icon: { name: 'person' } }, { name: 'pet', label: 'Pet' }]
const optionLabels = (container: HTMLElement) => within(container).getAllByRole('option').map((option) => option.querySelector('span.font-medium')?.textContent ?? option.textContent)
// jsdom's accessible name splits highlighted text ("Greet Inter active"): find options by text content
const option = (pattern: RegExp, container: HTMLElement = document.body) => {
  const found = within(container).queryAllByRole('option').find((candidate) => pattern.test(candidate.textContent ?? ''))
  if (!found) throw new Error(`No option matches ${pattern}`)
  return found
}
const findOption = async (pattern: RegExp) => {
  await screen.findAllByRole('option')
  return vi.waitFor(() => option(pattern))
}
const selected = () => screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true')

describe('GlobalSearch', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    pushMock.mockReset()
    clearRecentRecords()
    localStorage.removeItem('qqq-recent-searches')
    fetchSpy.mockReset()
    searchRecordsMock.mockReset()
    suggestRecordsMock.mockReset()
    server.use(uiApiVersionHandler())
    vi.stubGlobal('fetch', fetchSpy)
    window.open = vi.fn() as unknown as typeof window.open
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders an empty combobox with no dropdown', () => {
    renderSearch()
    expect(input()).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('lists matching pages, best label matches first, with their type and app context', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pe')
    // "People App", "Person" and "Pet" start with the term: top hits (at most three, closest first)
    expect(optionLabels(await screen.findByRole('group', { name: 'Top hits' }))).toEqual(['Pet', 'Person', 'People App'])
    const pages = screen.getByRole('group', { name: 'Pages' })
    expect(optionLabels(pages)).toEqual(['Greetings App', 'Greet Interactive'])
    expect(within(pages).getAllByRole('option')[1]).toHaveTextContent('Process · People App / Greetings App')
    expect(within(screen.getByRole('group', { name: 'Top hits' })).getAllByRole('option')[1].querySelector('svg')).toHaveAttribute('data-qqq-icon', 'person')
  })

  it('highlights the matched text', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'inter')
    expect((await findOption(/Greet Interactive/)).querySelector('mark')).toHaveTextContent('Inter')
  })

  it('navigates to the clicked target and clears the input', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'Greet Inter')
    await user.click(option(/^Greet Interactive/))
    expect(pushMock).toHaveBeenCalledWith('/app/greetInteractive')
    expect(input()).toHaveValue('')
  })

  it('selects the first result while typing so Enter opens the top hit, and arrows move', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pet')
    expect(selected()).toHaveTextContent('Pet')
    expect(input()).toHaveAttribute('aria-activedescendant', selected()!.id)
    await user.keyboard('{ArrowDown}')
    expect(selected()).toHaveTextContent('Search everything for “pet”')
    await user.keyboard('{ArrowUp}{Enter}')
    expect(pushMock).toHaveBeenCalledWith('/app/pet')
  })

  it('opens the selected result in a new tab with Ctrl+Enter and keeps the search open', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pet')
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(window.open).toHaveBeenCalledWith('/app/pet', '_blank', 'noopener,noreferrer')
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('offers "search everything" as the only result when nothing matches, and Enter opens the search page', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'zzz')
    expect(screen.getByRole('listbox')).toHaveTextContent('No pages or recent records match “zzz”')
    await user.keyboard('{Enter}')
    expect(pushMock).toHaveBeenCalledWith('/app/search?q=zzz')
    expect(getRecentSearches()).toEqual(['zzz'])
  })

  it('keeps the keyboard selection when results appear under a resting pointer', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pe')
    const options = screen.getAllByRole('option')
    // Results rendering under the pointer fire mouseenter without pointer movement
    fireEvent.mouseEnter(options[2])
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.mouseMove(options[2])
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('lists recent searches and recently viewed records before typing; a recent search fills the box', async () => {
    addRecentRecord({ tableName: 'person', tableLabel: 'Person', recordId: '1', recordLabel: 'Avery Sample', path: '/app/person/1' })
    addRecentSearch('greet')
    const user = userEvent.setup()
    renderSearch()
    await user.click(input())
    expect(within(screen.getByRole('group', { name: 'Recently viewed' })).getByRole('option', { name: /Avery Sample/ })).toBeInTheDocument()
    expect(selected()).toBeUndefined()
    await user.click(within(screen.getByRole('group', { name: 'Recent searches' })).getByRole('option', { name: 'greet' }))
    expect(input()).toHaveValue('greet')
    expect(option(/Greet Interactive/)).toBeInTheDocument()
  })

  it('clears recent searches', async () => {
    addRecentSearch('greet')
    const user = userEvent.setup()
    renderSearch()
    await user.click(input())
    await user.click(screen.getByRole('button', { name: 'Clear recent searches' }))
    expect(screen.queryByRole('group', { name: 'Recent searches' })).not.toBeInTheDocument()
    expect(getRecentSearches()).toEqual([])
  })

  it('closes on Escape, and a second Escape clears the text', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pe')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input()).toHaveValue('pe')
    await user.keyboard('{Escape}')
    expect(input()).toHaveValue('')
  })

  it('after Escape closes the dropdown, Enter searches everything instead of opening a hidden option', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pet')
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}{Enter}')
    expect(pushMock).toHaveBeenCalledWith('/app/search?q=pet')
  })

  it('typing a new term drops a selection made by pointer for the previous one', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pe')
    await screen.findByRole('listbox')
    fireEvent.mouseMove(option(/Search everything/))
    expect(selected()).toHaveTextContent('Search everything')
    await user.type(input(), 't')
    expect(selected()).toHaveTextContent('Pet')
  })

  it('suggests completions of the last word from matching labels; choosing one fills the box', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'greet in')
    const suggestions = await screen.findByRole('group', { name: 'Suggestions' })
    expect(optionLabels(suggestions)).toEqual(['greet interactive'])
    // a completion is never preselected: Enter still opens the top hit
    expect(selected()).toHaveTextContent('Greet Interactive')
    await user.click(option(/greet interactive/, suggestions))
    expect(input()).toHaveValue('greet interactive')
  })

  it('Shift+Enter opens the results page even with a result selected', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pet')
    await screen.findByRole('listbox')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    expect(pushMock).toHaveBeenCalledWith('/app/search?q=pet')
  })

  it('never calls the backend without searchable tables (no record search capability)', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'person')
    await new Promise((resolve) => setTimeout(resolve, 400))
    await user.keyboard('{Enter}')
    expect(searchRecordsMock).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  describe('with record search', () => {
    it('uses core search and never suggests when the extension is absent', async () => {
      searchRecordsMock.mockResolvedValue({ results: [{ tableName: 'person', recordId: '7', recordLabel: 'Zed Zulu' }] })
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'zed')
      await findOption(/Zed Zulu/)
      expect(searchRecordsMock).toHaveBeenCalled()
      expect(suggestRecordsMock).not.toHaveBeenCalled()
    })

    it('shows grouped suggestions and subtitles, keeps combobox selection and navigates by keyboard', async () => {
      server.use(uiApiVersionHandler('quick-search'))
      suggestRecordsMock.mockResolvedValue({
        results: [
          { tableName: 'person', tableLabel: 'Person', recordId: '7', recordLabel: 'Zed Zulu', details: [{ fieldName: 'subtitle', displayValue: 'Springfield office' }] },
          { tableName: 'pet', tableLabel: 'Pet', recordId: '4', recordLabel: 'Biscuit', details: [{ fieldName: 'subtitle', displayValue: 'Zed’s dog' }] },
        ],
        tables: [{ tableName: 'person', resultCount: 1, hasMore: false, source: 'PROVIDER' }, { tableName: 'pet', resultCount: 1, hasMore: false, source: 'PROVIDER' }],
      })
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'zed')
      expect(await findOption(/Zed Zulu/)).toHaveTextContent('Springfield office')
      expect(screen.getByRole('group', { name: /^Pet/ })).toHaveTextContent('Zed’s dog')
      expect(selected()).toHaveTextContent('Zed Zulu')
      expect(recordInput()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id)
      await vi.waitFor(() => expect(recordInput()).toHaveAttribute('aria-activedescendant', selected()!.id))
      expect(recordInput()).toHaveAttribute('aria-expanded', 'true')
      await user.keyboard('{ArrowDown}')
      expect(selected()).toHaveTextContent('Biscuit')
      await user.keyboard('{ArrowUp}{Enter}')
      expect(pushMock).toHaveBeenCalledWith('/app/person/7')
      expect(suggestRecordsMock).toHaveBeenCalledWith('zed', expect.objectContaining({ tableNames: ['person', 'pet'], limitPerTable: 6 }))
      expect(searchRecordsMock).not.toHaveBeenCalled()
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it.each(['Control', 'Meta'])('opens suggestions in a new tab with %s+Enter; Shift+Enter opens all results', async (modifier) => {
      server.use(uiApiVersionHandler('quick-search'))
      suggestRecordsMock.mockResolvedValue({ results: [{ tableName: 'person', recordId: '7', recordLabel: 'Zed Zulu' }] })
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'zed')
      await findOption(/Zed Zulu/)
      await user.keyboard(`{${modifier}>}{Enter}{/${modifier}}`)
      expect(window.open).toHaveBeenCalledWith('/app/person/7', '_blank', 'noopener,noreferrer')
      expect(pushMock).not.toHaveBeenCalled()
      await user.keyboard('{Escape}')
      expect(recordInput()).toHaveAttribute('aria-expanded', 'false')
      expect(recordInput()).not.toHaveAttribute('aria-activedescendant')
      await user.keyboard('{ArrowDown}{Shift>}{Enter}{/Shift}')
      expect(pushMock).toHaveBeenCalledWith('/app/search?q=zed')
    })

    it('groups found records by table with counts, highlights matched fields and links to more', async () => {
      searchRecordsMock.mockResolvedValue({
        results: [
          { tableName: 'person', tableLabel: 'Person', recordId: '1', recordLabel: 'Avery Petersen', highlights: [{ fieldName: 'email', fieldLabel: 'Email', text: 'avery@pets.io', matches: [{ start: 6, end: 8 }] }] },
          { tableName: 'person', tableLabel: 'Person', recordId: '2', recordLabel: 'Sam Pepe', details: [{ fieldName: 'city', displayValue: 'Austin' }] },
          { tableName: 'pet', tableLabel: 'Pet', recordId: '4', recordLabel: 'Biscuit' },
        ],
        tables: [{ tableName: 'person', resultCount: 2, hasMore: true, totalCount: 31 }, { tableName: 'pet', resultCount: 1, hasMore: false }],
      })
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'pe')
      const personGroup = await screen.findByRole('group', { name: /^Person/ })
      expect(personGroup).toHaveAccessibleName('Person 31 matches')
      expect(optionLabels(personGroup)).toEqual(['Avery Petersen', 'Sam Pepe', 'See all 31 matches in Person'])
      const avery = option(/Avery Petersen/, personGroup)
      expect(avery).toHaveTextContent('Email: avery@pets.io')
      expect(Array.from(avery.querySelectorAll('mark')).map((mark) => mark.textContent)).toEqual(['Pe', 'pe'])
      expect(option(/Sam Pepe/, personGroup)).toHaveTextContent('Austin')
      expect(within(personGroup).getByRole('option', { name: /See all 31/ })).toHaveAttribute('href', '/app/search?q=pe&tables=person')
      expect(screen.getByRole('group', { name: /^Pet/ })).toHaveAccessibleName('Pet 1 matches')
      expect(searchRecordsMock).toHaveBeenCalledTimes(1)
      expect(searchRecordsMock).toHaveBeenCalledWith('pe', expect.objectContaining({ tableNames: ['person', 'pet'], limitPerTable: 6, offset: 0, sort: 'relevance', signal: expect.any(AbortSignal) }))
    })

    it('keeps "nothing selected" after ArrowUp when records arrive later, so Enter opens the results page', async () => {
      // records answer well after the page matches are listed and the user pressed ArrowUp
      searchRecordsMock.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
        return { results: [{ tableName: 'pet', tableLabel: 'Pet', recordId: '4', recordLabel: 'Petunia' }] }
      })
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'pet')
      await vi.waitFor(() => expect(selected()).toHaveTextContent('Pet'))
      await user.keyboard('{ArrowUp}')
      expect(selected()).toBeUndefined()
      await vi.waitFor(() => option(/Petunia/), { timeout: 3000 })
      expect(selected()).toBeUndefined()
      await user.keyboard('{Enter}')
      expect(pushMock).toHaveBeenCalledWith('/app/search?q=pet')
    })

    it('promotes an exact record match to top hits and opens it with Enter', async () => {
      searchRecordsMock.mockResolvedValue({ results: [{ tableName: 'person', recordId: '7', recordLabel: 'Zed Zulu' }] })
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'zed zulu')
      const top = await screen.findByRole('group', { name: 'Top hits' })
      expect(option(/Zed Zulu/, top)).toHaveTextContent('Person')
      expect(selected()).toHaveTextContent('Zed Zulu')
      await user.keyboard('{Enter}')
      expect(pushMock).toHaveBeenCalledWith('/app/person/7')
      expect(getRecentSearches()).toEqual(['zed zulu'])
    })

    it('never preselects a record left over from the previous term while the new search runs', async () => {
      searchRecordsMock.mockImplementation(async (term: string) => (term === 'acme'
        ? { results: [{ tableName: 'person', recordId: '1', recordLabel: 'Acme Buyer' }] }
        : new Promise(() => undefined)))
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'acme')
      await findOption(/Acme Buyer/)
      await user.clear(recordInput())
      await user.type(recordInput(), 'zeta')
      await user.keyboard('{Enter}')
      expect(pushMock).toHaveBeenCalledWith('/app/search?q=zeta')
      expect(pushMock).not.toHaveBeenCalledWith('/app/person/1')
    })

    it('does not search a one-character term, and drops recent records that were found', async () => {
      addRecentRecord({ tableName: 'person', tableLabel: 'Person', recordId: '7', recordLabel: 'Zed Zulu', path: '/app/person/7' })
      searchRecordsMock.mockResolvedValue({ results: [{ tableName: 'person', tableLabel: 'Person', recordId: '7', recordLabel: 'Zed Zulu' }] })
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'z')
      await new Promise((resolve) => setTimeout(resolve, 400))
      expect(searchRecordsMock).not.toHaveBeenCalled()
      await user.type(recordInput(), 'u')
      await screen.findByRole('group', { name: /^Person/ })
      expect(screen.queryByRole('group', { name: 'Recently viewed' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('option').filter((candidate) => /Zulu/.test(candidate.textContent ?? ''))).toHaveLength(1)
    })

    it('names the failure class and the backend message, keeps page matches, and retries', async () => {
      searchRecordsMock.mockRejectedValueOnce(new AxiosError('Error in record search provider', 'ERR_BAD_RESPONSE', undefined, null, { status: 500, data: {}, statusText: '', headers: {}, config: {} } as unknown as AxiosResponse))
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'pet')
      expect(screen.getByRole('status')).toHaveTextContent('Searching records…')
      const failure = await screen.findByText('Record search failed: server error (HTTP 500)')
      expect(failure.closest('[data-qqq-id="search-failure"]')).toHaveAttribute('data-failure-kind', 'server')
      expect(screen.getByText('Error in record search provider')).toBeInTheDocument()
      expect(option(/^Pet/)).toBeInTheDocument()
      searchRecordsMock.mockResolvedValueOnce({ results: [{ tableName: 'pet', recordId: '4', recordLabel: 'Petunia' }] })
      await user.click(screen.getByRole('button', { name: 'Retry' }))
      expect(await findOption(/Petunia/)).toBeInTheDocument()
      expect(screen.queryByText(/Record search failed/)).not.toBeInTheDocument()
    })

    it('shows fallback results with the provider failure class when the index failed', async () => {
      searchRecordsMock.mockResolvedValue({
        results: [{ tableName: 'pet', recordId: '4', recordLabel: 'Petunia' }],
        tables: [{ tableName: 'pet', resultCount: 1, hasMore: false, source: 'FALLBACK' }],
        provider: { status: 'FAILED', failureClass: 'ConnectException', message: 'Connection refused' },
      })
      const user = userEvent.setup()
      renderSearch(people)
      await user.type(recordInput(), 'petu')
      expect(await screen.findByText('Search index unavailable — showing basic matches instead')).toBeInTheDocument()
      expect(screen.getByText('ConnectException: Connection refused')).toBeInTheDocument()
      expect(option(/Petunia/)).toBeInTheDocument()
    })
  })
})
