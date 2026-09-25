/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Sessions and MOCK authentication against the shared acceptance backend.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { allowExternalQuickSightWidget, listCell, navigation, openUserMenu } from './support/ui'

const personGrid = (page: Page) => page.getByRole('grid', { name: 'Person records' })

test.describe('MOCK sessions', () => {
  test('[SEC-020] a deep link establishes the session and shows the session user @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const manageSession = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/manageSession')
    await open(page, '/app/person')
    expect((await manageSession).status()).toBe(200)
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    const sidebar = await navigation(page)
    await expect(sidebar.locator('[data-qqq-id="sidebar-user-name"]')).toHaveText('Alice (sample)')
    await expect(sidebar.locator('[data-qqq-id="sidebar-user-email"]')).toHaveText('sample:alice')
    // the session the UI uses is the persona session the backend resolves
    const probe = await backend.api.post('/qqq/v1/table/person/count', { data: {} })
    expect(probe.status()).toBe(200)
  })

  test('[SEC-021] logout ends the session, guards protected pages and signs back in to the original page @mobile', async ({ page, backend, diagnostics, context }) => {
    void diagnostics
    void backend
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    expect((await context.cookies()).map((cookie) => cookie.name)).toContain('sessionUUID')

    const menu = await openUserMenu(page)
    const logoutCall = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/logout')
    await menu.getByRole('menuitem', { name: 'Log Out' }).click()
    expect((await logoutCall).status()).toBe(200)
    await expect(page).toHaveURL(/\/login\/?\?returnTo=%2Fapp%2Fperson/)
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
    expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain('sessionUUID')

    // a protected page after logout (full load) stays on the login page and reads no data
    const dataReads: string[] = []
    page.on('request', (request) => { if (/\/table\/|\/data\//.test(request.url())) dataReads.push(request.url()) })
    await open(page, '/app/pet')
    await expect(page).toHaveURL(/\/login\/?\?returnTo=%2Fapp%2Fpet/)
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()
    expect(dataReads).toEqual([])

    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/app\/pet\/?$/)
    // the grid on desktop, the card list on a phone
    await expect(page.getByRole('grid', { name: 'Pet records' }).or(page.getByRole('list', { name: 'Pet records' }))).toBeVisible()
    await expect((await navigation(page)).locator('[data-qqq-id="sidebar-user-name"]')).toHaveText('Alice (sample)')
  })

  test('[SEC-021] logout clears cached data so the next user never sees the previous user\'s pages', async ({ page, backend, diagnostics, context }) => {
    allowExternalQuickSightWidget(diagnostics)
    await open(page, '/app/pet/1')
    await expect(page.getByRole('heading', { name: /Charlie/ }).first()).toBeVisible()
    await open(page, '/app/person/1')
    await expect(page.getByRole('heading', { name: /Avery/ }).first()).toBeVisible()
    const menu = await openUserMenu(page)
    await menu.getByRole('menuitem', { name: 'Log Out' }).click()
    await expect(page.getByRole('heading', { name: 'You have signed out' })).toBeVisible()

    // a different, less privileged identity signs in on the same browser
    // (mock sessions are keyed by the sessionId cookie the harness assigns)
    await context.addCookies([{ name: 'sessionId', value: backend.sessionId, url: 'http://127.0.0.1' }])
    await backend.setPersona('noPets', 'bob')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
    await expect(page.getByRole('heading', { name: /Avery/ }).first()).toBeVisible()
    const sidebar = await navigation(page)
    await expect(sidebar.getByRole('link', { name: 'Person', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Pet', exact: true })).toHaveCount(0)
    await open(page, '/app')
    await expect(page.locator('[data-qqq-id="dashboard-home"]')).toBeVisible()
    // only what this user viewed after signing in; alice's pet record is gone
    await expect(page.locator('[data-qqq-id^="dashboard-recent-"]')).toHaveCount(1)
    await expect(page.locator('a[href="/app/pet/1"]')).toHaveCount(0)
  })

  test.describe('expired session', () => {
    test.use({ persona: 'expired' })

    test('[SEC-022] an expired session redirects to login with returnTo and re-authenticates back to the page @mobile', async ({ page, backend, diagnostics }) => {
      void backend
      diagnostics.allow(/ 401$/)
      diagnostics.allow('status of 401')
      const unauthorized = page.waitForResponse((response) => response.status() === 401)
      await open(page, '/app/person')
      await unauthorized
      await expect(page).toHaveURL(/\/app\/person\/?$/, { timeout: 30_000 })
      await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    })
  })

  test('[SEC-022] a session that expires mid-use returns to the page the user was on @mobile', async ({ page, backend, diagnostics }) => {
    diagnostics.allow(/ 401$/)
      diagnostics.allow('status of 401')
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await backend.setPersona('expired')
    const loginVisit = page.waitForURL(/\/login\/?\?returnTo=%2Fapp%2Fperson%2F2/)
    await listCell(page, 'Person', 'Blair').click()
    await loginVisit
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
  })

  test('[SEC-023] a denied login keeps the user out with an explanation and no dashboard access', async ({ page, backend, diagnostics }) => {
    void backend
    diagnostics.allow('/qqq/v1/manageSession 401')
    diagnostics.allow('status of 401')
    await page.route('**/qqq/v1/manageSession', (route) => route.continue({
      headers: { ...route.request().headers(), 'content-type': 'application/json' },
      postData: JSON.stringify({ accessToken: 'Deny' }),
    }))
    const denied = page.waitForResponse((response) => new URL(response.url()).pathname === '/qqq/v1/manageSession')
    await open(page, '/app/person')
    expect((await denied).status()).toBe(401)
    await expect(page).toHaveURL(/\/login\/?\?/)
    await expect(page.locator('[data-qqq-id="login-error"]')).toContainText('Sign-in was denied')
    await expect(page.getByRole('grid')).toHaveCount(0)
    await expect(page.locator('[data-qqq-id="sidebar-desktop"]')).toHaveCount(0)
    await expect(page.locator('[data-qqq-id="button-mobile-menu"]')).toHaveCount(0)
  })

  test('[SEC-024] login returnTo never redirects off-site', async ({ page, backend, diagnostics }) => {
    void backend
    allowExternalQuickSightWidget(diagnostics)
    for (const target of ['https://evil.example/steal', '//evil.example/steal', '/\\evil.example', 'javascript:alert(1)']) {
      await open(page, `/login?returnTo=${encodeURIComponent(target)}`)
      await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/app\/?$/)
      await page.waitForLoadState('networkidle')
    }
    await open(page, `/login?returnTo=${encodeURIComponent('/app/person/2?x=1')}`)
    await expect(page).toHaveURL(/\/app\/person\/2\/?\?x=1$/)
    await expect(page.getByRole('heading', { name: /Blair/ }).first()).toBeVisible()
  })
})
