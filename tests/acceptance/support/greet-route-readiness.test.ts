/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */
import { EventEmitter } from 'node:events'
import type { Page, Response } from '@playwright/test'
import { afterEach, expect, it, vi } from 'vitest'
import { armGreetRouteResponses } from './greet-route-readiness'

const origin = 'http://127.0.0.1:18765'
function fixture() {
  const events = new EventEmitter()
  const frame = { url: () => `${origin}/app/greetInteractive` }
  const page = Object.assign(events, { mainFrame: () => frame }) as unknown as Page
  function response(role: 'metadata' | 'init', options: { referer?: string; origin?: string; method?: string; status?: number; frame?: object; finished?: Promise<Error | null> } = {}) {
    const request = {
      method: () => options.method ?? (role === 'metadata' ? 'GET' : 'POST'),
      frame: () => options.frame ?? frame,
      headers: () => ({ referer: options.referer ?? `${origin}/app/greetInteractive` }),
    }
    return {
      url: () => `${options.origin ?? origin}/qqq/v1/${role === 'metadata' ? 'metaData/table/person' : 'processes/greetInteractive/init'}`,
      request: () => request,
      status: () => options.status ?? 200,
      finished: () => options.finished ?? Promise.resolve(null),
    } as unknown as Response
  }
  return { events, frame, page, response }
}
afterEach(() => vi.useRealTimers())

it.each(['metadata', 'init'] as const)('stays pending until the actual %s response body finishes', async (role) => {
  const f = fixture()
  const barrier = armGreetRouteResponses(f.page, origin)
  f.events.emit('framenavigated', f.frame)
  let finish!: (error: Error | null) => void
  let settled = false
  void barrier.wait.then(() => { settled = true })
  f.events.emit('response', f.response(role, { finished: new Promise(resolve => { finish = resolve }) }))
  f.events.emit('response', f.response(role === 'metadata' ? 'init' : 'metadata'))
  await Promise.resolve(); await Promise.resolve()
  expect(settled).toBe(false)
  finish(null)
  await barrier.wait
  expect(f.events.listenerCount('response')).toBe(0)
  barrier.dispose()
})

it('ignores previous-document, other-origin, wrong-method, subframe and precommit responses', async () => {
  const f = fixture(); const barrier = armGreetRouteResponses(f.page, origin)
  let settled = false; void barrier.wait.then(() => { settled = true })
  f.events.emit('response', f.response('metadata'))
  f.events.emit('framenavigated', f.frame)
  for (const options of [{ referer: `${origin}/app/person` }, { origin: 'http://other.test' }, { method: 'POST' }, { frame: {} }]) {
    f.events.emit('response', f.response('metadata', options))
  }
  f.events.emit('response', f.response('init'))
  await Promise.resolve(); await Promise.resolve()
  expect(settled).toBe(false)
  f.events.emit('response', f.response('metadata'))
  await barrier.wait; barrier.dispose()
})

it.each([{ status: 500 }, { finished: Promise.resolve(new Error('transport failed')) }])('rejects an unsuccessful owned response', async (options) => {
  const f = fixture(); const barrier = armGreetRouteResponses(f.page, origin)
  f.events.emit('framenavigated', f.frame)
  f.events.emit('response', f.response('metadata', options))
  await expect(barrier.wait).rejects.toThrow('NAV-018')
  expect(f.events.listenerCount('response')).toBe(0)
  barrier.dispose()
})

it('bounds a response whose headers arrive but body never completes to 15 seconds', async () => {
  vi.useFakeTimers()
  const f = fixture(); const barrier = armGreetRouteResponses(f.page, origin)
  const rejected = expect(barrier.wait).rejects.toThrow('15 seconds')
  f.events.emit('framenavigated', f.frame)
  f.events.emit('response', f.response('metadata', { finished: new Promise(() => {}) }))
  f.events.emit('response', f.response('init'))
  await vi.advanceTimersByTimeAsync(15_000)
  await rejected
  expect(f.events.listenerCount('response')).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
})

it('disposes armed listeners/timer immediately if navigation throws, without replacing its error', async () => {
  vi.useFakeTimers()
  const f = fixture(); const failure = new Error('original navigation failure')
  const run = async () => {
    const barrier = armGreetRouteResponses(f.page, origin)
    try { throw failure } finally { barrier.dispose() }
  }
  await expect(run()).rejects.toBe(failure)
  await Promise.resolve()
  expect(f.events.listenerCount('response')).toBe(0)
  expect(f.events.listenerCount('framenavigated')).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
})

it('retains the actual response.finished rejection and removes observation listeners', async () => {
  const f = fixture(); const barrier = armGreetRouteResponses(f.page, origin)
  const failure = new Error('original body completion rejection')
  f.events.emit('framenavigated', f.frame)
  f.events.emit('response', f.response('metadata', { finished: Promise.reject(failure) }))
  await expect(barrier.wait).rejects.toBe(failure)
  expect(f.events.listenerCount('response')).toBe(0)
  expect(f.events.listenerCount('framenavigated')).toBe(0)
})
