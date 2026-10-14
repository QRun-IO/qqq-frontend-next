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
import { beforeEach, expect, it, vi } from 'vitest'
import type { QInstance } from '@/types'
import type { CollaborationFavorite } from '@/types/collaboration'
import * as api from '@/lib/api/collaboration'
import { queryKeys } from '@/lib/query-client'
import { CommandMenu } from './CommandMenu'

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/person/1',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/api/collaboration', () => ({
  isCollaborationInstalled: vi.fn(),
  listFavorites: vi.fn(),
  listRecents: vi.fn(),
  starFavorite: vi.fn(),
  unstarFavorite: vi.fn(),
}))
const alice: CollaborationFavorite = {
  targetType: 'RECORD',
  targetName: 'person',
  recordId: '1',
  id: 1,
  label: 'Alice Johnson',
  href: '/app/person/1',
  available: true,
  folder: null,
  sortOrder: 0,
}
const metadata = {
  tables: { person: { name: 'person', label: 'People', fields: {}, capabilities: [] } },
  apps: {},
  processes: {},
} as unknown as QInstance

beforeEach(() => {
  vi.resetAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  vi.mocked(api.listFavorites).mockResolvedValue({ items: [alice], nextCursor: null })
  vi.mocked(api.listRecents).mockResolvedValue({
    items: [alice, { ...alice, targetType: 'TABLE', label: 'People' }],
    nextCursor: null,
  })
})

it('is lazy when closed; favorites precede navigation, match search and coexist with server record recents', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(queryKeys.collaborationAvailable(), true)
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const props = {
    navTargets: [
      {
        key: 'person',
        label: 'People',
        path: '/app/person',
        nodeType: 'TABLE' as const,
        ancestors: [],
      },
    ],
    metaData: metadata,
    onClose: vi.fn(),
  }
  const view = render(<CommandMenu {...props} open={false} />, { wrapper })
  expect(api.listFavorites).not.toHaveBeenCalled()
  expect(api.listRecents).not.toHaveBeenCalled()
  view.rerender(<CommandMenu {...props} open />)
  await waitFor(() =>
    expect(document.querySelector('[data-qqq-id="command-group-favorites"]')).toHaveTextContent(
      'Alice Johnson'
    )
  )
  expect(document.querySelector('[cmdk-group]')).toHaveAttribute(
    'data-qqq-id',
    'command-group-favorites'
  )
  // the lazily loaded favorites take the highlight from the entry cmdk selected first
  await waitFor(() =>
    expect(document.querySelector('[data-qqq-id="command-favorite"]')).toHaveAttribute('aria-selected', 'true')
  )
  // server recents reach the Recent group once the lazy favorites groups report them
  await waitFor(() =>
    expect(document.querySelectorAll('[data-qqq-id^="command-recent-person-"]')).toHaveLength(1)
  )
  expect(document.querySelector('[data-qqq-id="command-toggle-favorite"]')).toHaveTextContent(
    'Unstar this page'
  )
  const user = userEvent.setup()
  await user.type(screen.getByRole('combobox'), 'alice john')
  expect(document.querySelector('[data-qqq-id="command-group-favorites"]')).toHaveTextContent(
    'Alice Johnson'
  )
  await user.clear(screen.getByRole('combobox'))
  await user.type(screen.getByRole('combobox'), 'missing')
  expect(document.querySelector('[data-qqq-id="command-group-favorites"]')).toBeNull()
})
