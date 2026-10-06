/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, open, test as acceptanceTest } from '../../support/fixtures'
import { allowBlockedByPolicy, parsePolicy } from './support/csp'
import { listCell } from './support/ui'
import { resetVariant, SECURITY_UI_URL, startVariant, stopVariant } from './support/variant'

interface OwnedAnalytics {
  origin: string
  deniedOrigin: string
  counts: { scripts: number; initialize: number; record: number; denied: number }
  close: () => Promise<void>
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

async function ownedAnalytics(): Promise<OwnedAnalytics> {
  const counts = { scripts: 0, initialize: 0, record: 0, denied: 0 }
  const cors = { 'Access-Control-Allow-Origin': SECURITY_UI_URL }
  const denied = createServer((request, response) => {
    counts.denied++
    request.resume()
    response.writeHead(200, cors)
    response.end('owned endpoint')
  })
  const deniedOrigin = await listen(denied)
  let origin = ''
  const allowed = createServer((request, response) => {
    request.resume()
    if (request.url === '/owned-plugin.js') {
      counts.scripts++
      response.writeHead(200, { ...cors, 'Content-Type': 'text/javascript' })
      // The normal application hook loads this plugin, then creates this registered provider.
      // Fixed aliases only: no user, record, URL, event or session payload is transmitted.
      response.end(`window.QQQAnalytics.register('posthog', () => ({
        initialize() {
          fetch(${JSON.stringify(origin)} + '/collect/initialize', { method: 'POST', body: 'initialize' });
          fetch(${JSON.stringify(deniedOrigin)} + '/collect', { method: 'POST', body: 'blocked-control' }).catch(() => {});
        },
        record() { fetch(${JSON.stringify(origin)} + '/collect/record', { method: 'POST', body: 'record' }); },
        reset() {}
      }));`)
    } else if (request.method === 'POST' && request.url === '/collect/initialize') {
      counts.initialize++
      response.writeHead(200, cors)
      response.end('ok')
    } else if (request.method === 'POST' && request.url === '/collect/record') {
      counts.record++
      response.writeHead(200, cors)
      response.end('ok')
    } else {
      response.writeHead(404, cors)
      response.end()
    }
  })
  origin = await listen(allowed)
  return {
    origin, deniedOrigin, counts,
    close: async () => {
      await Promise.all([allowed, denied].map((server) => new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
        // The browser can still own preconnected or incomplete HTTP sockets during teardown.
        server.closeAllConnections()
      })))
    },
  }
}

const test = acceptanceTest.extend<{ analytics: OwnedAnalytics }>({
  baseURL: async ({}, provide) => { await provide(SECURITY_UI_URL) },
  analytics: async ({}, provide) => {
    const service = await ownedAnalytics()
    try {
      await startVariant('FULLY_ANONYMOUS', { properties: { 'qqq.security.analytics.origin': service.origin } })
      await resetVariant()
      await provide(service)
    } finally {
      try { await stopVariant() } finally { await service.close() }
    }
  },
})

test('[SEC-040] metadata-configured analytics loads through the application hook and cannot contact an unconfigured origin @mobile', async ({ page, analytics, diagnostics }, testInfo) => {
  let policy: Record<string, string[]> = {}
  try {
    policy = parsePolicy((await page.request.get('/login')).headers()['content-security-policy'])
    expect(policy['connect-src']).toEqual(["'self'", analytics.origin])
    expect(policy['script-src'].filter((source) => !source.startsWith("'sha256-"))).toEqual(["'self'", analytics.origin])
    allowBlockedByPolicy(diagnostics, analytics.deniedOrigin)

    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await expect.poll(() => analytics.counts.initialize).toBe(1)
    await expect.poll(() => analytics.counts.record).toBeGreaterThan(0)
    expect(analytics.counts.scripts).toBe(1)
    await expect.poll(() => diagnostics.cspViolations.some((entry) => entry === `connect-src ${analytics.deniedOrigin}` || entry.startsWith(`connect-src ${analytics.deniedOrigin}/`))).toBe(true)
    expect(analytics.counts.denied).toBe(0)
    expect(diagnostics.cspViolations.every((entry) => entry === `connect-src ${analytics.deniedOrigin}` || entry.startsWith(`connect-src ${analytics.deniedOrigin}/`))).toBe(true)
  } finally {
    await testInfo.attach('owned-analytics-csp', {
      body: JSON.stringify({
        counts: { ...analytics.counts },
        configuredOrigin: analytics.origin,
        deniedOrigin: analytics.deniedOrigin,
        policy,
      }),
      contentType: 'application/json',
    })
  }
})
