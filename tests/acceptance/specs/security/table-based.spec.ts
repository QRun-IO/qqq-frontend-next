/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// TABLE_BASED authentication (QRun-IO/qqq#700) on its own backend variant: the login page
// asks for a username and password, sent once as `Authorization: Basic` to
// POST /qqq/v1/manageSession; the module checks them against its user table and stores
// a session row (SecurityFixtures.primeTableBased seeds the users).
import type { Page } from '@playwright/test'
import { expect, open, test as acceptanceTest } from '../../support/fixtures'
import { expireTableSessions, resetVariant, SECURITY_URL, startVariant, variantSql } from './support/variant'
import { listCell, navigation, openUserMenu, recordRequests } from './support/ui'

const TESS = { username: 'tess.table', password: 'table:pass-2026', name: 'Tess Table (table-based)' }
const RAVI = { username: 'ravi.rows', password: 'rows-pass-2026', name: 'Ravi Rows (table-based)' }

const test = acceptanceTest.extend<{ tableBased: void }>({
  baseURL: async ({}, use) => { await use(SECURITY_URL) },
  tableBased: async ({}, use) => {
    await startVariant('TABLE_BASED')
    await resetVariant()
    await use()
  },
})

/**
 * Fills and submits the login form.
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

/** Session rows with their user, oldest first. */
async function sessionRows() {
  return variantSql('select s.id as id, u.username as username, s.access_timestamp as access from table_auth_session s join table_auth_user u on u.id = s.user_id order by s.create_date, s.id')
}

test('[SEC-034] a deep link asks for credentials under the app branding, signs in with the password, and resumes after reload @mobile', async ({ page, tableBased, diagnostics, context, playwright }) => {
  void tableBased
  void diagnostics
  const reads = recordRequests(page)
  await open(page, '/app/person')
  await expect(page).toHaveURL(/\/login\/?\?returnTo=%2Fapp%2Fperson/)
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  // pre-sign-in branding from GET /qqq/v1/metaData/authentication (QRun-IO/qqq#703)
  const logo = page.locator('[data-qqq-id="login-logo"]')
  await expect(logo).toHaveAttribute('src', '/samples-logo.png')
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect(page.locator('[data-qqq-id="login-app-name"]')).toHaveText('QQQ Sample')
  expect(reads).toEqual([])
  expect(await sessionRows()).toEqual([])

  const signIn = page.waitForRequest((request) => new URL(request.url()).pathname === '/qqq/v1/manageSession')
  await submitCredentials(page, TESS)
  const request = await signIn
  // the password (which contains colons) travels once, as Basic credentials, never in the body
  expect(request.headers().authorization).toBe(`Basic ${Buffer.from(`${TESS.username}:${TESS.password}`).toString('base64')}`)
  expect(request.postData()).toBe('{}')

  await expect(page).toHaveURL(/\/app\/person\/?$/)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  const nav = await navigation(page)
  await expect(nav.locator('[data-qqq-id="sidebar-user-name"]')).toHaveText(TESS.name)
  await expect(nav.locator('[data-qqq-id="sidebar-user-email"]')).toHaveText(TESS.username)

  // one stored session, for Tess, and it is the one the browser holds
  const rows = await sessionRows()
  expect(rows.map((row) => row.username)).toEqual([TESS.username])
  const sessionUUID = (await context.cookies()).find((cookie) => cookie.name === 'sessionUUID')?.value
  expect(sessionUUID).toBe(rows[0].id)
  // the password is kept nowhere in the browser
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie)
  expect(stored).not.toContain(TESS.password)
  // the backend enforces the session: with it a read succeeds, without it the read is refused
  const withSession = await playwright.request.newContext({ baseURL: SECURITY_URL, extraHTTPHeaders: { Cookie: `sessionUUID=${sessionUUID}` } })
  expect((await withSession.post('/qqq/v1/table/person/count', { data: {} })).status()).toBe(200)
  await withSession.dispose()
  const anonymous = await playwright.request.newContext({ baseURL: SECURITY_URL })
  expect((await anonymous.post('/qqq/v1/table/person/count', { data: {} })).status()).toBe(401)
  await anonymous.dispose()

  await page.reload()
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  await expect((await navigation(page)).locator('[data-qqq-id="sidebar-user-name"]')).toHaveText(TESS.name)
  expect((await sessionRows()).map((row) => row.id)).toEqual([sessionUUID])
})

test('[SEC-035] a wrong password or unknown user is refused with one message, stores no session, and the form recovers @mobile', async ({ page, tableBased, diagnostics }) => {
  void tableBased
  diagnostics.allow('/qqq/v1/manageSession 401')
  diagnostics.allow('status of 401')
  const reads = recordRequests(page)
  await open(page, '/app/person')
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()

  // an empty form names the missing fields and sends nothing
  const attempts: string[] = []
  page.on('request', (request) => { if (new URL(request.url()).pathname === '/qqq/v1/manageSession') attempts.push(request.url()) })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Enter your username.')).toBeVisible()
  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  expect(attempts).toEqual([])

  for (const credentials of [{ username: TESS.username, password: 'table:pass' }, { username: 'nobody.here', password: TESS.password }]) {
    const refused = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/manageSession')
    await submitCredentials(page, credentials)
    expect((await refused).status()).toBe(401)
    // the same message for both: the page never says which part was wrong
    await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in was denied: Incorrect username or password.')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
    await expect(page).toHaveURL(/\/login\/?\?returnTo=%2Fapp%2Fperson/)
  }
  expect(await sessionRows()).toEqual([])
  expect(reads).toEqual([])

  await submitCredentials(page, TESS)
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  expect((await sessionRows()).map((row) => row.username)).toEqual([TESS.username])
})

test('[SEC-036] an idle-expired session sends the user to sign in again and back to the record they opened @mobile', async ({ page, tableBased, diagnostics, playwright }) => {
  void tableBased
  diagnostics.allow(/ 401$/)
  diagnostics.allow('status of 401')
  await open(page, '/app/person')
  await submitCredentials(page, TESS)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  const [expiredSession] = await sessionRows()

  // the session sits idle past the module's inactivity timeout
  expect(await expireTableSessions()).toBe(1)
  const loginVisit = page.waitForURL(/\/login\/?\?returnTo=%2Fapp%2Fperson%2F2/)
  await listCell(page, 'Person', 'Blair').click()
  await loginVisit
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  // the backend refuses the expired session outright
  const replay = await playwright.request.newContext({ baseURL: SECURITY_URL, extraHTTPHeaders: { Cookie: `sessionUUID=${expiredSession.id}` } })
  const refused = await replay.post('/qqq/v1/table/person/count', { data: {} })
  expect(refused.status()).toBe(401)
  expect((await refused.json()).error).toBe('Session is expired.')
  await replay.dispose()

  await submitCredentials(page, TESS)
  await expect(page).toHaveURL(/\/app\/person\/2\/?$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
  const rows = await sessionRows()
  expect(rows).toHaveLength(2)
  expect(rows.map((row) => row.username)).toEqual([TESS.username, TESS.username])
  expect(rows.map((row) => row.id)).toContain(expiredSession.id)
})

test('[SEC-037] logout deletes the stored session, keeps protected pages on the form, and the next user signs in as themselves @mobile', async ({ page, tableBased, diagnostics, context, playwright }) => {
  void tableBased
  void diagnostics
  await open(page, '/app/person')
  await submitCredentials(page, TESS)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  const sessionUUID = (await context.cookies()).find((cookie) => cookie.name === 'sessionUUID')?.value
  expect(sessionUUID).toBeTruthy()

  const menu = await openUserMenu(page)
  const logout = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/logout')
  await menu.getByRole('menuitem', { name: 'Log Out' }).click()
  expect((await logout).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
  // the session row is gone, both cookies are cleared, and the ended session cannot be replayed
  expect(await sessionRows()).toEqual([])
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toEqual(expect.arrayContaining(['sessionUUID']))
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toEqual(expect.arrayContaining(['sessionId']))
  for (const cookie of [`sessionUUID=${sessionUUID}`, `sessionId=${sessionUUID}`]) {
    const replay = await playwright.request.newContext({ baseURL: SECURITY_URL, extraHTTPHeaders: { Cookie: cookie } })
    expect((await replay.post('/qqq/v1/table/person/count', { data: {} })).status()).toBe(401)
    await replay.dispose()
  }

  // a protected page (full load) stays on the form and reads nothing
  const reads = recordRequests(page)
  await open(page, '/app/person')
  await expect(page).toHaveURL(/\/login\/?\?returnTo=%2Fapp%2Fperson/)
  await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
  expect(reads).toEqual([])

  await submitCredentials(page, RAVI)
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  const nav = await navigation(page)
  await expect(nav.locator('[data-qqq-id="sidebar-user-name"]')).toHaveText(RAVI.name)
  await expect(nav.locator('[data-qqq-id="sidebar-user-email"]')).toHaveText(RAVI.username)
  expect((await sessionRows()).map((row) => row.username)).toEqual([RAVI.username])
})

const unsupportedTest = acceptanceTest.extend<{ unsupported: void }>({
  baseURL: async ({}, use) => { await use(SECURITY_URL) },
  unsupported: async ({}, use) => {
    await startVariant('UNSUPPORTED')
    await use()
  },
})

unsupportedTest('[SEC-032] an authentication type this UI does not know is reported and nothing else is attempted', async ({ page, unsupported, diagnostics }) => {
  void unsupported
  void diagnostics
  const reads = recordRequests(page)
  const sessionCalls: string[] = []
  page.on('request', (request) => { if (/manageSession/.test(request.url())) sessionCalls.push(request.url()) })
  await open(page, '/app/person')
  await expect(page.locator('[data-qqq-id="login-error"]')).toHaveText('Sign-in failed: Unsupported authentication type: ACCEPTANCE_UNKNOWN')
  expect(reads).toEqual([])
  expect(sessionCalls).toEqual([])
})
