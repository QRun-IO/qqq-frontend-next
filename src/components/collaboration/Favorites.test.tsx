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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollaborationFavorite, CollaborationList } from '@/types/collaboration'
import * as api from '@/lib/api/collaboration'
import { queryKeys } from '@/lib/query-client'
import { FavoriteToggle } from './FavoriteToggle'
import { FavoritesMenu } from './FavoritesMenu'

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

describe('FavoritesMenu', () => {
  it('groups by folder, mutes unavailable targets and supports their removal', async () => {
    const user = userEvent.setup()
    const unavailable = {
      ...alice,
      id: 2,
      recordId: 'deleted',
      available: false,
      href: null,
      label: 'Unavailable',
      folder: 'Operations',
    }
    setup(<FavoritesMenu />, [alice, unavailable])
    expect(api.listFavorites).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Favorites' }))
    expect(screen.getByRole('heading', { name: 'Customers' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Operations' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Alice Johnson' })).toHaveAttribute(
      'href',
      '/app/person/1'
    )
    expect(screen.queryByRole('link', { name: 'Unavailable' })).toBeNull()
    expect(screen.getByText('Unavailable')).toHaveClass('text-muted-foreground')
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/app/collaboration_favorite'
    )
    expect(screen.getByRole('dialog')).toHaveClass('max-w-[calc(100vw-32px)]')
    await user.click(screen.getByRole('button', { name: 'Remove Unavailable from favorites' }))
    await waitFor(() =>
      expect(api.unstarFavorite).toHaveBeenCalledWith({ ...target, recordId: 'deleted' })
    )
  })
  it('has a useful empty state and restores focus on Escape', async () => {
    const user = userEvent.setup()
    setup(<FavoritesMenu />)
    const trigger = screen.getByRole('button', { name: 'Favorites' })
    await user.click(trigger)
    expect(
      within(screen.getByRole('dialog')).getByText(
        'No favorites yet. Use the star on any table, app or record.'
      )
    ).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })
  it('is hidden when unavailable', () => {
    const { container } = setup(<FavoritesMenu />, [], false)
    expect(container).toBeEmptyDOMElement()
  })
})
