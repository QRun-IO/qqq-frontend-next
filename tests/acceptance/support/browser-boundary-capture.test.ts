/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserBoundaryInit, createBoundaryBuffer, installBrowserBoundaryCapture } from './browser-boundary-capture'

type EventRecord = Record<string, unknown>

/** Native delegate substitute: exposes argument/identity contracts without HTTP or jsdom XHR behavior. */
class NativeXHR extends EventTarget {
  readyState = 0
  status = 0
  calls: { operation: string; receiver: unknown; args: unknown[] }[] = []
  openResult = { native: 'open' }
  sendResult = { native: 'send' }
  openFailure: unknown
  sendFailure: unknown
  open(...args: unknown[]) {
    this.calls.push({ operation: 'open', receiver: this, args })
    if (this.openFailure) throw this.openFailure
    // Reopening aborts the previous request before the new OPENED state.
    if (this.readyState === 2) this.dispatchEvent(new Event('abort'))
    const wasOpened = this.readyState === 1
    this.readyState = 1
    if (!wasOpened) this.dispatchEvent(new Event('readystatechange'))
    return this.openResult
  }
  send(...args: unknown[]) {
    this.calls.push({ operation: 'send', receiver: this, args })
    if (this.sendFailure) throw this.sendFailure
    return this.sendResult
  }
  state(readyState: number, status: number) {
    this.readyState = readyState
    this.status = status
    this.dispatchEvent(new Event('readystatechange'))
  }
}

const originalOpen = Object.getOwnPropertyDescriptor(NativeXHR.prototype, 'open')!
const originalSend = Object.getOwnPropertyDescriptor(NativeXHR.prototype, 'send')!
const config = { origins: ['http://localhost:3000'], maxEvents: 256 }
let events: EventRecord[]
let cleanup: (() => void) | undefined

beforeEach(() => {
  history.replaceState({}, '', '/app/person')
  events = []
  vi.stubGlobal('XMLHttpRequest', NativeXHR)
  vi.stubGlobal('__qqqBrowserBoundary', (event: EventRecord) => { events.push(event); return Promise.resolve() })
})
afterEach(() => {
  cleanup?.()
  cleanup = undefined
  Object.defineProperty(NativeXHR.prototype, 'open', originalOpen)
  Object.defineProperty(NativeXHR.prototype, 'send', originalSend)
  vi.unstubAllGlobals()
})

function install() { cleanup = browserBoundaryInit(config) }
function kinds() { return events.map(event => event.event) }
function event(overrides: EventRecord = {}) {
  return { version: 1, documentId: '12345678-1234-4234-8234-123456789abc', seq: 1,
    timeOrigin: 1000, now: 2, page: 'person', event: 'ready', phase: 'active', ...overrides }
}

describe('document-local boundary capture', () => {
  it('observes native arguments/results without reading credentials or payloads', () => {
    install()
    const xhr = new NativeXHR()
    const body = { password: 'BODY_SECRET' }
    expect(xhr.open('POST', '/qqq/v1/table/person/query?token=QUERY_SECRET#HASH_SECRET', true, 'USER_SECRET', 'PASSWORD_SECRET')).toBe(xhr.openResult)
    expect(xhr.send(body)).toBe(xhr.sendResult)
    expect(xhr.calls).toEqual([
      { operation: 'open', receiver: xhr, args: ['POST', '/qqq/v1/table/person/query?token=QUERY_SECRET#HASH_SECRET', true, 'USER_SECRET', 'PASSWORD_SECRET'] },
      { operation: 'send', receiver: xhr, args: [body] },
    ])
    expect(kinds()).toEqual(['ready', 'open-return', 'send-enter', 'send-return'])
    expect(events.at(-1)).toMatchObject({ endpoint: 'person-query', method: 'POST', xhr: 1, generation: 1, attempt: 1 })
    expect(JSON.stringify(events)).not.toMatch(/SECRET|password|token=|\/qqq|\/app/)
    expect(Object.getOwnPropertyDescriptor(NativeXHR.prototype, 'open')).toMatchObject({ configurable: originalOpen.configurable, writable: originalOpen.writable, enumerable: originalOpen.enumerable })
  })

  it('rethrows the identical native exception and never reads its message or name', () => {
    install()
    const xhr = new NativeXHR()
    xhr.open('GET', '/qqq/v1/manageSession')
    const failure = new Error('MESSAGE_SECRET')
    Object.defineProperty(failure, 'name', { get() { throw new Error('must not read name') } })
    xhr.sendFailure = failure
    let caught: unknown
    try { xhr.send() } catch (error) { caught = error }
    expect(caught).toBe(failure)
    expect(kinds().slice(-2)).toEqual(['send-enter', 'send-throw'])
    expect(events.at(-1)?.errorClass).toBe('Error')
    expect(JSON.stringify(events)).not.toContain('SECRET')
    expect(xhr.calls.filter(call => call.operation === 'send')).toHaveLength(1)
  })

  it('preserves failed open and unknown URL objects without coercion or stale request identity', () => {
    install()
    const xhr = new NativeXHR()
    xhr.open('GET', '/qqq/v1/manageSession')
    const url = { toString: vi.fn(() => 'OBJECT_SECRET') }
    xhr.open('GET', url)
    xhr.send('BODY_SECRET')
    expect(url.toString).not.toHaveBeenCalled()
    expect(kinds().filter(kind => kind === 'send-enter')).toEqual([])
    const failure = new DOMException('PRIVATE', 'SyntaxError')
    xhr.state(4, 200)
    xhr.dispatchEvent(new Event('loadend'))
    xhr.openFailure = failure
    expect(() => xhr.open('GET', '/qqq/v1/manageSession')).toThrow(failure)
    expect(events.at(-1)).toMatchObject({ event: 'open-throw', errorClass: 'DOMException' })
    expect(JSON.stringify(events)).not.toMatch(/SECRET|PRIVATE/)
  })

  it('uses one listener set and distinguishes reuse after the prior loadend', () => {
    install()
    const xhr = new NativeXHR()
    xhr.open('GET', '/qqq/v1/manageSession')
    xhr.send()
    xhr.state(2, 200)
    xhr.state(2, 200)
    xhr.state(4, 200)
    xhr.dispatchEvent(new Event('loadend'))
    xhr.open('POST', '/qqq/v1/table/person/count')
    xhr.send()
    xhr.state(2, 500)
    xhr.state(4, 500)
    xhr.state(4, 500)
    xhr.dispatchEvent(new Event('load'))
    xhr.dispatchEvent(new Event('loadend'))
    expect(events.filter(row => row.event === 'headers').map(row => [row.generation, row.status])).toEqual([[1, 200], [2, 500]])
    expect(events.filter(row => row.event === 'done').map(row => row.generation)).toEqual([1, 2])
    expect(events.filter(row => row.event === 'loadend').map(row => [row.xhr, row.generation])).toEqual([[1, 1], [1, 2]])
  })

  it.each(['first-send', 'nested-open', 'reopen-send'])('marks %s during native OPENED as incomplete instead of inventing attribution', scenario => {
    install()
    const xhr = new NativeXHR()
    if (scenario === 'reopen-send') {
      xhr.open('POST', '/qqq/v1/table/person/query')
      xhr.send()
      xhr.state(4, 200)
      xhr.dispatchEvent(new Event('loadend'))
    }
    let entered = false
    let sendResult: unknown
    const body = { secret: 'BODY_SECRET' }
    xhr.addEventListener('readystatechange', () => {
      if (xhr.readyState !== 1 || entered) return
      entered = true
      if (scenario === 'nested-open') xhr.open('POST', '/qqq/v1/table/person/count')
      sendResult = xhr.send(body)
    })
    const start = events.length
    expect(xhr.open('GET', '/qqq/v1/manageSession')).toBe(xhr.openResult)
    expect(sendResult).toBe(xhr.sendResult)
    expect(xhr.calls.at(-1)).toEqual({ operation: 'send', receiver: xhr, args: [body] })
    const sendCount = scenario === 'reopen-send' ? 2 : 1
    expect(xhr.calls.filter(call => call.operation === 'send')).toHaveLength(sendCount)
    xhr.state(2, 200)
    xhr.state(4, 200)
    xhr.dispatchEvent(new Event('load'))
    xhr.dispatchEvent(new Event('loadend'))
    const after = events.slice(start)
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ event: 'xhr-incomplete', xhr: 1,
      reason: scenario === 'nested-open' ? 'reentrant-open' : 'send-during-open' })
    expect(after[0]).not.toHaveProperty('endpoint')
    expect(after[0]).not.toHaveProperty('generation')
    expect(after[0]).not.toHaveProperty('attempt')
    // Once ambiguous, reusing that instance cannot silently regain trustworthy attribution.
    xhr.open('GET', '/qqq/v1/manageSession')
    xhr.send()
    expect(events.slice(start)).toEqual(after)
    const next = new NativeXHR()
    next.open('POST', '/qqq/v1/table/person/count')
    next.send()
    expect(events.at(-1)).toMatchObject({ event: 'send-return', xhr: 2, endpoint: 'person-count', attempt: 1 })
  })

  it.each(['/qqq/v1/manageSession', '/excluded'])('marks reuse from an earlier %s load listener incomplete before old events are attributed', initialURL => {
    install()
    const xhr = new NativeXHR()
    let reused = false
    xhr.addEventListener('load', () => {
      if (reused) return
      reused = true
      xhr.open('POST', '/qqq/v1/table/person/count')
      xhr.send()
    })
    xhr.open('GET', initialURL)
    xhr.send()
    xhr.state(4, 200)
    const start = events.length
    xhr.dispatchEvent(new Event('load'))
    xhr.dispatchEvent(new Event('loadend'))
    xhr.state(4, 200)
    xhr.dispatchEvent(new Event('load'))
    xhr.dispatchEvent(new Event('loadend'))
    expect(xhr.calls.filter(call => call.operation === 'send')).toHaveLength(2)
    expect(events.slice(start)).toEqual([expect.objectContaining({ event: 'xhr-incomplete', reason: 'reuse-before-loadend', xhr: 1 })])
    expect(events.at(-1)).not.toHaveProperty('endpoint')
  })

  it('keeps terminal events on the active send when a repeated send throws', () => {
    install()
    const xhr = new NativeXHR()
    xhr.open('GET', '/qqq/v1/manageSession')
    xhr.send()
    xhr.sendFailure = new DOMException('PRIVATE', 'InvalidStateError')
    expect(() => xhr.send()).toThrow(DOMException)
    xhr.state(4, 0)
    xhr.dispatchEvent(new Event('abort'))
    expect(events.find(row => row.event === 'send-throw')).toMatchObject({ attempt: 2 })
    expect(events.find(row => row.event === 'abort')).toMatchObject({ attempt: 1 })
  })

  it.each(['error', 'abort', 'timeout'])('retains %s separately from loadend and status zero', terminal => {
    install()
    const xhr = new NativeXHR()
    xhr.open('GET', '/qqq/v1/metaData/table/person')
    xhr.send()
    xhr.state(4, 0)
    xhr.dispatchEvent(new Event(terminal))
    xhr.dispatchEvent(new Event('loadend'))
    expect(events.slice(-2).map(row => [row.event, row.status])).toEqual([[terminal, 0], ['loadend', 0]])
  })

  it('keeps observer failures out of native delegation and absorbs binding rejection', async () => {
    install()
    const xhr = new NativeXHR()
    vi.stubGlobal('__qqqBrowserBoundary', () => { throw new Error('OBSERVER_SECRET') })
    expect(xhr.open('GET', '/qqq/v1/manageSession')).toBe(xhr.openResult)
    vi.stubGlobal('__qqqBrowserBoundary', () => Promise.reject(new Error('OBSERVER_SECRET')))
    expect(xhr.send()).toBe(xhr.sendResult)
    await Promise.resolve()
    expect(xhr.calls).toHaveLength(2)
  })

  it('does not install outside the exact owned page and origin allowlist', () => {
    history.replaceState({}, '', '/app/person/private-token')
    install()
    expect(events).toEqual([])
    expect(Object.getOwnPropertyDescriptor(NativeXHR.prototype, 'send')).toEqual(originalSend)
  })

  it('excludes unselected endpoints and cross-origin requests', () => {
    install()
    for (const url of ['/qqq/v1/table/person/PRIVATE', 'https://unrelated.invalid/qqq/v1/manageSession']) {
      const xhr = new NativeXHR()
      xhr.open('GET', url)
      xhr.send('SECRET')
      xhr.state(4, 200)
      xhr.dispatchEvent(new Event('loadend'))
    }
    expect(kinds()).toEqual(['ready'])
  })

  it('records document identity/lifecycle without installing unload listeners or changing same-document identity', () => {
    const listen = vi.spyOn(window, 'addEventListener')
    install()
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    expect(kinds()).toEqual(['ready', 'pagehide', 'pageshow'])
    expect(new Set(events.map(row => row.documentId)).size).toBe(1)
    expect(events.map(row => row.seq)).toEqual([1, 2, 3])
    expect(events.slice(1).map(row => row.persisted)).toEqual([true, true])
    expect(listen.mock.calls.map(call => call[0])).not.toContain('beforeunload')
    expect(listen.mock.calls.map(call => call[0])).not.toContain('unload')
    listen.mockRestore()
  })

  it('captures the exact process aliases only when explicitly selected', () => {
    history.replaceState({}, '', '/app/person/2')
    install()
    expect(events).toEqual([])
    cleanup = browserBoundaryInit({ ...config, includeProcessPaths: true })
    const xhr = new NativeXHR()
    xhr.open('GET', '/qqq/v1/table/person/2')
    xhr.send()
    expect(events.at(-1)).toMatchObject({ page: 'person-record', endpoint: 'person-record', method: 'GET' })
    xhr.state(4, 200)
    xhr.dispatchEvent(new Event('loadend'))
    xhr.open('GET', '/qqq/v1/metaData/process/person.bulkEdit')
    xhr.send()
    expect(events.at(-1)).toMatchObject({ endpoint: 'process-metadata' })
    xhr.state(4, 200)
    xhr.dispatchEvent(new Event('loadend'))
    xhr.open('POST', '/qqq/v1/processes/person.bulkEdit/init')
    xhr.send()
    expect(events.at(-1)).toMatchObject({ endpoint: 'process-init' })
    xhr.state(4, 200)
    xhr.dispatchEvent(new Event('loadend'))
    const before = events.length
    xhr.open('GET', '/qqq/v1/processes/person.bulkEdit/init')
    xhr.send()
    expect(events).toHaveLength(before)
  })

  it('preserves an invalid native receiver and restores native descriptors on cleanup', () => {
    install()
    expect(() => NativeXHR.prototype.send.call(null as unknown as NativeXHR)).toThrow(TypeError)
    cleanup?.()
    expect(Object.getOwnPropertyDescriptor(NativeXHR.prototype, 'open')).toEqual(originalOpen)
    expect(Object.getOwnPropertyDescriptor(NativeXHR.prototype, 'send')).toEqual(originalSend)
  })

  it('bounds document output with an explicit overflow event', () => {
    cleanup = browserBoundaryInit({ ...config, maxEvents: 3 })
    const xhr = new NativeXHR()
    xhr.open('GET', '/qqq/v1/manageSession')
    xhr.send()
    xhr.state(4, 200)
    xhr.dispatchEvent(new Event('loadend'))
    expect(events).toHaveLength(4)
    expect(events.at(-1)).toMatchObject({ event: 'overflow' })
  })
})

describe('Node capture boundary', () => {
  it('rejects malformed/private payloads and bounds records with explicit counters', () => {
    const buffer = createBoundaryBuffer(2)
    buffer.add(event(), 'page-1', 'frame-1')
    buffer.add(event({ seq: 2, message: 'SECRET' }), 'page-1', 'frame-1')
    buffer.add(event({ seq: 2, endpoint: '/PRIVATE' }), 'page-1', 'frame-1')
    buffer.add(event({ seq: 2, now: Infinity }), 'page-1', 'frame-1')
    buffer.add(event({ seq: 2 }), 'page-1', 'frame-1')
    buffer.add(event({ seq: 3 }), 'page-1', 'frame-1')
    expect(buffer.snapshot()).toMatchObject({ invalid: 3, dropped: 1, events: [
      { pageId: 'page-1', frameId: 'frame-1', seq: 1 }, { seq: 2 },
    ] })
    expect(JSON.stringify(buffer.snapshot())).not.toContain('SECRET')
  })

  it('disabled installer creates no bindings, init scripts or capture handle', async () => {
    const context = { exposeBinding: vi.fn(), addInitScript: vi.fn() }
    expect(await installBrowserBoundaryCapture(context, { enabled: false, origins: config.origins })).toBeUndefined()
    expect(context.exposeBinding).not.toHaveBeenCalled()
    expect(context.addInitScript).not.toHaveBeenCalled()
  })
})
