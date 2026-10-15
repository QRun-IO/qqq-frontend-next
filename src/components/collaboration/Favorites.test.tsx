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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollaborationFavorite, CollaborationList } from '@/types/collaboration'
import * as api from '@/lib/api/collaboration'
import { queryKeys } from '@/lib/query-client'
import { FavoriteToggle } from './FavoriteToggle'
import { SidebarFavorites } from './SidebarFavorites'

vi.mock('@/lib/api/collaboration', () => ({
  isCollaborationInstalled: vi.fn(),
  listFavorites: vi.fn(),
  starFavorite: vi.fn(),
  unstarFavorite: vi.fn(),
}))
const target = { targetType: 'RECORD' as const, targetName: 'person', recordId: '1' }
const alice: CollaborationFavorite = {
  ...target,
  id: 1,
  label: 'Alice Johnson',
  href: '/app/person/1',
  available: true,
  folder: 'Customers',
  sortOrder: 0,
}

function setup(ui: React.ReactElement, items: CollaborationFavorite[] = [], available = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(queryKeys.collaborationAvailable(), available)
  client.setQueryData<CollaborationList>(queryKeys.collaborationFavorites(), {
    items,
    nextCursor: null,
  })
  vi.mocked(api.listFavorites).mockResolvedValue({ items, nextCursor: null })
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.starFavorite).mockResolvedValue({ success: true })
  vi.mocked(api.unstarFavorite).mockResolvedValue({ success: true })
})

describe('FavoriteToggle', () => {
  it('supports keyboard activation and exposes its pressed state and tooltip label', async () => {
    const user = userEvent.setup()
    setup(<FavoriteToggle target={target} label={alice.label} href={alice.href!} />)
    const button = screen.getByRole('button', { name: 'Add to favorites' })
    expect(button).toHaveAttribute('data-qqq-id', 'favorite-toggle')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(api.starFavorite).toHaveBeenCalledWith(target))
  })
  it('shows a pressed star and removes an existing favorite', async () => {
    const user = userEvent.setup()
    setup(<FavoriteToggle target={target} label={alice.label} href={alice.href!} />, [alice])
    const button = screen.getByRole('button', { name: 'Remove from favorites' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await user.click(button)
    await waitFor(() => expect(api.unstarFavorite).toHaveBeenCalledWith(target))
  })
  it('is hidden when collaboration is absent', () => {
    const { container } = setup(
      <FavoriteToggle target={target} label={alice.label} href={alice.href!} />,
      [],
      false
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SidebarFavorites', () => {
  const many = Array.from({ length: 7 }, (_, index) => ({ ...alice, id: index + 1, recordId: String(index + 1), label: `Favorite ${index + 1}`, href: `/app/person/${index + 1}` }))

  it('is collapsed by default with a count, and opens to the first five plus All favorites', async () => {
    const user = userEvent.setup()
    let open = false
    const { rerender, client } = setup(<SidebarFavorites pathname="/app/person/2" open={open} onToggle={(next) => { open = next }} />, many)
    const toggle = await screen.findByRole('button', { name: /Favorites/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('· 7')
    expect(screen.queryByRole('link', { name: 'Favorite 1' })).toBeNull()
    await user.click(toggle)
    expect(open).toBe(true)
    rerender(<QueryClientProvider client={client}><SidebarFavorites pathname="/app/person/2" open onToggle={() => {}} /></QueryClientProvider>)
    expect(screen.getAllByRole('link').filter((link) => link.dataset.qqqId === 'sidebar-favorite-link')).toHaveLength(5)
    expect(screen.getByRole('link', { name: 'Favorite 2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'All favorites (7)' })).toHaveAttribute('href', '/app/collaboration_favorite')
  })
  it('hides unavailable favorites and is absent when there are none', async () => {
    const unavailable = { ...alice, id: 2, available: false, href: null, label: 'Gone' }
    const { container } = setup(<SidebarFavorites pathname="/app" open onToggle={() => {}} />, [unavailable])
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
  it('is hidden when collaboration is absent', () => {
    const { container } = setup(<SidebarFavorites pathname="/app" open onToggle={() => {}} />, [alice], false)
    expect(container).toBeEmptyDOMElement()
  })
})
