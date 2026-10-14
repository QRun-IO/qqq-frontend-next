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

import React, { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import * as api from '@/lib/api/collaboration'
import type { CollaborationList, CollaborationMutationResult } from '@/types/collaboration'
import { queryKeys } from '@/lib/query-client'
import {
  sameFavorite,
  useCollaborationAvailable,
  useFavorites,
  useRecordRecentView,
  useToggleFavorite,
} from './use-collaboration'

vi.mock('@/lib/api/collaboration', () => ({
  isCollaborationInstalled: vi.fn(),
  listFavorites: vi.fn(),
  listRecents: vi.fn(),
  recordRecent: vi.fn(),
  starFavorite: vi.fn(),
  unstarFavorite: vi.fn(),
}))
const target = { targetType: 'RECORD' as const, targetName: 'person', recordId: '1' }
const input = { ...target, label: 'Alice Johnson', href: '/app/person/1', starred: false }
const empty: CollaborationList = { items: [], nextCursor: null }

function setup(available?: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  if (available !== undefined) client.setQueryData(queryKeys.collaborationAvailable(), available)
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  )
  return { client, wrapper }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.isCollaborationInstalled).mockResolvedValue(true)
  vi.mocked(api.listFavorites).mockResolvedValue(empty)
  vi.mocked(api.recordRecent).mockResolvedValue({ success: true })
})

it('caches a negative probe across mounts for the query-client session', async () => {
  vi.mocked(api.isCollaborationInstalled).mockResolvedValue(false)
  const { wrapper } = setup()
  const first = renderHook(() => useCollaborationAvailable(), { wrapper })
  await waitFor(() => expect(first.result.current.data).toBe(false))
  first.unmount()
  const second = renderHook(() => useCollaborationAvailable(), { wrapper })
  expect(second.result.current.data).toBe(false)
  expect(api.isCollaborationInstalled).toHaveBeenCalledTimes(1)
})

it('does not fetch favorites for a closed surface or an absent extension', async () => {
  const { wrapper } = setup(false)
  const hook = renderHook(({ open }) => useFavorites(open), {
    wrapper,
    initialProps: { open: false },
  })
  expect(api.listFavorites).not.toHaveBeenCalled()
  hook.rerender({ open: true })
  await waitFor(() => expect(hook.result.current.fetchStatus).toBe('idle'))
  expect(api.listFavorites).not.toHaveBeenCalled()
})

it.each([false, true])(
  'updates immediately and rolls back rejected writes (already starred=%s)',
  async (starred) => {
    const { client, wrapper } = setup(true)
    const original: CollaborationList = {
      items: starred
        ? [
            {
              ...target,
              label: input.label,
              href: input.href,
              available: true,
              id: 1,
              folder: null,
              sortOrder: 0,
            },
          ]
        : [],
      nextCursor: null,
    }
    client.setQueryData(queryKeys.collaborationFavorites(), original)
    let reject!: (error: Error) => void
    vi.mocked(starred ? api.unstarFavorite : api.starFavorite).mockReturnValue(
      new Promise<CollaborationMutationResult>((_resolve, rejectPromise) => {
        reject = rejectPromise
      })
    )
    const hook = renderHook(() => useToggleFavorite(), { wrapper })
    act(() => hook.result.current.mutate({ ...input, starred }))
    await waitFor(() =>
      expect(
        client.getQueryData<CollaborationList>(queryKeys.collaborationFavorites())?.items
      ).toHaveLength(starred ? 0 : 1)
    )
    expect(hook.result.current.isPending).toBe(true)
    await act(async () => reject(new Error('denied')))
    await waitFor(() => expect(hook.result.current.isError).toBe(true))
    expect(client.getQueryData(queryKeys.collaborationFavorites())).toEqual(original)
  }
)

it('revalidates after a successful toggle and sends only target identity', async () => {
  const { client, wrapper } = setup(true)
  client.setQueryData(queryKeys.collaborationFavorites(), empty)
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  vi.mocked(api.starFavorite).mockResolvedValue({ success: true })
  const hook = renderHook(() => useToggleFavorite(), { wrapper })
  await act(async () => {
    await hook.result.current.mutateAsync(input)
  })
  expect(api.starFavorite).toHaveBeenCalledWith(target)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.collaborationFavorites() })
})

it('records once per open, including StrictMode replay and route transitions', async () => {
  const { wrapper } = setup(true)
  const hook = renderHook(({ recordId }) => useRecordRecentView({ ...target, recordId }), {
    wrapper,
    initialProps: { recordId: '1' },
  })
  await waitFor(() => expect(api.recordRecent).toHaveBeenCalledTimes(1))
  hook.rerender({ recordId: '1' })
  expect(api.recordRecent).toHaveBeenCalledTimes(1)
  hook.rerender({ recordId: '2' })
  await waitFor(() => expect(api.recordRecent).toHaveBeenCalledTimes(2))
  hook.rerender({ recordId: '1' })
  await waitFor(() => expect(api.recordRecent).toHaveBeenCalledTimes(3))
})

it('does not record when unavailable and equates nullable non-record keys', () => {
  const { wrapper } = setup(false)
  renderHook(() => useRecordRecentView(target), { wrapper })
  expect(api.recordRecent).not.toHaveBeenCalled()
  expect(
    sameFavorite(
      { targetType: 'TABLE', targetName: 'person' },
      { targetType: 'TABLE', targetName: 'person', recordId: null }
    )
  ).toBe(true)
})
