/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Owned response completion before NAV-018 leaves its bare process route. */
import type { Frame, Page, Response } from '@playwright/test'

/** Arm before opening this unique process visit; dispose in finally if navigation/assertions fail. */
export function armGreetRouteResponses(page: Page, origin: string) {
  const processURLs = [origin + '/app/greetInteractive', origin + '/app/greetInteractive/']
  const pending = new Set(['GET /qqq/v1/metaData/table/person', 'POST /qqq/v1/processes/greetInteractive/init'])
  let committed = false
  let settled = false
  let resolve!: () => void
  let reject!: (error: Error) => void
  const wait = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  // Opening/asserting can fail before the caller awaits this promise.
  void wait.catch(() => undefined)
  const navigated = (frame: Frame) => {
    if (frame === page.mainFrame() && processURLs.includes(frame.url())) committed = true
  }
  const cleanup = () => {
    clearTimeout(timer)
    page.off('framenavigated', navigated)
    page.off('response', received)
  }
  const finish = (error?: Error) => {
    if (settled) return
    settled = true
    cleanup()
    if (error) reject(error)
    else resolve()
  }
  const received = (response: Response) => {
    const request = response.request()
    const url = new URL(response.url())
    const key = `${request.method()} ${url.pathname}`
    if (!committed || url.origin !== origin || url.search || url.hash || !pending.has(key)
      || request.frame() !== page.mainFrame() || !processURLs.includes(request.headers().referer)) return
    // Keep the deadline active through the body, not just response headers.
    void (async () => {
      if (response.status() !== 200) throw new Error('NAV-018 process response must return 200')
      if (await response.finished()) throw new Error('NAV-018 process response did not finish successfully')
      if (settled) return
      pending.delete(key)
      if (pending.size === 0) finish()
    })().catch((error: unknown) => finish(error instanceof Error ? error : new Error('NAV-018 response completion failed')))
  }
  const timer = setTimeout(() => finish(new Error('NAV-018 process responses did not finish within 15 seconds')), 15_000)
  page.on('framenavigated', navigated)
  page.on('response', received)
  return { wait, dispose: () => finish(new Error('NAV-018 response observation disposed')) }
}
