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

/** @file Directory search, presence beacon, personal task page, comment reply ordering and realtime transport edges. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import apiClient from './client'
import { beaconPresence, listMyTasks, normalizeComment, searchPeople } from './collaboration'
import { readRealtimeStream, updateRealtimeSubscriptions } from './realtime'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), notifyUnauthorized: vi.fn() },
  CLIENT_CHANNEL_HEADER: { 'X-QQQ-Client': 'next-ui' },
  userTimeZoneHeader: () => ({}),
}))
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

it('searches the directory with a bounded page and normalizes each person', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    items: [{ userId: 'sam', displayName: 'Sam Parker', email: 'sam@example.test' }, null],
    nextCursor: 'n1',
  })
  const result = await searchPeople('sam')
  expect(apiClient.get).toHaveBeenCalledWith('/qbit/collaboration/people', {
    params: { q: 'sam', limit: 50 },
  })
  expect(result.nextCursor).toBe('n1')
  expect(result.items[0]).toEqual({
    userId: 'sam',
    displayName: 'Sam Parker',
    email: 'sam@example.test',
  })
  expect(result.items[1].userId).toBeNull()
})

it('sends the last presence lease as a JSON beacon, and tolerates browsers without one', () => {
  const sendBeacon = vi.fn()
  Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
  beaconPresence({ table: 'person', pk: '1', mode: 'VIEWING' } as never)
  expect(sendBeacon).toHaveBeenCalledWith('/qqq/v1/qbit/collaboration/presence', expect.any(Blob))
  expect((sendBeacon.mock.calls[0][1] as Blob).type).toBe('application/json')
  Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true })
  expect(() => beaconPresence({ table: 'person', pk: '1', mode: 'VIEWING' } as never)).not.toThrow()
})

it('reads open personal tasks and rejects a task without an identifier', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    items: [{ id: 4, title: 'Mine' }],
    nextCursor: 'c',
  })
  const result = await listMyTasks('p')
  expect(apiClient.get).toHaveBeenCalledWith('/qbit/collaboration/tasks/mine', {
    params: { status: 'OPEN', limit: 50, cursor: 'p' },
  })
  expect(result.items[0].id).toBe(4)
  expect(result.nextCursor).toBe('c')
  vi.mocked(apiClient.get).mockResolvedValueOnce({ items: [{ title: 'No id' }] })
  await expect(listMyTasks()).rejects.toThrow('missing an identifier')
})

it('orders replies oldest first and tolerates replies without a timestamp', () => {
  const comment = normalizeComment({
    id: 1,
    replies: [
      { id: 3, createdAt: '2026-10-02T00:00:00Z' },
      { id: 4 },
      { id: 2, createdAt: '2026-10-01T00:00:00Z' },
    ],
  })
  expect(comment.replies.map((reply) => reply.id)).toEqual([4, 2, 3])
})

it('posts subscription changes for a server-issued connection', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ active: ['user:me'], refused: [] })
  expect(await updateRealtimeSubscriptions('c1', ['user:me'], ['table:x'])).toEqual({
    active: ['user:me'],
    refused: [],
  })
  expect(apiClient.post).toHaveBeenCalledWith('/realtime/subscriptions', {
    connectionId: 'c1',
    add: ['user:me'],
    remove: ['table:x'],
  })
})

it('reports an unauthorized stream as a session end without reading a body', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))
  const receive = vi.fn()
  await readRealtimeStream(new AbortController().signal, '', receive)
  expect(apiClient.notifyUnauthorized).toHaveBeenCalled()
  expect(receive).toHaveBeenCalledWith({ event: 'session-ended', data: '{}' })
  expect(vi.mocked(fetch).mock.calls[0][1]?.headers).not.toHaveProperty('Last-Event-ID')
})

it('rejects an unavailable stream so the client can back off and retry', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('down', { status: 503 }))
  await expect(readRealtimeStream(new AbortController().signal, '', vi.fn())).rejects.toThrow(
    'Realtime connection unavailable'
  )
})

it('stops reading and releases the stream once the signal aborts', async () => {
  const controller = new AbortController()
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode('event: resync\ndata: {}\n\n'))
    },
  })
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream))
  const receive = vi.fn(() => controller.abort())
  await readRealtimeStream(controller.signal, '', receive)
  expect(receive).toHaveBeenCalledTimes(1)
  expect(stream.locked).toBe(false)
})
