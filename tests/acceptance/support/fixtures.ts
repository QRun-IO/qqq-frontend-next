/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { randomUUID } from 'node:crypto'
import { test as base, expect, type APIRequestContext, type Page, type Response } from '@playwright/test'
import { ACCEPTANCE_BACKEND_URL } from './ports'

/** Personas defined by tests/acceptance/fixture/AcceptanceSampleServer.java. */
export type Persona = 'admin' | 'viewer' | 'noPets' | 'noProcesses' | 'expired'

/** Sample sharing-demo identities (owners of the seeded saved view and report). */
export type SampleUser = 'alice' | 'bob' | 'casey'

export interface Diagnostics {
  pageErrors: string[]
  consoleErrors: string[]
  failedRequests: string[]
  /** Substrings of expected console/request failures for negative scenarios. */
  allow: (pattern: string | RegExp) => void
}

type Row = Record<string, string | null>

export interface Backend {
  /** Read-only SELECT against the sample's owned in-memory database, bypassing the UI and API. */
  sql: (query: string) => Promise<Row[]>
  /** Direct backend HTTP call with this test's session, for independent enforcement checks. */
  api: APIRequestContext
  sessionId: string
  setPersona: (persona: Persona, user?: SampleUser) => Promise<void>
}

async function control(path: string, body: unknown) {
  const response = await fetch(`${ACCEPTANCE_BACKEND_URL}/acceptance/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Acceptance control ${path} failed ${response.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

export const test = base.extend<{ persona: Persona; user: SampleUser; backend: Backend; diagnostics: Diagnostics }>({
  persona: ['admin', { option: true }],
  user: ['alice', { option: true }],

  backend: async ({ context, persona, user, playwright }, use) => {
    const sessionId = randomUUID()
    await control('reset', {})
    await control('persona', { sessionId, persona, user })
    // Mock authentication keys each request's session to the sessionId cookie.
    await context.addCookies([{ name: 'sessionId', value: sessionId, url: 'http://127.0.0.1' }])
    const api = await playwright.request.newContext({
      baseURL: ACCEPTANCE_BACKEND_URL, extraHTTPHeaders: { Cookie: `sessionId=${sessionId}` },
    })
    await use({
      sessionId,
      api,
      sql: async (query) => (await control('sql', { query })).rows,
      setPersona: async (next, nextUser = user) => { await control('persona', { sessionId, persona: next, user: nextUser }) },
    })
    await api.dispose()
  },

  diagnostics: async ({ page }, use, testInfo) => {
    const allowed: (string | RegExp)[] = []
    const matches = (text: string) => allowed.some((pattern) => typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text))
    const diagnostics: Diagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [], allow: (pattern) => { allowed.push(pattern) } }
    page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') diagnostics.consoleErrors.push(message.text()) })
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText ?? ''
      // Navigation-cancelled background reads are not application failures.
      if (!/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(failure)) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${failure}`)
    })
    page.on('response', (response: Response) => {
      if (response.status() >= 400) diagnostics.failedRequests.push(`${response.request().method()} ${new URL(response.url()).pathname} ${response.status()}`)
    })
    await use(diagnostics)
    const unexpected = [
      ...diagnostics.pageErrors.map((text) => `pageerror: ${text}`),
      ...diagnostics.consoleErrors.map((text) => `console: ${text}`),
      ...diagnostics.failedRequests.map((text) => `request: ${text}`),
    ].filter((text) => !matches(text))
    await testInfo.attach('diagnostics.json', { body: JSON.stringify(diagnostics, null, 2), contentType: 'application/json' })
    expect(unexpected, 'unexplained console errors or failed application requests').toEqual([])
  },
})

export { expect }

/** Opens a route with the persona session and diagnostics attached. */
export async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
}
