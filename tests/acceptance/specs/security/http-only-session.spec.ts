/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// HttpOnly session cookies (QRun-IO/qqq#733): the backend sets sessionUUID and sessionId
// HttpOnly and resumes a session from the cookie when POST /qqq/v1/manageSession names no
// credentials; the UI never reads or writes the cookies. Script in the page cannot read the
// session token, and sign-in, reload resume, expiry and logout keep working.
import type { BrowserContext, Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { startFakeOidc, type FakeOidcProvider } from '../../support/fake-oidc'
import { ACCEPTANCE_UI_URL } from '../../support/ports'
import { expireTableSessions, IDP_PORT, resetVariant, SECURITY_URL, startVariant, stopVariant, variantSql } from './support/variant'
import { listCell, navigation, openUserMenu } from './support/ui'

const SESSION_COOKIES = ['sessionId', 'sessionUUID']
const TESS = { username: 'tess.table', password: 'table:pass-2026', name: 'Tess Table (table-based)' }
const RAVI = { username: 'ravi.rows', password: 'rows-pass-2026', name: 'Ravi Rows (table-based)' }

/**
 * Asserts the browser holds both session cookies for this session, HttpOnly, and that
 * script in the page cannot see them.
 *
 * @param page - The page.
 * @param context - The browser context.
 * @param sessionId - The session both cookies must name.
 */
async function expectHttpOnlySession(page: Page, context: BrowserContext, sessionId: string) {
  const jar = (await context.cookies()).filter((cookie) => SESSION_COOKIES.includes(cookie.name))
  expect(jar.map((cookie) => cookie.name).sort()).toEqual(SESSION_COOKIES)
  for (const cookie of jar) {
    expect(cookie.httpOnly, `${cookie.name} is HttpOnly`).toBe(true)
    expect(cookie.value, `${cookie.name} names the current session`).toBe(sessionId)
  }
  expect(await page.evaluate(() => document.cookie)).not.toMatch(/(^|;\s*)session(UUID|Id)=/)
}

/**
 * Reloads the page and returns the session resume request it made.
 *
 * @param page - The page.
 * @returns The request body and the response JSON.
 */
async function reloadAndCaptureResume(page: Page): Promise<{ body: string | null; status: number; json: Record<string, unknown>; text: string }> {
  const resume = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/manageSession')
  await page.reload()
  const response = await resume
  const text = await response.text()
  return { body: response.request().postData(), status: response.status(), json: JSON.parse(text) as Record<string, unknown>, text }
}

/**
 * Signs out through the user menu and waits for the signed-out page.
 *
 * @param page - The page.
 * @returns The status of the backend logout.
 */
async function logOut(page: Page): Promise<number> {
  const menu = await openUserMenu(page)
  const logout = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/logout')
  await menu.getByRole('menuitem', { name: 'Log Out' }).click()
  const status = (await logout).status()
  await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
  return status
}

test('[SEC-048] script in the page can neither read the session cookies nor obtain the session token @mobile', async ({ page, backend, diagnostics, context }) => {
  void diagnostics
  await open(page, '/app/person')
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  const jar = (await context.cookies(ACCEPTANCE_UI_URL)).filter((cookie) => SESSION_COOKIES.includes(cookie.name))
  expect(jar.map((cookie) => cookie.name).sort()).toEqual(SESSION_COOKIES)
  for (const cookie of jar) expect(cookie.httpOnly, `${cookie.name} is HttpOnly`).toBe(true)
  expect(jar.find((cookie) => cookie.name === 'sessionId')?.value).toBe(backend.sessionId)

  // what injected script could try: read the cookies, or have the backend resume the session for it
  const probe = await page.evaluate(async () => {
    const response = await fetch('/qqq/v1/manageSession', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    return { cookie: document.cookie, status: response.status, body: await response.text() }
  })
  expect(probe.cookie).not.toMatch(/(^|;\s*)session(UUID|Id)=/)
  expect(probe.status).toBe(200)
  expect(JSON.parse(probe.body)).not.toHaveProperty('uuid')
  for (const cookie of jar) expect(probe.body).not.toContain(cookie.value)
})

const tableTest = test.extend<{ tableBased: void }>({
  baseURL: async ({}, use) => { await use(SECURITY_URL) },
  tableBased: async ({}, use) => {
    await startVariant('TABLE_BASED')
    await resetVariant()
    await use()
  },
})

/**
 * Fills and submits the TABLE_BASED login form.
 *
 * @param page - The page.
 * @param user - Username and password.
 * @param user.username - The username.
 * @param user.password - The password.
 */
async function submitCredentials(page: Page, user: { username: string; password: string }) {
  await page.getByLabel('Username', { exact: true }).fill(user.username)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

/** TABLE_BASED session rows with their user, oldest first. */
async function tableSessions() {
  return variantSql('select s.id as id, u.username as username from table_auth_session s join table_auth_user u on u.id = s.user_id order by s.create_date, s.id')
}

tableTest('[SEC-048] [SEC-049] TABLE_BASED sign-in, reload resume, idle expiry and logout work with HttpOnly session cookies @mobile', async ({ page, tableBased, diagnostics, context }) => {
  void tableBased
  // the idle-expired session's requests are refused
  diagnostics.allow(/ 401$/)
  diagnostics.allow('status of 401')
  const sessionRequests: (string | null)[] = []
  page.on('request', (request) => { if (new URL(request.url()).pathname === '/qqq/v1/manageSession') sessionRequests.push(request.postData()) })

  // a first visit has nothing to resume: the form, and no session request
  await open(page, '/app/person')
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  expect(sessionRequests).toEqual([])
  await submitCredentials(page, TESS)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  const [first] = await tableSessions()
  if (!first?.id) throw new Error('Expected a session after sign-in')
  await expectHttpOnlySession(page, context, first.id)

  // a reload resumes through an empty manageSession, which answers without the token
  const resumed = await reloadAndCaptureResume(page)
  expect(resumed.body).toBe('{}')
  expect(resumed.status).toBe(200)
  expect(resumed.json).not.toHaveProperty('uuid')
  expect(resumed.text).not.toContain(first.id)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  await expect((await navigation(page)).locator('[data-qqq-id="sidebar-user-name"]')).toHaveText(TESS.name)
  expect((await tableSessions()).map((row) => row.id)).toEqual([first.id])

  // idle expiry: the next request is refused, the form asks again without trying to resume
  expect(await expireTableSessions()).toBe(1)
  sessionRequests.length = 0
  const loginVisit = page.waitForURL(/\/login\/?\?returnTo=%2Fapp%2Fperson%2F2/)
  await listCell(page, 'Person', 'Blair').click()
  await loginVisit
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  expect(sessionRequests).toEqual([])
  await submitCredentials(page, TESS)
  await expect(page).toHaveURL(/\/app\/person\/2\/?$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
  const second = (await tableSessions()).find((row) => row.id !== first.id)
  expect(second?.username).toBe(TESS.username)
  if (!second?.id) throw new Error('Expected a new session after expiry')
  await expectHttpOnlySession(page, context, second.id)

  // logout: the server ends the session and expires both cookies
  expect(await logOut(page)).toBe(200)
  expect((await context.cookies()).filter((cookie) => SESSION_COOKIES.includes(cookie.name))).toEqual([])
  expect((await tableSessions()).map((row) => row.id)).toEqual([first.id])
  sessionRequests.length = 0
  await open(page, '/app/person')
  await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
  expect(sessionRequests).toEqual([])
})

tableTest('[SEC-049] a sign-in after a logout that never reached the server uses only the new session @mobile', async ({ page, tableBased, diagnostics, context }) => {
  void tableBased
  diagnostics.allow('/qqq/v1/logout 503')
  diagnostics.allow('status of 503')
  await open(page, '/app/person')
  await submitCredentials(page, TESS)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  const [tess] = await tableSessions()

  // the logout request fails: the tab signs out, but the server never ended Tess's session,
  // and the page cannot clear the HttpOnly cookies itself
  await page.route('**/qqq/v1/logout', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Service unavailable"}' }))
  expect(await logOut(page)).toBe(503)
  await page.unroute('**/qqq/v1/logout')
  expect((await context.cookies()).filter((cookie) => SESSION_COOKIES.includes(cookie.name)).map((cookie) => cookie.value)).toEqual([tess.id, tess.id])

  // the next user's sign-in points both cookies at the new session
  await submitCredentials(page, RAVI)
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  await expect((await navigation(page)).locator('[data-qqq-id="sidebar-user-name"]')).toHaveText(RAVI.name)
  const ravi = (await tableSessions()).find((row) => row.username === RAVI.username)
  expect(ravi).toBeTruthy()
  if (!ravi?.id) throw new Error('Expected a session for the next user')
  await expectHttpOnlySession(page, context, ravi.id)
  await page.reload()
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  await expect((await navigation(page)).locator('[data-qqq-id="sidebar-user-name"]')).toHaveText(RAVI.name)
})

const CLIENT_ID = 'qqq-acceptance'
const CLIENT_SECRET = 'acceptance-secret'
const OAUTH2_VARIANT = {
  env: { OAUTH2_BASE_URL: `http://127.0.0.1:${IDP_PORT}`, OAUTH2_CLIENT_ID: CLIENT_ID, OAUTH2_CLIENT_SECRET: CLIENT_SECRET, OAUTH2_SCOPES: 'openid profile email' },
}

const oauthTest = test.extend<{ idp: FakeOidcProvider }, { httpOnlyOauthProvider: FakeOidcProvider }>({
  httpOnlyOauthProvider: [async ({}, use) => {
    const provider = await startFakeOidc({ port: IDP_PORT, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, allowedRedirectPrefix: `${SECURITY_URL}/` })
    await use(provider)
    await stopVariant()
    await provider.close()
  }, { scope: 'worker' }],
  baseURL: async ({}, use) => { await use(SECURITY_URL) },
  idp: async ({ httpOnlyOauthProvider }, use) => {
    await startVariant('OAUTH2', OAUTH2_VARIANT)
    await resetVariant()
    httpOnlyOauthProvider.reset()
    await use(httpOnlyOauthProvider)
  },
})

oauthTest('[SEC-048] [SEC-049] OAUTH2 sign-in, reload resume, server-side revocation and logout work with HttpOnly session cookies @mobile', async ({ page, idp, diagnostics, context, playwright }) => {
  // the revoked session's requests are refused
  diagnostics.allow(/ 401$/)
  diagnostics.allow('status of 401')
  const authorizeRequests = () => idp.requests.filter((request) => request.path === '/authorize')
  await open(page, '/app/person')
  await expect(page.getByRole('heading', { name: 'QRun Test Identity Provider' })).toBeVisible()
  await page.getByLabel('Account').selectOption({ label: 'Dana Owner (OIDC)' })
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  const [first] = await variantSql('select uuid from user_session')
  await expectHttpOnlySession(page, context, first.uuid!)

  // a reload resumes through an empty manageSession, without the provider
  const resumed = await reloadAndCaptureResume(page)
  expect(resumed.body).toBe('{}')
  expect(resumed.status).toBe(200)
  expect(resumed.json).not.toHaveProperty('uuid')
  expect(resumed.text).not.toContain(first.uuid)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  await expect((await navigation(page)).locator('[data-qqq-id="sidebar-user-name"]')).toHaveText('Dana Owner (OIDC)')
  expect(authorizeRequests()).toHaveLength(1)

  // another tab or an administrator ends the session: the next request goes through the provider and back
  const outside = await playwright.request.newContext({ baseURL: SECURITY_URL, extraHTTPHeaders: { Cookie: `sessionUUID=${first.uuid}` } })
  expect((await outside.post('/qqq/v1/logout')).status()).toBe(200)
  await outside.dispose()
  await listCell(page, 'Person', 'Blair').click()
  await expect(page).toHaveURL(/\/app\/person\/2\/?$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
  expect(authorizeRequests()).toHaveLength(2)
  const sessions = await variantSql('select uuid from user_session')
  expect(sessions).toHaveLength(1)
  expect(sessions[0].uuid).not.toBe(first.uuid)
  await expectHttpOnlySession(page, context, sessions[0].uuid!)

  // logout ends the backend session and the server expires both cookies
  expect(await logOut(page)).toBe(200)
  expect((await context.cookies()).filter((cookie) => SESSION_COOKIES.includes(cookie.name))).toEqual([])
  expect(await variantSql('select count(*) as n from user_session')).toEqual([{ n: '0' }])
})
