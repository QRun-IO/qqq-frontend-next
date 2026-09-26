/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// OAUTH2 (authorization code + PKCE) end to end: the Next export served by the sample
// with its own OAuth2 authentication module, against an owned local OIDC provider.
import type { Page } from '@playwright/test'
import { expect, open, test as acceptanceTest } from '../../support/fixtures'
import { startFakeOidc, type FakeOidcProvider } from '../../support/fake-oidc'
import { IDP_PORT, resetVariant, SECURITY_URL, startVariant, stopVariant, variantSql } from './support/variant'
import { listCell, navigation, openUserMenu } from './support/ui'
import { allowBlockedByPolicy, parsePolicy } from './support/csp'

const CLIENT_ID = 'qqq-acceptance'
const CLIENT_SECRET = 'acceptance-secret'
const VARIANT = {
  env: { OAUTH2_BASE_URL: `http://127.0.0.1:${IDP_PORT}`, OAUTH2_CLIENT_ID: CLIENT_ID, OAUTH2_CLIENT_SECRET: CLIENT_SECRET, OAUTH2_SCOPES: 'openid profile email' },
}

const test = acceptanceTest.extend<{ idp: FakeOidcProvider }, { oauthProvider: FakeOidcProvider }>({
  oauthProvider: [async ({}, use) => {
    const provider = await startFakeOidc({ port: IDP_PORT, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, allowedRedirectPrefix: `${SECURITY_URL}/` })
    await use(provider)
    await stopVariant()
    await provider.close()
  }, { scope: 'worker' }],
  baseURL: async ({}, use) => { await use(SECURITY_URL) },
  idp: async ({ oauthProvider }, use) => {
    await startVariant('OAUTH2', VARIANT)
    await resetVariant()
    oauthProvider.reset()
    await use(oauthProvider)
  },
})

const sessions = async () => Number((await variantSql('select count(*) as n from user_session'))[0].n)
const personGrid = (page: Page) => page.getByRole('grid', { name: 'Person records' })
const authorizeRequests = (idp: FakeOidcProvider) => idp.requests.filter((request) => request.path === '/authorize')

async function signInAtProvider(page: Page, account = 'Dana Owner (OIDC)') {
  await expect(page.getByRole('heading', { name: 'QRun Test Identity Provider' })).toBeVisible()
  await page.getByLabel('Account').selectOption({ label: account })
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.describe('OAUTH2 with PKCE', () => {
  test('[SEC-025] sign-in goes through the provider with PKCE, creates a backend session and survives reload', async ({ page, idp, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person')
    await expect(page).toHaveURL(new RegExp(`^${idp.issuer}/authorize\\?`))
    const [authorize] = authorizeRequests(idp)
    expect(authorize.query).toMatchObject({
      response_type: 'code', client_id: CLIENT_ID, redirect_uri: `${SECURITY_URL}/token`,
      code_challenge_method: 'S256', scope: 'openid profile email',
    })
    expect(authorize.query.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(authorize.query.state).toMatch(/^[A-Za-z0-9_-]{16,}$/)
    expect(idp.requests.some((request) => request.path === '/.well-known/openid-configuration')).toBe(true)

    await signInAtProvider(page)
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()

    // the backend (not the browser) redeemed the code, with its secret and the PKCE verifier
    const token = idp.requests.filter((request) => request.path === '/oauth/token')
    expect(token).toHaveLength(1)
    expect(token[0].authorization).toBe(`Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`)
    expect(token[0].form).toMatchObject({ grant_type: 'authorization_code', redirect_uri: `${SECURITY_URL}/token` })
    expect(token[0].form.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await variantSql('select user_id from user_session')).toEqual([{ user_id: 'oidc|dana' }])

    const nav = await navigation(page)
    await expect(nav.locator('[data-qqq-id="sidebar-user-name"]')).toHaveText('Dana Owner (OIDC)')
    await expect(nav.locator('[data-qqq-id="sidebar-user-email"]')).toHaveText('dana@qrun.example')

    await page.reload()
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    expect(authorizeRequests(idp)).toHaveLength(1)
    expect(await sessions()).toBe(1)
  })

  test('[SEC-026] a provider denial is reported and creates no session', async ({ page, idp, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person')
    await expect(page.getByRole('heading', { name: 'QRun Test Identity Provider' })).toBeVisible()
    await page.getByRole('button', { name: 'Deny' }).click()
    await expect(page).toHaveURL(/\/login\/?\?error=access_denied/)
    await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in was denied by the identity provider.')
    expect(idp.requests.filter((request) => request.path === '/oauth/token')).toEqual([])
    expect(await sessions()).toBe(0)

    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { name: 'QRun Test Identity Provider' })).toBeVisible()
  })

  test('[SEC-026] a callback with a forged state is rejected before any token exchange', async ({ page, idp, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person')
    await expect(page.getByRole('heading', { name: 'QRun Test Identity Provider' })).toBeVisible()
    await open(page, '/token?code=stolen-code&state=forged-state')
    await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in could not be completed.')
    expect(idp.requests.filter((request) => request.path === '/oauth/token')).toEqual([])
    expect(await sessions()).toBe(0)
  })

  test('[SEC-026] a rejected code exchange is reported and creates no session', async ({ page, idp, diagnostics }) => {
    diagnostics.allow('/manageSession 401')
    diagnostics.allow('status of 401')
    idp.failNextTokenExchange()
    await open(page, '/app/person')
    await signInAtProvider(page)
    await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in could not be completed.')
    expect(idp.requests.filter((request) => request.path === '/oauth/token')).toHaveLength(1)
    expect(await sessions()).toBe(0)
    await expect(page.getByRole('grid')).toHaveCount(0)
  })

  test('[SEC-027] logout deletes the backend session, ends the provider session and requires a new provider sign-in', async ({ page, idp, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person')
    await signInAtProvider(page)
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    expect(await sessions()).toBe(1)
    expect(idp.activeSessions()).toBe(1)

    const menu = await openUserMenu(page)
    const backendLogout = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/logout')
    await menu.getByRole('menuitem', { name: 'Log Out' }).click()
    expect((await backendLogout).status()).toBe(200)
    await expect(page).toHaveURL(/\/login\/?$/)
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
    await expect.poll(() => idp.requests.some((request) => request.path === '/logout' && request.query.post_logout_redirect_uri === `${SECURITY_URL}/login`)).toBe(true)
    expect(await sessions()).toBe(0)
    await expect.poll(() => idp.activeSessions()).toBe(0)

    await open(page, '/app/person')
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
    await page.getByRole('button', { name: 'Sign in' }).click()
    // no provider session any more: the provider asks for the account again
    await signInAtProvider(page, 'Eli Reader (OIDC)')
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    expect(await variantSql('select user_id from user_session')).toEqual([{ user_id: 'oidc|eli' }])
  })

  test('[SEC-028] a session revoked on the server sends the user through the provider and back to the page', async ({ page, idp, diagnostics, context, playwright }) => {
    diagnostics.allow(/ 401$/)
    diagnostics.allow('status of 401')
    await open(page, '/app/person')
    await signInAtProvider(page)
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()

    // another tab or an administrator ends this session on the server
    const sessionUUID = (await context.cookies()).find((cookie) => cookie.name === 'sessionUUID')?.value
    expect(sessionUUID).toBeTruthy()
    const outside = await playwright.request.newContext({ baseURL: SECURITY_URL, extraHTTPHeaders: { Cookie: `sessionUUID=${sessionUUID}` } })
    expect((await outside.post('/qqq/v1/logout')).status()).toBe(200)
    await outside.dispose()
    expect(await sessions()).toBe(0)

    await listCell(page, 'Person', 'Blair').click()
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
    expect(authorizeRequests(idp)).toHaveLength(2)
    expect(await sessions()).toBe(1)
  })

  test('[SEC-033] v1 logout expires every session cookie the server issued', async ({ page, idp, diagnostics, context, playwright }) => {
    void diagnostics
    void idp
    await open(page, '/app/person')
    await signInAtProvider(page)
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    const cookies = (await context.cookies()).filter((cookie) => ['sessionUUID', 'sessionId'].includes(cookie.name))
    expect(cookies.map((cookie) => cookie.name).sort()).toEqual(['sessionId', 'sessionUUID'])
    const client = await playwright.request.newContext({ baseURL: SECURITY_URL, extraHTTPHeaders: { Cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ') } })
    const logout = await client.post('/qqq/v1/logout')
    expect(logout.status()).toBe(200)
    const setCookies = logout.headersArray().filter((header) => header.name.toLowerCase() === 'set-cookie').map((header) => header.value)
    await client.dispose()
    for (const name of ['sessionUUID', 'sessionId']) {
      expect(setCookies.some((cookie) => cookie.startsWith(`${name}=;`) && /Max-Age=0|Expires=Thu, 01[- ]Jan[- ]1970/i.test(cookie)), `${name} expired by the server`).toBe(true)
    }
  })

  test('[SEC-041] the login page shows known sign-in errors and never text from the link @mobile', async ({ page, idp, diagnostics }) => {
    void diagnostics
    const spoof = 'Your account is locked. Call 555-0100 to unlock it'
    await open(page, `/login?error=${encodeURIComponent(spoof)}`)
    await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in failed.')
    await expect(page.getByText('555-0100')).toHaveCount(0)
    await open(page, '/login?error=access_denied')
    await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in was denied by the identity provider.')
    await open(page, '/login?error=invalid_scope')
    await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in failed (invalid_scope).')
    expect(authorizeRequests(idp)).toHaveLength(0)
    // Try again still goes through the provider
    await page.getByRole('button', { name: 'Try again' }).click()
    await signInAtProvider(page)
    await expect(page).toHaveURL(/\/app\/?$/)
    expect(authorizeRequests(idp)).toHaveLength(1)
  })

  test('[SEC-039] the policy lets the dashboard call the configured provider and no other origin @mobile', async ({ page, idp, diagnostics }) => {
    const policy = parsePolicy((await page.request.get('/login')).headers()['content-security-policy'])
    expect(policy['connect-src']).toEqual(["'self'", idp.issuer])
    expect(policy['frame-ancestors']).toEqual(["'none'"])

    // discovery from the browser, the provider round trip and the callback run under the policy
    await open(page, '/app/person')
    await expect(page).toHaveURL(new RegExp(`^${idp.issuer}/authorize\\?`))
    await signInAtProvider(page)
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    expect(idp.requests.some((request) => request.path === '/.well-known/openid-configuration')).toBe(true)
    expect(diagnostics.cspViolations).toEqual([])

    // any other origin is refused by the browser before a request is made
    const elsewhere = 'http://127.0.0.1:8/collect'
    allowBlockedByPolicy(diagnostics, elsewhere)
    const outcome = await page.evaluate(async (url) => {
      try {
        await fetch(url, { method: 'POST', body: 'stolen' })
        return 'sent'
      } catch {
        return 'refused'
      }
    }, elsewhere)
    expect(outcome).toBe('refused')
    await expect.poll(() => diagnostics.cspViolations.join('\n')).toMatch(new RegExp(`^connect-src ${elsewhere.replace(/[.:/]/g, '\\$&')}`, 'm'))
  })
})
