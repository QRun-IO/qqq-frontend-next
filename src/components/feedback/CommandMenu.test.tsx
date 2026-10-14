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

// Tests for CommandMenu: typed entries from navigation targets

import React from 'react'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'

const pushMock = vi.fn()
let pathname = '/app'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }), usePathname: () => pathname }))

const searchRecordsMock = vi.fn()
vi.mock('@/lib/api/record-search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/record-search')>()),
  searchRecords: (...args: unknown[]) => searchRecordsMock(...args),
}))

/**
 * Renders inside a fresh query client (the palette runs record search through TanStack Query).
 *
 * @param ui - Element to render.
 * @returns The render result.
 */
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Existing navigation/history tests exercise the no-qbit fallback.
  client.setQueryData(queryKeys.collaborationAvailable(), false)
  return rtlRender(ui, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
}

import { CommandMenu } from './CommandMenu'
import type { NavTarget } from '@/lib/hooks/use-routes'
import type { QInstance, QTableMetaData } from '@/types'
import { addRecentRecord, clearRecentRecords } from '@/lib/utils/recent-records'

const app = { label: 'People App', path: '/app/peopleApp' }
const targets: NavTarget[] = [
  { key: 'peopleApp', label: 'People App', path: '/app/peopleApp', nodeType: 'APP', icon: { name: 'person' }, ancestors: [] },
  { key: 'pet', label: 'Pet', path: '/app/pet', nodeType: 'TABLE', icon: { name: 'pets' }, ancestors: [app] },
  { key: 'clonePeople', label: 'Clone People', path: '/app/clonePeople', nodeType: 'PROCESS', ancestors: [app] },
]

describe('CommandMenu', () => {
  beforeAll(() => {
    // cmdk scrolls the selected item into view and observes list size
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  })

  it('renders nothing when closed', () => {
    const { container } = render(<CommandMenu open={false} onClose={vi.fn()} navTargets={targets} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists each target with its type, app context and declared icon (regression: every entry was typed as an app)', () => {
    render(<CommandMenu open onClose={vi.fn()} navTargets={targets} />)
    const pet = document.querySelector('[data-qqq-id="command-item-pet"]')!
    expect(pet).toHaveTextContent('Pet')
    expect(pet).toHaveTextContent('Table · People App')
    expect(pet).toHaveAttribute('data-node-type', 'TABLE')
    expect(pet.querySelector('svg')).toHaveAttribute('data-qqq-icon', 'pets')
    expect(document.querySelector('[data-qqq-id="command-item-clonePeople"]')).toHaveTextContent('Process · People App')
    expect(document.querySelector('[data-qqq-id="command-item-clonePeople"] svg')).toHaveClass('lucide-workflow')
    expect(document.querySelector('[data-qqq-id="command-item-peopleApp"]')).toHaveTextContent(/App$/)
  })

  it('filters and navigates to the chosen target, then closes', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CommandMenu open onClose={onClose} navTargets={targets} />)
    await user.type(screen.getByRole('combobox'), 'clone')
    await user.keyboard('{Enter}')
    expect(pushMock).toHaveBeenCalledWith('/app/clonePeople')
    expect(onClose).toHaveBeenCalled()
  })

  it('ranks labels that start with the search first and matches several words in order (Material filter)', async () => {
    const user = userEvent.setup()
    const more: NavTarget[] = [
      ...targets,
      { key: 'petSpecies', label: 'Pet Species', path: '/app/petSpecies', nodeType: 'TABLE', ancestors: [] },
      { key: 'carpet', label: 'Carpet', path: '/app/carpet', nodeType: 'TABLE', ancestors: [] },
    ]
    render(<CommandMenu open onClose={vi.fn()} navTargets={more} />)
    await user.type(screen.getByRole('combobox'), 'pet')
    expect(Array.from(document.querySelectorAll('[data-qqq-id="command-group-navigation"] [role="option"]')).map((option) => option.querySelector('span.font-medium')?.textContent)).toEqual(['Pet', 'Pet Species', 'Carpet'])
    await user.type(screen.getByRole('combobox'), ' spe')
    expect(Array.from(document.querySelectorAll('[data-qqq-id="command-group-navigation"] [role="option"]')).map((option) => option.querySelector('span.font-medium')?.textContent)).toEqual(['Pet Species'])
    await user.clear(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'nothing here')
    // only the search-everything entry remains
    expect(screen.queryAllByRole('option').map((option) => option.textContent)).toEqual(['Search everything for “nothing here”'])
    expect(screen.getByRole('status')).toHaveTextContent('No results found.')
  })

  describe('current table actions and recently viewed records', () => {
    const person = {
      name: 'person', label: 'Person', primaryKeyField: 'id', capabilities: ['TABLE_INSERT', 'TABLE_UPDATE'],
      readPermission: true, insertPermission: true, editPermission: true, deletePermission: false,
    } as unknown as QTableMetaData
    const metaData = {
      tables: { person, audit: { name: 'audit', label: 'Audit', readPermission: true } },
      processes: { clonePeople: { name: 'clonePeople', label: 'Clone People', tableName: 'person', isHidden: false, hasPermission: true, iconName: 'content_copy' } },
    } as unknown as QInstance

    beforeEach(() => {
      localStorage.clear()
      pushMock.mockClear()
    })

    it('offers the table actions on a record view and opens the audit through the hash', async () => {
      pathname = '/app/person/7'
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<CommandMenu open onClose={onClose} navTargets={targets} metaData={metaData} />)
      const group = document.querySelector('[data-qqq-id="command-group-actions"]')!
      expect(group).toHaveTextContent('Person Actions')
      expect(Array.from(group.querySelectorAll('[role="option"]')).map((option) => option.textContent)).toEqual(['New', 'Copy', 'Edit', 'Audit', 'Clone People'])
      await user.click(screen.getByRole('option', { name: 'Edit' }))
      expect(pushMock).toHaveBeenCalledWith('/app/person/7/edit')
      await user.click(screen.getByRole('option', { name: 'Audit' }))
      expect(window.location.hash).toBe('#audit')
      window.location.hash = ''
    })

    it('offers New and the processes on the query screen, and nothing on the edit screen', () => {
      pathname = '/app/person'
      const { unmount } = render(<CommandMenu open onClose={vi.fn()} navTargets={targets} metaData={metaData} />)
      expect(Array.from(document.querySelectorAll('[data-qqq-id="command-group-actions"] [role="option"]')).map((option) => option.textContent)).toEqual(['New', 'Clone People'])
      unmount()
      pathname = '/app/person/7/edit'
      render(<CommandMenu open onClose={vi.fn()} navTargets={targets} metaData={metaData} />)
      expect(document.querySelector('[data-qqq-id="command-group-actions"]')).toBeNull()
    })

    it('lists recently viewed records with their table icon and opens them', async () => {
      pathname = '/app'
      addRecentRecord({ tableName: 'person', tableLabel: 'Person', tableIcon: { name: 'person' }, recordId: '7', recordLabel: 'Avery Sample', path: '/app/person/7' })
      const user = userEvent.setup()
      render(<CommandMenu open onClose={vi.fn()} navTargets={targets} metaData={metaData} />)
      const recent = document.querySelector('[data-qqq-id="command-recent-person-7"]')!
      expect(recent).toHaveTextContent('Avery SamplePerson')
      expect(recent.querySelector('svg')).toHaveAttribute('data-qqq-icon', 'person')
      await user.type(screen.getByRole('combobox'), 'avery')
      await user.keyboard('{Enter}')
      expect(pushMock).toHaveBeenCalledWith('/app/person/7')
    })
  })

  describe('record search', () => {
    const searchMeta = {
      tables: {
        person: { name: 'person', label: 'Person', isHidden: false, readPermission: true, primaryKeyField: 'id', fields: {}, searchFields: ['firstName'], icon: { name: 'person' } },
      },
      processes: {},
      apps: {},
    } as unknown as QInstance

    beforeEach(() => {
      pathname = '/app'
      pushMock.mockReset()
      searchRecordsMock.mockReset()
      clearRecentRecords()
      window.open = vi.fn() as unknown as typeof window.open
    })

    it('lists found records under their table with a count, and a search-everything entry', async () => {
      searchRecordsMock.mockResolvedValue({
        results: [{ tableName: 'person', tableLabel: 'Person', recordId: '7', recordLabel: 'Avery Sample', updatedAt: '2026-10-01T10:00:00Z', highlights: [{ fieldName: 'email', fieldLabel: 'Email', text: 'avery@example.com', matches: [{ start: 0, end: 5 }] }] }],
        tables: [{ tableName: 'person', resultCount: 1, hasMore: true, totalCount: 12, source: 'PROVIDER' }],
      })
      const user = userEvent.setup()
      render(<CommandMenu open onClose={vi.fn()} navTargets={targets} metaData={searchMeta} />)
      await user.type(screen.getByRole('combobox'), 'avery')
      const record = await screen.findByRole('option', { name: /Avery Sample/ })
      expect(record).toHaveTextContent('Email: avery@example.com')
      expect(Array.from(record.querySelectorAll('mark')).map((mark) => mark.textContent)).toEqual(['Avery', 'avery'])
      expect(document.querySelector('[data-qqq-id="command-group-records-person"]')).toHaveTextContent('Person · 12')
      expect(screen.getByRole('option', { name: /See all matches in Person/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /Search everything for/ })).toBeInTheDocument()
      expect(searchRecordsMock).toHaveBeenCalledWith('avery', expect.objectContaining({ tableNames: ['person'], limitPerTable: 5 }))
    })

    it('opens the highlighted record in a new tab on Ctrl+Enter', async () => {
      searchRecordsMock.mockResolvedValue({ results: [{ tableName: 'person', recordId: '7', recordLabel: 'Avery Sample' }] })
      const user = userEvent.setup()
      render(<CommandMenu open onClose={vi.fn()} navTargets={targets} metaData={searchMeta} />)
      await user.type(screen.getByRole('combobox'), 'avery')
      await screen.findByRole('option', { name: /Avery Sample/ })
      // the record is the first entry, so cmdk highlights it
      await user.keyboard('{Control>}{Enter}{/Control}')
      expect(window.open).toHaveBeenCalledWith('/app/person/7', '_blank', 'noopener,noreferrer')
      expect(pushMock).not.toHaveBeenCalled()
    })

    it('names the failure class when record search fails, keeping navigation results', async () => {
      const { AxiosError } = await import('axios')
      searchRecordsMock.mockRejectedValue(new AxiosError('Index unavailable', 'ERR_BAD_RESPONSE', undefined, null, { status: 503, data: {}, statusText: '', headers: {}, config: {} as never }))
      const user = userEvent.setup()
      render(<CommandMenu open onClose={vi.fn()} navTargets={targets} metaData={searchMeta} />)
      await user.type(screen.getByRole('combobox'), 'pe')
      expect(await screen.findByText('Record search failed: server error (HTTP 503)')).toBeInTheDocument()
      expect(screen.getByText(/Index unavailable/)).toBeInTheDocument()
      expect(document.querySelector('[data-qqq-id="command-item-peopleApp"]')).toBeInTheDocument()
    })
  })
})
