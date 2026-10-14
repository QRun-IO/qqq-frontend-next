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

import { beforeEach, expect, it, vi } from 'vitest'
import apiClient from './client'
import { updateRecord } from './tables'
import { readRealtimeStream } from './realtime'
import {
  createTask,
  getRecordLink,
  listTasks,
  previewShares,
  requestAccess,
  shareRecord,
} from './collaboration'
vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), notifyUnauthorized: vi.fn() },
  CLIENT_CHANNEL_HEADER: { 'X-QQQ-Client': 'next-ui' },
  userTimeZoneHeader: () => ({}),
}))
beforeEach(() => vi.clearAllMocks())
it('sends expectedVersion as a query parameter, with changed values in the multipart body', async () => {
  vi.mocked(apiClient.patch).mockResolvedValue({
    record: { tableName: 'person', values: { id: 1, firstName: 'Mine' } },
  })
  await updateRecord('person', 1, { firstName: 'Mine' }, undefined, '2026-10-01T12:34:56.123456Z')
  expect(apiClient.patch).toHaveBeenCalledWith(
    '/table/person/1',
    expect.any(FormData),
    expect.objectContaining({ params: { expectedVersion: '2026-10-01T12:34:56.123456Z' } })
  )
  const body = vi.mocked(apiClient.patch).mock.calls[0][1] as FormData
  expect([...body.keys()]).toEqual(['firstName'])
})
it('encodes record identities, preserves preview unknown and normalizes nullable task lists', async () => {
  const record = { table: 'a/b', pk: 'one/two' }
  vi.mocked(apiClient.get)
    .mockResolvedValueOnce({ url: '/app/a%2Fb/one%2Ftwo' })
    .mockResolvedValueOnce({ items: null })
  await getRecordLink(record)
  expect(apiClient.get).toHaveBeenCalledWith('/qbit/collaboration/records/a%2Fb/one%2Ftwo/link')
  expect(await listTasks(record)).toEqual({ items: [], nextCursor: null })
  vi.mocked(apiClient.post).mockResolvedValue({ recipients: [{ userId: 'sam', canRead: null }] })
  expect((await previewShares(record, ['sam'])).recipients?.[0].canRead).toBeNull()
  await shareRecord(record, { toUserIds: ['sam'], message: 'Hello' })
  expect(apiClient.post).toHaveBeenLastCalledWith(
    '/qbit/collaboration/records/a%2Fb/one%2Ftwo/shares',
    { toUserIds: ['sam'], message: 'Hello' }
  )
  await requestAccess({ tableName: 'a/b', recordId: 'one/two', shareId: 7 })
  expect(apiClient.post).toHaveBeenLastCalledWith('/qbit/collaboration/access-requests', {
    tableName: 'a/b',
    recordId: 'one/two',
    shareId: 7,
  })
})
it('preserves a refused assignee error for the task editor', async () => {
  const error = new Error('Assignee cannot open record')
  vi.mocked(apiClient.post).mockRejectedValue(error)
  await expect(
    createTask({ table: 'person', pk: '1' }, { title: 'Review', assigneeUserId: 'sam' })
  ).rejects.toBe(error)
})
it('streams SSE with credentials, attribution and Last-Event-ID', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('id: c:2\nevent: resync\ndata: {}\n\n'))
      controller.close()
    },
  })
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }))
  const receive = vi.fn()
  try {
    await readRealtimeStream(new AbortController().signal, 'c:1', receive)
    expect(fetchMock).toHaveBeenCalledWith(
      '/qqq/v1/realtime/stream',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'Last-Event-ID': 'c:1', 'X-QQQ-Client': 'next-ui' }),
      })
    )
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'resync', id: 'c:2', data: '{}' })
    )
  } finally {
    fetchMock.mockRestore()
  }
})
