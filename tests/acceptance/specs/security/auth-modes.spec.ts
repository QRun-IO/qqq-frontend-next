/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// The remaining authentication types on the sample, each on its own backend variant:
// AUTH_0 against an owned Auth0-compatible provider, FULLY_ANONYMOUS, and TABLE_BASED
// (unsupported by the admin dashboards, which must say so).
import type { Page } from '@playwright/test'
import { expect, open, test as acceptanceTest } from '../../support/fixtures'
import { startFakeOidc, type FakeOidcProvider } from '../../support/fake-oidc'
import { IDP_PORT, resetVariant, SECURITY_URL, startVariant, stopVariant, variantSql } from './support/variant'
import { navigation, openUserMenu, recordRequests } from './support/ui'

const personGrid = (page: Page) => page.getByRole('grid', { name: 'Person records' })

const AUTH0_CLIENT = 'qqq-auth0-spa'
const AUDIENCE = 'https://qqq.acceptance/api'
const AUTH0_VARIANT = {
  properties: {
    'qqq.security.auth0.baseUrl': `http://127.0.0.1:${IDP_PORT}`,
    'qqq.security.auth0.clientId': AUTH0_CLIENT,
    'qqq.security.auth0.clientSecret': 'unused-by-spa-flow',
    'qqq.security.auth0.audience': AUDIENCE,
  },
}

const auth0Test = acceptanceTest.extend<{ auth0: FakeOidcProvider }, { auth0Provider: FakeOidcProvider }>({
  auth0Provider: [async ({}, use) => {
    const provider = await startFakeOidc({ port: IDP_PORT, clientId: AUTH0_CLIENT, clientSecret: 'unused-by-spa-flow', audience: AUDIENCE, allowedRedirectPrefix: `${SECURITY_URL}/` })
    await use(provider)
    await stopVariant()
    await provider.close()
  }, { scope: 'worker' }],
  baseURL: async ({}, use) => { await use(SECURITY_URL) },
  auth0: async ({ auth0Provider }, use) => {
    await startVariant('AUTH_0', AUTH0_VARIANT)
    await resetVariant()
    auth0Provider.reset()
    await use(auth0Provider)
  },
})

auth0Test.describe('AUTH_0 (owned Auth0-compatible provider)', () => {
  auth0Test('[SEC-029] sign-in exchanges the code in the browser, the backend verifies the token, and logout ends the provider session', async ({ page, auth0, diagnostics, context }) => {
    void diagnostics
    await open(page, '/app/person')
    await expect(page.getByRole('heading', { name: 'QRun Test Identity Provider' })).toBeVisible()
    const authorize = auth0.requests.find((request) => request.path === '/authorize')
    expect(authorize?.query).toMatchObject({ client_id: AUTH0_CLIENT, audience: AUDIENCE, code_challenge_method: 'S256', redirect_uri: `${SECURITY_URL}/token` })
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(personGrid(page).getByRole('gridcell', { name: 'Avery', exact: true })).toBeVisible()

    // a public SPA client: the browser redeems the code with its PKCE verifier, no secret
    const [token] = auth0.requests.filter((request) => request.path === '/oauth/token')
    expect(token.authorization).toBeUndefined()
    expect(token.form).toMatchObject({ grant_type: 'authorization_code', client_id: AUTH0_CLIENT, redirect_uri: `${SECURITY_URL}/token` })
    expect(token.form.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    // the backend fetched the provider keys to verify the access token
    expect(auth0.requests.some((request) => request.path === '/.well-known/jwks.json')).toBe(true)
    expect(Number((await variantSql('select count(*) as n from user_session'))[0].n)).toBe(1)
    const nav = await navigation(page)
    await expect(nav.locator('[data-qqq-id="sidebar-user-name"]')).toHaveText('Dana Owner (OIDC)')

    await page.reload()
    await expect(personGrid(page).getByRole('gridcell', { name: 'Avery', exact: true })).toBeVisible()
    await expect((await navigation(page)).locator('[data-qqq-id="sidebar-user-name"]')).toHaveText('Dana Owner (OIDC)')

    const menu = await openUserMenu(page)
    await menu.getByRole('menuitem', { name: 'Log Out' }).click()
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
    expect(auth0.requests.some((request) => request.path === '/v2/logout' && request.query.client_id === AUTH0_CLIENT && request.query.returnTo === `${SECURITY_URL}/login`)).toBe(true)
    expect(auth0.activeSessions()).toBe(0)
    expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain('sessionUUID')
    await open(page, '/app/person')
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
  })

  auth0Test('[SEC-033] an Auth0 session ended by logout cannot be replayed', async ({ page, auth0, diagnostics, context, playwright }) => {
    void diagnostics
    void auth0
    await open(page, '/app/person')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(personGrid(page).getByRole('gridcell', { name: 'Avery', exact: true })).toBeVisible()
    const sessionUUID = (await context.cookies()).find((cookie) => cookie.name === 'sessionUUID')?.value
    expect(sessionUUID).toBeTruthy()
    const menu = await openUserMenu(page)
    await menu.getByRole('menuitem', { name: 'Log Out' }).click()
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
    expect(await variantSql(`select count(*) as n from user_session where uuid = '${sessionUUID}'`)).toEqual([{ n: '0' }])
    const replay = await playwright.request.newContext({ baseURL: SECURITY_URL, extraHTTPHeaders: { Cookie: `sessionUUID=${sessionUUID}` } })
    expect((await replay.post('/qqq/v1/table/person/count', { data: {} })).status()).toBe(401)
    await replay.dispose()
  })

  auth0Test('[SEC-029] a provider denial is reported and nothing is exchanged', async ({ page, auth0, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person')
    await page.getByRole('button', { name: 'Deny' }).click()
    await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in was denied by the identity provider.')
    expect(auth0.requests.filter((request) => request.path === '/oauth/token')).toEqual([])
    expect(Number((await variantSql('select count(*) as n from user_session'))[0].n)).toBe(0)
  })
})

const anonymousTest = acceptanceTest.extend<{ anonymous: void }>({
  baseURL: async ({}, use) => { await use(SECURITY_URL) },
  anonymous: async ({}, use) => {
    await startVariant('FULLY_ANONYMOUS')
    await resetVariant()
    await use()
  },
})

anonymousTest('[SEC-031] FULLY_ANONYMOUS loads data as Anonymous, and after logout stays signed out until Sign in', async ({ page, anonymous, diagnostics }) => {
  void anonymous
  void diagnostics
  await open(page, '/app/person')
  await expect(personGrid(page).getByRole('gridcell', { name: 'Avery', exact: true })).toBeVisible()
  await expect((await navigation(page)).locator('[data-qqq-id="sidebar-user-name"]')).toHaveText('Anonymous')
  const menu = await openUserMenu(page)
  await menu.getByRole('menuitem', { name: 'Log Out' }).click()
  await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
  await open(page, '/app/person')
  await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(personGrid(page).getByRole('gridcell', { name: 'Avery', exact: true })).toBeVisible()
})

const tableBasedTest = acceptanceTest.extend<{ tableBased: void }>({
  baseURL: async ({}, use) => { await use(SECURITY_URL) },
  tableBased: async ({}, use) => {
    await startVariant('TABLE_BASED')
    await use()
  },
})

tableBasedTest('[SEC-032] an unsupported authentication type is reported and nothing else is attempted', async ({ page, tableBased, diagnostics }) => {
  void tableBased
  void diagnostics
  const reads = recordRequests(page)
  const sessionCalls: string[] = []
  page.on('request', (request) => { if (/manageSession/.test(request.url())) sessionCalls.push(request.url()) })
  await open(page, '/app/person')
  await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in failed: Unsupported authentication type: TABLE_BASED')
  expect(reads).toEqual([])
  expect(sessionCalls).toEqual([])
})
