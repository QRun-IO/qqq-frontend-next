/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { randomUUID } from 'node:crypto'
import { test as base, expect, type APIRequestContext, type Page, type Response } from '@playwright/test'
import { ACCEPTANCE_BACKEND_PORT, ACCEPTANCE_BACKEND_URL, ACCEPTANCE_UI_URL } from './ports'

/** Personas defined by tests/acceptance/fixture/AcceptanceSampleServer.java. */
export type Persona = 'admin' | 'viewer' | 'noPets' | 'noProcesses' | 'noApps' | 'expired'

/** Sample sharing-demo identities (owners of the seeded saved view and report). */
export type SampleUser = 'alice' | 'bob' | 'casey'

export interface Diagnostics {
  pageErrors: string[]
  consoleErrors: string[]
  failedRequests: string[]
  /**
   * Content-Security-Policy violations the page reported (`securitypolicyviolation`
   * events, in every frame and browser): `<directive> <blocked URI> at <source>:<line> <sample>`.
   */
  cspViolations: string[]
  /** WebKit reports of Next.js prefetches a document navigation cut off (ignored; see below). */
  interruptedFetches: string[]
  /** Page requests to the unversioned (legacy) API routes; the UI must use /qqq/v1 only (QRun-IO/qqq#699). */
  legacyRequests: string[]
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
    const diagnostics: Diagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [], cspViolations: [], interruptedFetches: [], legacyRequests: [], allow: (pattern) => { allowed.push(pattern) } }
    // The dashboard is served with a strict Content-Security-Policy (QRun-IO/qqq#695). Browsers
    // report a blocked script, style, connection, frame or image as a `securitypolicyviolation`
    // event (console messages for these differ per engine), so every frame forwards the events.
    await page.exposeBinding('__qqqReportCspViolation', (_source, violation: Record<string, string | number>) => {
      const sample = violation.sample ? ` "${String(violation.sample).slice(0, 80)}"` : ''
      diagnostics.cspViolations.push(`${violation.directive} ${violation.blockedURI || '(inline)'} at ${violation.sourceFile || violation.documentURI}:${violation.lineNumber}${sample}`)
    })
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        const report = (window as unknown as { __qqqReportCspViolation?: (violation: Record<string, string | number>) => void }).__qqqReportCspViolation
        void report?.({
          directive: event.effectiveDirective || event.violatedDirective,
          blockedURI: event.blockedURI,
          sourceFile: event.sourceFile,
          documentURI: event.documentURI,
          lineNumber: event.lineNumber,
          sample: event.sample,
        })
      }, true)
    })
    // WebKit reports a Next.js prefetch or RSC payload fetch that a document navigation cuts off
    // as "<url> due to access control checks." although the server answers 200 - the equivalent
    // of Chromium's ERR_ABORTED (WebKit cancels these before Playwright sees a request). After the
    // test, such a report is ignored only when it names a Next.js route or payload URL on the
    // origin of a document the page navigated to (the UI, or an area's own server such as the
    // security fixture's) and arrives within a second of a main-frame navigation. Any other
    // access-control failure - an API call, a cross-origin (CORS) error, or one unrelated to a
    // navigation - still fails the test.
    const documentHosts = new Set<string>()
    const navigations: number[] = []
    // The UI runs on the v1 API only (QRun-IO/qqq#699): any page request to an unversioned API
    // route of a QQQ server fails the test (Node-side backend.api calls are not page requests).
    const legacyRoute = /^\/(data|processes|widget|possibleValues|download|reports|metaData|manageSession|logout)(\/|$)/
    // the sample and the security area's own QQQ server (specs/security/support/variant.ts)
    const securityPort = Number(process.env.QQQ_ACCEPTANCE_SECURITY_BACKEND_PORT ?? ACCEPTANCE_BACKEND_PORT + 10)
    const qqqHosts = new Set([ACCEPTANCE_UI_URL, ACCEPTANCE_BACKEND_URL, `http://127.0.0.1:${securityPort}`].map((url) => new URL(url).host))
    page.on('request', (request) => {
      const url = new URL(request.url())
      // QQQ servers only: an identity provider's own /logout is not a QQQ route
      if (qqqHosts.has(url.host) && legacyRoute.test(url.pathname)) diagnostics.legacyRequests.push(`${request.method()} ${url.pathname}`)
    })
    page.on('request', (request) => {
      if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return
      navigations.push(performance.now())
      documentHosts.add(new URL(request.url()).host)
    })
    const accessControl = /^(?:.*?\bload )?\/*(\S+) due to access control checks\.?$/
    const nextRouteFetch = (target: string) => {
      const url = new URL(`http://${target.replace(/^https?:\/+/, '')}`)
      return documentHosts.has(url.host) && (/\/__next\.|\/index\.txt$/.test(url.pathname) || url.searchParams.has('_rsc') || url.pathname.endsWith('/'))
    }
    const reports: { text: string; at: number; push: () => void }[] = []
    const report = (text: string, push: () => void) => {
      const target = accessControl.exec(text.trim())?.[1]
      if (target && nextRouteFetch(target)) reports.push({ text, at: performance.now(), push })
      else push()
    }
    // Firefox logs "Image corrupt or truncated." for an intact image whose decode a navigation cut
    // off (logging out while the logo decodes, for example). After the test, such a report is ignored
    // only when the same browser, on the page's origin, decodes that image in full; an image that is
    // really corrupt or truncated, or one that cannot be checked, still fails the test.
    const truncatedImage = /^\[JavaScript Error: "Image corrupt or truncated\." \{file: "([^"]+)"/
    const truncatedImages: { text: string; url: string }[] = []
    page.on('pageerror', (error) => report(error.message, () => diagnostics.pageErrors.push(error.message)))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const image = truncatedImage.exec(message.text())?.[1]
      if (image) truncatedImages.push({ text: message.text(), url: image })
      else report(message.text(), () => diagnostics.consoleErrors.push(message.text()))
    })
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText ?? ''
      // Navigation-cancelled background reads are not application failures.
      if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(failure)) return
      const text = `${request.method()} ${request.url()} ${failure}`
      if (/access control checks/i.test(failure) && nextRouteFetch(request.url())) reports.push({ text, at: performance.now(), push: () => diagnostics.failedRequests.push(text) })
      else diagnostics.failedRequests.push(text)
    })
    const classifyAccessControlReports = () => {
      for (const { text, at, push } of reports) {
        if (navigations.some((navigation) => Math.abs(navigation - at) < 1000)) diagnostics.interruptedFetches.push(text)
        else push()
      }
    }
    page.on('response', (response: Response) => {
      if (response.status() >= 400) diagnostics.failedRequests.push(`${response.request().method()} ${new URL(response.url()).pathname} ${response.status()}`)
    })
    await use(diagnostics)
    // One round trip delivers violation reports still queued in the page.
    if (!page.isClosed()) await page.evaluate(() => 0).catch(() => undefined)
    classifyAccessControlReports()
    for (const { text, url } of truncatedImages) {
      const decodes = !page.isClosed() && new URL(url).origin === new URL(page.url()).origin && await page.evaluate((src) => new Promise<boolean>((resolve) => {
        const image = new Image()
        image.onload = () => { void image.decode().then(() => resolve(image.naturalWidth > 0), () => resolve(false)) }
        image.onerror = () => resolve(false)
        image.src = src
      }), url).catch(() => false)
      if (decodes) diagnostics.interruptedFetches.push(text)
      else diagnostics.consoleErrors.push(text)
    }
    const unexpected = [
      ...diagnostics.pageErrors.map((text) => `pageerror: ${text}`),
      ...diagnostics.consoleErrors.map((text) => `console: ${text}`),
      ...diagnostics.failedRequests.map((text) => `request: ${text}`),
      ...diagnostics.cspViolations.map((text) => `csp: ${text}`),
    ].filter((text) => !matches(text)).concat(
      // not subject to allow(): a negative scenario may expect a failure, never a legacy route
      diagnostics.legacyRequests.map((text) => `legacy API route: ${text}`))
    await testInfo.attach('diagnostics.json', { body: JSON.stringify(diagnostics, null, 2), contentType: 'application/json' })
    expect(unexpected, 'unexplained console errors, failed application requests, Content-Security-Policy violations or legacy API routes').toEqual([])
  },
})

export { expect }

/** Opens a route with the persona session and diagnostics attached. */
export async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
}
