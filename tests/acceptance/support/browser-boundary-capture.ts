/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { BrowserContext, Frame, Page } from '@playwright/test'

interface BrowserCaptureConfig {
  origins: string[]
  maxEvents: number
  includeProcessPaths?: boolean
  includeDashboardPaths?: boolean
}

/** Selects capture without changing the default-off or explicit full-capture switch. */
export function shouldCaptureBrowserBoundary(mode: string | undefined, project: string, title: string): boolean {
  if (mode === '1') return true
  if (mode !== 'navigation' || (project !== 'webkit' && project !== 'tablet')) return false
  return title === '[NAV-023] a unique-key value opens the matching record in place of the key URL @mobile'
    || title === '[NAV-056] appearance preferences explain an application theme override @mobile'
}

type BoundaryEvent = Record<string, string | number | boolean>

/** Runs before application scripts. Keep all runtime dependencies inside this serializable function. */
export function browserBoundaryInit(config: BrowserCaptureConfig): (() => void) | undefined {
  const pages: Record<string, string> = {
    '/app/person': 'person', '/app/person/': 'person',
    '/app/person/key': 'person-key', '/app/person/key/': 'person-key',
  }
  if (config.includeDashboardPaths) Object.assign(pages, { '/app': 'dashboard', '/app/': 'dashboard' })
  const endpoints: Record<string, string> = {
    'GET /qqq/v1/metaData/table/person': 'person-metadata',
    'POST /qqq/v1/processes/querySavedView/init': 'saved-view-init',
    'POST /qqq/v1/table/person/query': 'person-query',
    'POST /qqq/v1/table/person/count': 'person-count',
    'POST /qqq/v1/manageSession': 'session',
  }
  if (config.includeProcessPaths) {
    Object.assign(pages, { '/app/person/2': 'person-record', '/app/person/2/': 'person-record',
      '/app/person.bulkEdit': 'person-bulk-edit', '/app/person.bulkEdit/': 'person-bulk-edit' })
    Object.assign(endpoints, { 'GET /qqq/v1/table/person/2': 'person-record',
      'GET /qqq/v1/metaData/process/person.bulkEdit': 'process-metadata',
      'POST /qqq/v1/processes/person.bulkEdit/init': 'process-init' })
  }
  const page = pages[location.pathname]
  if (!config.origins.includes(location.origin) || !page) return
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
  const documentId = crypto.randomUUID()
  const timeOrigin = performance.timeOrigin
  let sequence = 0
  let phase = 'active'
  let active = true
  let overflow = false
  let nextXHR = 0
  const limit = Math.max(1, Math.min(config.maxEvents, 4096))
  const errorClass = (error: unknown) => error instanceof DOMException ? 'DOMException' : error instanceof Error ? 'Error' : 'other'
  const emit = (event: string, details: BoundaryEvent = {}) => {
    if (!active || overflow) return
    try {
      if (sequence >= limit) { overflow = true; event = 'overflow'; details = {} }
      const binding = (globalThis as unknown as { __qqqBrowserBoundary?: (value: BoundaryEvent) => Promise<unknown> }).__qqqBrowserBoundary
      const result = binding?.({ version: 1, documentId, seq: ++sequence, timeOrigin, now: performance.now(), page, event, phase, ...details })
      // A dying document may lose binding delivery. Never turn that gap into an application rejection.
      void result?.catch(() => undefined)
    } catch { /* Observation must never replace the native call's outcome. */ }
  }
  const selected = (args: unknown[]) => {
    try {
      if (typeof args[0] !== 'string' || typeof args[1] !== 'string') return
      const method = args[0].toUpperCase()
      const url = new URL(args[1], location.href)
      const endpoint = endpoints[`${method} ${url.pathname}`]
      if (endpoint && methods.includes(method) && config.origins.includes(url.origin)) return { method, endpoint }
    } catch { /* Unknown URL forms are delegated without extra coercion. */ }
  }
  interface Observation {
    xhr: number
    generation: number
    attempt: number
    activeAttempt: number
    awaitingEnd: boolean
    target?: { method: string; endpoint: string }
    headers: boolean
    done: boolean
  }
  const observations = new WeakMap<XMLHttpRequest, Observation>()
  const identities = new WeakMap<XMLHttpRequest, number>()
  const opening = new WeakMap<XMLHttpRequest, ReturnType<typeof selected>>()
  const incomplete = new WeakMap<XMLHttpRequest, 'reentrant-open' | 'send-during-open' | 'reuse-before-loadend'>()
  const reportedIncomplete = new WeakSet<XMLHttpRequest>()
  const identity = (xhr: XMLHttpRequest) => {
    let id = identities.get(xhr)
    if (id === undefined && nextXHR < 256) { id = ++nextXHR; identities.set(xhr, id) }
    return id
  }
  const markIncomplete = (xhr: XMLHttpRequest, reason: 'reentrant-open' | 'send-during-open' | 'reuse-before-loadend', relevant = false) => {
    try {
      const observation = observations.get(xhr)
      relevant ||= Boolean(opening.get(xhr) || observation?.target)
      if (!incomplete.has(xhr)) incomplete.set(xhr, reason)
      if (observation) observation.target = undefined
      if (relevant && !reportedIncomplete.has(xhr)) {
        reportedIncomplete.add(xhr)
        const id = identity(xhr)
        emit('xhr-incomplete', { reason: incomplete.get(xhr)!, ...(id === undefined ? {} : { xhr: id }) })
      }
    } catch { /* Reentrant instrumentation must not change native receiver validation. */ }
  }
  const prototype = XMLHttpRequest.prototype
  const openDescriptor = Object.getOwnPropertyDescriptor(prototype, 'open')!
  const sendDescriptor = Object.getOwnPropertyDescriptor(prototype, 'send')!
  const nativeOpen = prototype.open
  const nativeSend = prototype.send
  const details = (observation: Observation): BoundaryEvent => ({
    xhr: observation.xhr, generation: observation.generation, attempt: observation.activeAttempt, ...observation.target,
  })
  const observe = (xhr: XMLHttpRequest) => {
    const listener = (event: Event) => {
      try {
        const observation = observations.get(xhr)
        if (!observation || incomplete.has(xhr)) return
        if (event.type === 'loadend') observation.awaitingEnd = false
        if (!observation.target) return
        const status = xhr.status
        const readyState = xhr.readyState
        let kind = event.type
        if (kind === 'readystatechange') {
          if (readyState === 2 && !observation.headers) { observation.headers = true; kind = 'headers' }
          else if (readyState === 4 && !observation.done) { observation.done = true; kind = 'done' }
          else return
        }
        emit(kind, { ...details(observation), status, readyState })
      } catch { /* Status getters or observer delivery cannot affect application event listeners. */ }
    }
    for (const name of ['readystatechange', 'load', 'error', 'abort', 'timeout', 'loadend']) xhr.addEventListener(name, listener)
  }
  const wrappedOpen = function (this: XMLHttpRequest, ...args: unknown[]) {
    const target = selected(args)
    let outer = false
    try {
      if (observations.get(this)?.awaitingEnd) markIncomplete(this, 'reuse-before-loadend', Boolean(target))
      if (opening.has(this)) markIncomplete(this, 'reentrant-open', Boolean(target))
      else { opening.set(this, target); outer = true }
      if (incomplete.has(this)) markIncomplete(this, incomplete.get(this)!, Boolean(target))
    } catch { /* Invalid receivers still reach the original native validation. */ }
    let result: unknown
    try { result = Reflect.apply(nativeOpen, this, args) }
    catch (error) {
      if (target && !incomplete.has(this)) emit('open-throw', { ...target, errorClass: errorClass(error) })
      throw error
    } finally {
      if (outer) opening.delete(this)
    }
    if (incomplete.has(this)) return result
    // Native open can synchronously abort a previous generation; update only after delegation.
    try {
      let observation = observations.get(this)
      if (!observation) {
        // Excluded requests retain only lifecycle state so old events cannot impersonate later selected reuse.
        observation = { xhr: 0, generation: 0, attempt: 0, activeAttempt: 0, awaitingEnd: false, headers: false, done: false }
        observations.set(this, observation)
        observe(this)
      }
      if (target && observation.xhr === 0) {
        const id = identity(this)
        if (id === undefined) { emit('xhr-limit'); return result }
        observation.xhr = id
      }
      if (observation) {
        observation.generation += 1
        observation.attempt = 0
        observation.activeAttempt = 0
        observation.awaitingEnd = false
        observation.target = target
        observation.headers = false
        observation.done = false
        if (target) emit('open-return', details(observation))
      }
    } catch { /* Do not replace a successful native return with an observer failure. */ }
    return result
  }
  const wrappedSend = function (this: XMLHttpRequest, ...args: unknown[]) {
    // OPENED callbacks may send/reopen before the outer open returns. Their identity is ambiguous.
    if (opening.has(this)) markIncomplete(this, 'send-during-open')
    if (incomplete.has(this)) return Reflect.apply(nativeSend, this, args)
    const observation = observations.get(this)
    const sendGeneration = observation?.generation
    const previouslyAwaitingEnd = observation?.awaitingEnd
    if (observation) observation.awaitingEnd = true
    const previousAttempt = observation?.activeAttempt
    let call: BoundaryEvent | undefined
    if (observation?.target) {
      observation.activeAttempt = ++observation.attempt
      // Freeze this call's identity: synchronous native events can reopen the same XHR.
      call = details(observation)
      emit('send-enter', call)
    }
    let result: unknown
    try { result = Reflect.apply(nativeSend, this, args) }
    catch (error) {
      if (call && !incomplete.has(this)) emit('send-throw', { ...call, errorClass: errorClass(error) })
      if (observation && observation.generation === sendGeneration) {
        observation.activeAttempt = previousAttempt ?? 0
        observation.awaitingEnd = previouslyAwaitingEnd ?? false
      }
      throw error
    }
    if (call && !incomplete.has(this)) emit('send-return', call)
    return result
  }
  Object.defineProperty(prototype, 'open', { ...openDescriptor, value: wrappedOpen })
  Object.defineProperty(prototype, 'send', { ...sendDescriptor, value: wrappedSend })
  const lifecycle = (event: Event) => {
    if (event.type === 'pagehide') phase = 'pagehide'
    else if (event.type === 'pageshow') phase = 'active'
    const details: BoundaryEvent = {}
    if (event.type === 'pageshow' || event.type === 'pagehide') details.persisted = (event as PageTransitionEvent).persisted
    emit(event.type, details)
  }
  const visibility = () => emit('visibilitychange', { visibility: document.visibilityState === 'visible' ? 'visible' : 'hidden' })
  for (const name of ['pagehide', 'pageshow', 'DOMContentLoaded', 'load']) window.addEventListener(name, lifecycle)
  document.addEventListener('visibilitychange', visibility)
  emit('ready')
  return () => {
    active = false
    for (const name of ['pagehide', 'pageshow', 'DOMContentLoaded', 'load']) window.removeEventListener(name, lifecycle)
    document.removeEventListener('visibilitychange', visibility)
    if (prototype.open === wrappedOpen) Object.defineProperty(prototype, 'open', openDescriptor)
    if (prototype.send === wrappedSend) Object.defineProperty(prototype, 'send', sendDescriptor)
  }
}

/** Validates the untrusted binding payload before retaining only bounded metadata. */
export function createBoundaryBuffer(maxEvents = 4096) {
  const events: (BoundaryEvent & { pageId: string; frameId: string; receivedAt: number })[] = []
  let invalid = 0
  let dropped = 0
  const limit = Math.max(1, Math.min(maxEvents, 4096))
  const numeric = ['seq', 'timeOrigin', 'now', 'xhr', 'generation', 'attempt', 'status', 'readyState']
  const enums: Record<string, string[]> = {
    page: ['person', 'person-key', 'person-record', 'person-bulk-edit', 'dashboard'], phase: ['active', 'pagehide'],
    event: ['ready', 'pagehide', 'pageshow', 'DOMContentLoaded', 'load', 'visibilitychange', 'open-return', 'open-throw', 'send-enter', 'send-return', 'send-throw', 'headers', 'done', 'error', 'abort', 'timeout', 'loadend', 'overflow', 'xhr-limit', 'xhr-incomplete'],
    reason: ['reentrant-open', 'send-during-open', 'reuse-before-loadend'],
    endpoint: ['person-metadata', 'saved-view-init', 'person-query', 'person-count', 'session', 'person-record', 'process-metadata', 'process-init'],
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    errorClass: ['DOMException', 'Error', 'other'], visibility: ['visible', 'hidden'],
  }
  const validate = (value: unknown): value is BoundaryEvent => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const row = value as Record<string, unknown>
    if (row.version !== 1 || typeof row.documentId !== 'string' || !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(row.documentId)) return false
    for (const key of ['seq', 'timeOrigin', 'now', 'page', 'event', 'phase']) if (!(key in row)) return false
    for (const [key, field] of Object.entries(row)) {
      if (key === 'version' || key === 'documentId') continue
      if (numeric.includes(key)) {
        if (typeof field !== 'number' || !Number.isFinite(field) || field < 0 || field > Number.MAX_SAFE_INTEGER) return false
        if (['seq', 'xhr', 'generation', 'attempt', 'status', 'readyState'].includes(key) && !Number.isInteger(field)) return false
        if (key === 'status' && field > 599 || key === 'readyState' && field > 4) return false
      } else if (key === 'persisted') { if (typeof field !== 'boolean') return false }
      else if (!enums[key]?.includes(field as string)) return false
    }
    return true
  }
  return {
    add(value: unknown, pageId: string, frameId: string) {
      try {
        if (!validate(value)) { invalid += 1; return }
        if (events.length >= limit) { dropped += 1; return }
        events.push({ ...value, pageId, frameId, receivedAt: Date.now() })
      } catch { invalid += 1 }
    },
    snapshot: () => ({ version: 1, limit, invalid, dropped, events: events.map(event => ({ ...event })) }),
  }
}

/** Installs nothing when disabled; snapshotting reads Node memory only, even after page destruction. */
export async function installBrowserBoundaryCapture(
  context: Pick<BrowserContext, 'exposeBinding' | 'addInitScript'>,
  config: { enabled: boolean; origins: string[]; includeProcessPaths?: boolean; includeDashboardPaths?: boolean },
) {
  if (!config.enabled) return undefined
  const buffer = createBoundaryBuffer()
  const pages = new WeakMap<Page, string>()
  const frames = new WeakMap<Frame, string>()
  let pageSequence = 0
  let frameSequence = 0
  await context.exposeBinding('__qqqBrowserBoundary', ({ page, frame }, value: unknown) => {
    if (!pages.has(page)) pages.set(page, `page-${++pageSequence}`)
    if (!frames.has(frame)) frames.set(frame, `frame-${++frameSequence}`)
    buffer.add(value, pages.get(page)!, frames.get(frame)!)
  })
  await context.addInitScript(browserBoundaryInit, { origins: config.origins, maxEvents: 512, includeProcessPaths: config.includeProcessPaths, includeDashboardPaths: config.includeDashboardPaths })
  return { snapshot: buffer.snapshot }
}
