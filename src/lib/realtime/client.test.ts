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

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { RealtimeClient } from './client'
import { invalidateRealtime } from './invalidate'
import type { SseEvent } from '@/lib/api/sse-parser'
import { queryKeys } from '@/lib/query-client'

const clients: RealtimeClient[] = []
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  clients.forEach((c) => c.close())
  clients.length = 0
  vi.useRealTimers()
})
function transport() {
  let receive!: (event: SseEvent) => void
  let finish!: () => void
  const read = vi.fn((signal: AbortSignal, _cursor: string, callback: typeof receive) => {
    receive = callback
    return new Promise<void>((resolve) => {
      finish = resolve
      signal.addEventListener('abort', () => resolve())
    })
  })
  const active = new Set<string>()
  const update = vi.fn(async (_id: string, add: string[], remove: string[]) => {
    add.forEach((c) => active.add(c))
    remove.forEach((c) => active.delete(c))
    return { active: [...active], refused: [] as string[] }
  })
  return {
    read,
    update,
    emit: (event: string, data: object, id?: string) =>
      receive({ event, data: JSON.stringify(data), id }),
    finish: () => finish(),
  }
}
function make(t: ReturnType<typeof transport>, options = {}) {
  const client = new RealtimeClient('test', { bus: null, ...t, ...options })
  clients.push(client)
  return client
}
it('ref-counts subscriptions and restores channels on reconnect with Last-Event-ID and backoff', async () => {
  const t = transport()
  const client = make(t)
  const first = client.subscribe('record:person:1')
  const second = client.subscribe('record:person:1')
  await vi.advanceTimersByTimeAsync(1)
  t.emit('hello', { connectionId: 'c1' }, 'c1:0')
  await vi.advanceTimersByTimeAsync(0)
  expect(t.update).toHaveBeenLastCalledWith('c1', ['record:person:1'], [])
  first()
  await vi.advanceTimersByTimeAsync(0)
  expect(t.update).toHaveBeenCalledTimes(1)
  t.emit('record.changed', { table: 'person', pk: '1' }, 'c1:7')
  t.finish()
  await vi.advanceTimersByTimeAsync(999)
  expect(t.read).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(t.read.mock.calls[1][1]).toBe('c1:7')
  t.emit('hello', { connectionId: 'c2' })
  await vi.advanceTimersByTimeAsync(0)
  expect(t.update).toHaveBeenLastCalledWith('c2', ['record:person:1'], [])
  second()
  second()
  expect(t.read.mock.calls[1][0].aborted).toBe(true)
})
it('backs off repeated disconnects and stops permanently on session-ended', async () => {
  const t = transport()
  const client = make(t)
  client.subscribe('user:me')
  await vi.advanceTimersByTimeAsync(1)
  t.finish()
  await vi.advanceTimersByTimeAsync(1000)
  t.finish()
  await vi.advanceTimersByTimeAsync(1999)
  expect(t.read).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(1)
  expect(t.read).toHaveBeenCalledTimes(3)
  t.emit('session-ended', {})
  await vi.advanceTimersByTimeAsync(60000)
  expect(t.read).toHaveBeenCalledTimes(3)
})
it('invalidates records, panel counts, tasks, notifications and resync queries', () => {
  const cache = new QueryClient()
  const invalidate = vi.spyOn(cache, 'invalidateQueries')
  invalidateRealtime(cache, { event: 'record.changed', data: { table: 'person', pk: 1 } })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.tableRecord('person', '1') })
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: queryKeys.collaborationRecord('person', '1'),
  })
  for (const [event, resource] of [
    ['comment.updated', 'comments'],
    ['attachment.changed', 'attachments'],
    ['tags.changed', 'tags'],
    ['task.changed', 'tasks'],
  ]) {
    invalidateRealtime(cache, { event, data: { table: 'person', pk: '1' } })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.collaborationResource('person', '1', resource),
    })
  }
  invalidateRealtime(cache, { event: 'notification.created', data: {} })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.alerts() })
  invalidateRealtime(cache, { event: 'resync', data: {} })
  expect(invalidate).toHaveBeenLastCalledWith({ queryKey: queryKeys.all() })
})
class Bus {
  static peers = new Set<Bus>()
  onmessage?: (event: MessageEvent) => void
  constructor() {
    Bus.peers.add(this)
  }
  postMessage(data: unknown) {
    for (const peer of Bus.peers)
      if (peer !== this) queueMicrotask(() => peer.onmessage?.({ data } as MessageEvent))
  }
  close() {
    Bus.peers.delete(this)
  }
}
it('elects one leader, unions peer channels, relays events and takes over when the leader leaves', async () => {
  const a = transport()
  const b = transport()
  const leader = make(a, { id: 'a', bus: new Bus() as unknown as BroadcastChannel })
  const follower = make(b, { id: 'b', bus: new Bus() as unknown as BroadcastChannel })
  const release = leader.subscribe('record:person:1')
  follower.subscribe('table:person')
  const heard = vi.fn()
  follower.onEvent(heard)
  await vi.advanceTimersByTimeAsync(200)
  expect(a.read).toHaveBeenCalledTimes(1)
  expect(b.read).not.toHaveBeenCalled()
  a.emit('hello', { connectionId: 'shared' })
  await vi.advanceTimersByTimeAsync(0)
  expect(a.update.mock.calls[0][1]).toEqual(
    expect.arrayContaining(['record:person:1', 'table:person'])
  )
  a.emit('resync', {}, 'shared:9')
  await vi.advanceTimersByTimeAsync(0)
  expect(heard).toHaveBeenCalledWith({ event: 'resync', data: {} })
  release()
  await vi.advanceTimersByTimeAsync(1)
  expect(a.read.mock.calls[0][0].aborted).toBe(true)
  expect(b.read).toHaveBeenCalledTimes(1)
  expect(b.read.mock.calls[0][1]).toBe('shared:9')
})
it('serializes subscription writes when a channel is released during an in-flight add', async () => {
  const t = transport()
  let resolve!: (v: { active: string[]; refused: string[] }) => void
  t.update.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      })
  )
  const client = make(t)
  client.subscribe('user:me')
  const release = client.subscribe('record:person:1')
  await vi.advanceTimersByTimeAsync(1)
  t.emit('hello', { connectionId: 'c' })
  release()
  resolve({ active: ['user:me', 'record:person:1'], refused: [] })
  await vi.advanceTimersByTimeAsync(0)
  expect(t.update).toHaveBeenLastCalledWith('c', [], ['record:person:1'])
})
