/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page } from '@playwright/test'
import { expect, open, test, type Backend } from '../../support/fixtures'
import { expectNoHorizontalScroll, expectTouchReady, expectTouchTargets } from '../../support/touch'
import { allowQuickSight, appNavigation, expectBreadcrumbs, expectRecords, findNode, recordCollection, recordItems, v1MetaData, waitForShell } from './nav-helpers'

/** Record label the backend computes for a person, read through the API independently of the UI. */
async function personLabel(backend: Backend, id: number): Promise<string> {
  const response = await backend.api.post('/qqq/v1/table/person/query', {
    data: { filter: { criteria: [{ fieldName: 'id', operator: 'EQUALS', values: [id] }] } },
  })
  expect(response.status()).toBe(200)
  return (await response.json()).records[0].recordLabel
}

async function expectNotFound(page: Page, name: string) {
  await waitForShell(page)
  const state = page.locator('[data-qqq-id="not-found-state"]')
  await expect(state.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(state).toContainText(`There is no app, table, process or report named ${name} that you can open.`)
  await expect(page).toHaveTitle('Not Found | QQQ Sample')
}

test.describe('routing', () => {
  test('[NAV-014] breadcrumbs show the full app hierarchy and each crumb navigates @mobile', async ({ page, backend, diagnostics }) => {
    allowQuickSight(diagnostics)
    await open(page, '/app/person')
    await expectBreadcrumbs(page, ['People App', 'Greetings App', 'Person'])

    await open(page, '/app/greetInteractive')
    await expectBreadcrumbs(page, ['People App', 'Greetings App', 'Greet Interactive'])

    await open(page, '/app/person/create')
    await expectBreadcrumbs(page, ['People App', 'Greetings App', 'Person', 'Create Person'])

    await open(page, '/app/navDeepItem/2/edit')
    await expectBreadcrumbs(page, ['Nav Level One', 'Nav Level Two', 'Nav Level Three', 'Nav Deep Item', '2', 'Edit'])
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(trail.locator('[aria-current="page"]')).toHaveText('Edit')
    // Six crumbs on a phone: the trail scrolls sideways on its own, the page does not, and each crumb is a touch target
    await expectNoHorizontalScroll(page)
    await expectTouchTargets(trail)
    await trail.getByRole('link', { name: 'Nav Level Two' }).click()
    await expect(page).toHaveURL(/\/app\/navLevelTwo\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Nav Level Two' })).toBeVisible()
    await expectBreadcrumbs(page, ['Nav Level One', 'Nav Level Two'])

    await open(page, '/app/person')
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Greetings App' }).click()
    await expect(page).toHaveURL(/\/app\/greetingsApp\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Greetings App' })).toBeVisible()

    // The dashboard root has no breadcrumbs
    await open(page, '/app')
    await waitForShell(page)
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0)
  })

  test('[NAV-014] a table outside the app tree is named by its label in the breadcrumb and the title @mobile', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    expect(findNode(meta.appTree, 'scriptType'), 'scriptType is not in the app tree').toBeUndefined()
    const response = await backend.api.get('/qqq/v1/metaData/table/scriptType')
    expect(response.status()).toBe(200)
    const label: string = (await response.json()).label
    expect(label).not.toBe('scriptType')
    await open(page, '/app/scriptType')
    await waitForShell(page)
    await expectBreadcrumbs(page, [label])
    await expect(page).toHaveTitle(`${label} | QQQ Sample`)
  })

  test('[NAV-015] the document title names the page, its enclosing apps and the application @mobile', async ({ page, backend, diagnostics }) => {
    await open(page, '/app')
    await expect(page).toHaveTitle('Dashboard | QQQ Sample')
    await open(page, '/app/person')
    await expect(page).toHaveTitle('Person | Greetings App | People App | QQQ Sample')
    await open(page, '/app/navDeepItem')
    await expect(page).toHaveTitle('Nav Deep Item | Nav Level Three | Nav Level Two | Nav Level One | QQQ Sample')
    await open(page, '/app/person/1')
    await expect(page).toHaveTitle(`${await personLabel(backend, 1)} | Person | Greetings App | People App | QQQ Sample`)
    await open(page, '/app/noSuchThing')
    await expect(page).toHaveTitle('Not Found | QQQ Sample')
  })

  test('[NAV-016] the site root replaces itself with the dashboard @mobile', async ({ page, backend, diagnostics }) => {
    await open(page, '/app/person')
    await waitForShell(page)
    await open(page, '/')
    await expect(page).toHaveURL(/\/app\/?$/)
    await expect(page.getByText(/Here's an overview of your QQQ Sample system\./)).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    await expect(recordCollection(page, 'Person')).toBeVisible()
  })

  test('[NAV-018] hard-loaded links open every route shape with the shell, sidebar state and breadcrumbs @mobile', async ({ page, backend, diagnostics }) => {
    allowQuickSight(diagnostics)
    const [view] = await backend.sql("select id from saved_view where table_name = 'person' order by id")
    expect(view, 'the sharing fixture seeds a person saved view').toBeTruthy()
    const label = await personLabel(backend, 1)
    const cases: Array<{ path: string; crumbs: string[]; content: (page: Page) => Promise<void>; active: string }> = [
      { path: '/app/greetingsApp', crumbs: ['People App', 'Greetings App'], active: 'Greetings App', content: (p) => expect(p.getByRole('heading', { level: 1, name: 'Greetings App' })).toBeVisible() },
      { path: '/app/navLevelThree', crumbs: ['Nav Level One', 'Nav Level Two', 'Nav Level Three'], active: 'Nav Level Three', content: (p) => expect(p.getByRole('heading', { level: 1, name: 'Nav Level Three' })).toBeVisible() },
      { path: '/app/person', crumbs: ['People App', 'Greetings App', 'Person'], active: 'Person', content: (p) => expect(recordCollection(p, 'Person')).toBeVisible() },
      { path: '/app/greetInteractive', crumbs: ['People App', 'Greetings App', 'Greet Interactive'], active: 'Greet Interactive', content: (p) => expect(p).toHaveTitle('Greet Interactive | Greetings App | People App | QQQ Sample') },
      { path: '/app/person/1', crumbs: ['People App', 'Greetings App', 'Person', '1'], active: 'Person', content: (p) => expect(p).toHaveTitle(`${label} | Person | Greetings App | People App | QQQ Sample`) },
      { path: '/app/person/1/edit', crumbs: ['People App', 'Greetings App', 'Person', '1', 'Edit'], active: 'Person', content: (p) => expect(p.getByRole('main').getByRole('textbox').first()).toBeVisible() },
      { path: '/app/person/create', crumbs: ['People App', 'Greetings App', 'Person', 'Create Person'], active: 'Person', content: (p) => expect(p.getByRole('main').getByRole('textbox').first()).toBeVisible() },
      // Saved-view links render the saved-view page (query area); navigation checks its shell and breadcrumbs
      { path: `/app/person/savedView/${view.id}`, crumbs: ['People App', 'Greetings App', 'Person', 'Saved View'], active: 'Person', content: (p) => expect(p.locator('#main-content')).toBeVisible() },
    ]
    for (const { path, crumbs, content, active } of cases) {
      await open(page, path)
      await content(page)
      await expectBreadcrumbs(page, crumbs)
      const nav = await appNavigation(page)
      await expect(nav.getByRole('link', { name: active, exact: true }), path).toBeVisible()
      await expect(nav.getByRole('link', { name: active, exact: true }), path).toHaveAttribute('aria-current', 'page')
    }
  })

  test('[NAV-019] refresh keeps the route, its query string and the content @mobile', async ({ page, backend, diagnostics }) => {
    const total = Number((await backend.sql('select count(*) as n from carrier'))[0].n)
    expect(total).toBeGreaterThan(10)
    await open(page, '/app/carrier?page=2&pageSize=10')
    const rows = recordItems(recordCollection(page, 'Carrier'))
    await expect(rows).toHaveCount(total - 10)
    await page.reload()
    await expect(page).toHaveURL(/\/app\/carrier\/?\?page=2&pageSize=10$/)
    await expect(rows).toHaveCount(total - 10)

    const label = await personLabel(backend, 2)
    await open(page, '/app/person/2')
    await expect(page).toHaveTitle(new RegExp(`^${label} \\|`))
    await page.reload()
    await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
    await expect(page).toHaveTitle(new RegExp(`^${label} \\|`))
    await expectBreadcrumbs(page, ['People App', 'Greetings App', 'Person', '2'])

    await open(page, '/app/navLevelOne')
    await expect(page.getByRole('heading', { level: 1, name: 'Nav Level One' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Nav Level One' })).toBeVisible()
  })

  test('[NAV-020] back and forward traverse the navigation history with the right content @mobile', async ({ page, backend, diagnostics }) => {
    await open(page, '/app')
    await waitForShell(page)
    await page.locator('[data-qqq-id="dashboard-app-miscellaneous"]').click()
    await expect(page.getByRole('heading', { level: 1, name: 'Miscellaneous' })).toBeVisible()
    await page.getByRole('main').getByRole('region', { name: 'Miscellaneous', exact: true }).getByRole('link', { name: /^Carrier/ }).click()
    await expect(recordCollection(page, 'Carrier')).toBeVisible()
    const nav = await appNavigation(page)
    await nav.getByRole('link', { name: 'Nav Empty App', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Nav Empty App' })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/\/app\/carrier\/?$/)
    await expect(recordCollection(page, 'Carrier')).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/app\/miscellaneous\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Miscellaneous' })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/app\/?$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Applications' })).toBeVisible()
    await page.goForward()
    await expect(page.getByRole('heading', { level: 1, name: 'Miscellaneous' })).toBeVisible()
    await page.goForward()
    await expect(page).toHaveURL(/\/app\/carrier\/?$/)
    await expect(recordCollection(page, 'Carrier')).toBeVisible()
    await expectBreadcrumbs(page, ['Miscellaneous', 'Carrier'])
  })

  test('[NAV-021] an unknown /app name shows the not-found state with a way back @mobile', async ({ page, backend, diagnostics }) => {
    expect((await backend.api.get('/qqq/v1/metaData/table/noSuchThing')).status()).toBe(404)
    await open(page, '/app/noSuchThing')
    await expectNotFound(page, 'noSuchThing')
    await expectTouchTargets(page.locator('[data-qqq-id="not-found-state"]'))
    await page.getByRole('link', { name: 'Go to the dashboard' }).click()
    await expect(page).toHaveURL(/\/app\/?$/)
    await expect(page).toHaveTitle('Dashboard | QQQ Sample')
  })

  test('[NAV-006] direct links to hidden objects the user may not access show not-found; the backend denies them @mobile', async ({ page, backend, diagnostics }) => {
    expect((await backend.api.get('/qqq/v1/metaData/table/city')).status()).toBe(404)
    expect((await backend.api.get('/qqq/v1/metaData/process/greet')).status()).toBe(403)
    expect((await backend.api.post('/qqq/v1/processes/greet/init', { data: {} })).status()).toBe(403)
    await open(page, '/app/city')
    await expectNotFound(page, 'city')
    await open(page, '/app/greet')
    await expectNotFound(page, 'greet')
  })

  test('[NAV-007] a hidden table the user may access opens by direct link @mobile', async ({ page, backend, diagnostics }) => {
    await open(page, '/app/navHiddenNote')
    const rows = await backend.sql('select title from nav_hidden_note order by id')
    await expectRecords(page, 'Nav Hidden Note', rows.map((row) => row.title!))
    await expectBreadcrumbs(page, ['Nav Level One', 'Nav Level Two', 'Nav Level Three', 'Nav Hidden Note'])
    const nav = await appNavigation(page)
    await expect(nav.getByRole('link', { name: 'Nav Hidden Note', exact: true })).toHaveCount(0)
  })

  test('[NAV-022] unknown deeper and top-level paths return the 404 page with a working home link @mobile', async ({ page, backend, diagnostics }) => {
    for (const path of ['/app/person/1/no/such', '/no-such-page']) {
      diagnostics.allow(`GET ${path} 404`)
      diagnostics.allow(/Failed to load resource: the server responded with a status of 404/)
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(404)
      await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible()
      await expect(page.getByText('Page not found')).toBeVisible()
      await expectTouchReady(page)
    }
    await page.getByRole('link', { name: 'Go Home' }).click()
    await expect(page).toHaveURL(/\/app\/?$/)
    await waitForShell(page)
    await expect(page).toHaveTitle('Dashboard | QQQ Sample')
  })
})
