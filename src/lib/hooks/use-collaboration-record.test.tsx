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
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import * as api from '@/lib/api/collaboration'
import { queryKeys } from '@/lib/query-client'
import { useUpdateTags, useUpdateFollow, useResolveComment } from './use-collaboration-record'

vi.mock('@/lib/api/collaboration', () => ({
  putRecordTags: vi.fn(),
  putFollow: vi.fn(),
  deleteFollow: vi.fn(),
  resolveComment: vi.fn(),
}))
const record = { table: 'person', pk: '1' }
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((a, b) => {
    resolve = a
    reject = b
  })
  return { promise, resolve, reject }
}
beforeEach(() => vi.resetAllMocks())
it('optimistically adds/removes tags, shares the pending lock and restores the exact snapshot', async () => {
  const { client, wrapper } = setup()
  const key = queryKeys.collaborationResource('person', '1', 'tags')
  const previous = { items: [{ id: 1, label: 'Old' }], nextCursor: null }
  client.setQueryData(key, previous)
  const write = deferred<Awaited<ReturnType<typeof api.putRecordTags>>>()
  vi.mocked(api.putRecordTags).mockReturnValue(write.promise)
  const first = renderHook(() => useUpdateTags(record), { wrapper })
  const second = renderHook(() => useUpdateTags(record), { wrapper })
  act(() => first.result.current.mutate({ add: [{ id: 2, label: 'New' }], remove: [1] }))
  await waitFor(() =>
    expect(client.getQueryData(key)).toEqual({ items: [{ id: 2, label: 'New' }], nextCursor: null })
  )
  await waitFor(() => expect(second.result.current.isPending).toBe(true))
  act(() => write.reject(new Error('Denied')))
  await waitFor(() => expect(first.result.current.isError).toBe(true))
  expect(client.getQueryData(key)).toEqual(previous)
})
it('rolls back follow preferences and unfollow independently', async () => {
  const { client, wrapper } = setup()
  const key = queryKeys.collaborationResource('person', '1', 'follow')
  const previous = { following: true, follow: { notifyOnChange: true, notifyOnComment: true } }
  client.setQueryData(key, previous)
  const write = deferred<Awaited<ReturnType<typeof api.putFollow>>>()
  vi.mocked(api.putFollow).mockReturnValue(write.promise)
  const { result } = renderHook(() => useUpdateFollow(record), { wrapper })
  act(() => result.current.mutate({ notifyOnChange: false }))
  await waitFor(() =>
    expect(client.getQueryData(key)).toEqual({
      following: true,
      follow: { notifyOnChange: false, notifyOnComment: true },
    })
  )
  act(() => write.reject(new Error('Denied')))
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(client.getQueryData(key)).toEqual(previous)
  const remove = deferred<Awaited<ReturnType<typeof api.deleteFollow>>>()
  vi.mocked(api.deleteFollow).mockReturnValue(remove.promise)
  act(() => result.current.mutate(null))
  await waitFor(() => expect(client.getQueryData(key)).toEqual({ following: false, follow: null }))
  act(() => remove.reject(new Error('Denied')))
  await waitFor(() => expect(client.getQueryData(key)).toEqual(previous))
})
it('resolves a thread on a later page without changing its replies, then rolls back', async () => {
  const { client, wrapper } = setup()
  const key = queryKeys.collaborationResource('person', '1', 'comments')
  const previous = {
    pages: [
      { threads: [{ id: 1, resolved: false, replies: [] }], nextCursor: 'second' },
      {
        threads: [{ id: 2, resolved: false, replies: [{ id: 3, body: 'reply' }] }],
        nextCursor: null,
      },
    ],
    pageParams: [undefined, 'second'],
  }
  client.setQueryData(key, previous)
  const write = deferred<Awaited<ReturnType<typeof api.resolveComment>>>()
  vi.mocked(api.resolveComment).mockReturnValue(write.promise)
  const { result } = renderHook(() => useResolveComment(record), { wrapper })
  act(() => result.current.mutate({ id: 2, resolved: true }))
  await waitFor(() =>
    expect(client.getQueryData<typeof previous>(key)?.pages[1].threads[0].resolved).toBe(true)
  )
  expect(client.getQueryData<typeof previous>(key)?.pages[1].threads[0].replies).toEqual([
    { id: 3, body: 'reply' },
  ])
  act(() => write.reject(new Error('Denied')))
  await waitFor(() => expect(client.getQueryData(key)).toEqual(previous))
})
it('invalidates record activity after a successful optimistic write', async () => {
  const { client, wrapper } = setup()
  const key = queryKeys.collaborationResource('person', '1', 'timeline')
  client.setQueryData(key, { pages: [] })
  vi.mocked(api.putFollow).mockResolvedValue({ following: true, follow: { notifyOnChange: true } })
  const { result } = renderHook(() => useUpdateFollow(record), { wrapper })
  await act(async () => {
    await result.current.mutateAsync({ notifyOnChange: true })
  })
  expect(client.getQueryState(key)?.isInvalidated).toBe(true)
})
